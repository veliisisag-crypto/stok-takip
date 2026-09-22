// app/api/parti-analiz/route.ts
//
// Parti fotoğraflarını analiz eder, ürün kataloğuyla eşleştirir ve
// parti_taslak_satir kayıtlarını üretir. batch_items'a DOKUNMAZ.
//
// Ortam değişkenleri:
//   ANTHROPIC_API_KEY
//   ANTHROPIC_MODEL            (opsiyonel, varsayılan claude-sonnet-5)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const CEP_BOY_USD_FIYAT = 3; // page.tsx'teki sabitle aynı olmalı

// suppliers.name -> products'taki USD fiyat kolonu
// page.tsx içindeki getUsdPriceForBatch ile aynı eşleme.
const FIYAT_KOLONU: Record<string, string> = {
  'T-Yüksel': 'usd_fiyat_tyuksel',
  'T-Hasan': 'usd_fiyat_thasan',
  'T-Amir': 'usd_fiyat_tamir',
};

type ModelSatir = {
  okunan: string;
  product_id: string | null;
  adaylar: string[];
  adet: number;
  variant?: 'ana' | 'cep_boy';
  sebep?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { batch_id, images, foto_urls = [] } = (await req.json()) as {
      batch_id: string;
      images: { media_type: string; data: string }[];
      foto_urls?: string[];
    };

    if (!batch_id || !images?.length) {
      return NextResponse.json(
        { error: 'batch_id ve en az bir fotoğraf gerekli' },
        { status: 400 }
      );
    }
    if (images.length > 6) {
      return NextResponse.json(
        { error: 'En fazla 6 fotoğraf' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ----------------------------------------------------------------
    // 1. Parti + toptancı. Kur ve toptancı taslakta kopyalanmaz;
    //    tek kaynak batches tablosu.
    // ----------------------------------------------------------------
    const { data: batch, error: bErr } = await supabase
      .from('batches')
      .select('id, name, supplier_id, usd_kuru, workspace')
      .eq('id', batch_id)
      .single();
    if (bErr || !batch) throw new Error('Parti bulunamadı');
    if (!batch.supplier_id) throw new Error('Bu partiye toptancı atanmamış');
    if (!batch.usd_kuru) throw new Error('Bu partiye USD kuru girilmemiş');

    const { data: supplier } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', batch.supplier_id)
      .single();
    if (!supplier) throw new Error('Toptancı kaydı bulunamadı');

    const workspace = batch.workspace as 'kuzey' | 'guney';
    const katalogWorkspaces =
      workspace === 'guney' ? ['kuzey', 'guney'] : ['kuzey'];
    const fiyatKolonu = FIYAT_KOLONU[supplier.name] ?? null;

    // ----------------------------------------------------------------
    // 2. Katalog — pasif ürünler hariç.
    //    Pasif ürünü katalogda bırakmak modelin emekli bir kayda
    //    eşleştirmesine yol açar.
    // ----------------------------------------------------------------
    const kolonlar = ['id', 'name', 'code', 'gender_category', fiyatKolonu]
      .filter(Boolean)
      .join(',');

    const { data: products, error: pErr } = await supabase
      .from('products')
      .select(kolonlar)
      .in('workspace', katalogWorkspaces)
      .eq('passive', false)
      .order('name');
    if (pErr) throw pErr;
    if (!products?.length) throw new Error('Katalog boş');

    // ----------------------------------------------------------------
    // 3. Bu toptancı için öğrenilmiş eşleşmeler
    // ----------------------------------------------------------------
    const { data: varsayilanlar } = await supabase
      .from('tedarikci_urun_varsayilan')
      .select('okunan_metin_norm, product_id, son_usd_fiyat')
      .eq('workspace', workspace)
      .eq('supplier_id', supplier.id);

    const ogrenilmis = new Map(
      (varsayilanlar ?? []).map((v: any) => [v.okunan_metin_norm, v])
    );

    // ----------------------------------------------------------------
    // 4. Model çağrısı. Katalog nadiren değişir -> cache_control.
    // ----------------------------------------------------------------
    const katalog = (products as any[])
      .map((p) => `${p.id}\t${p.name}\t${p.code ?? ''}\t${p.gender_category ?? ''}`)
      .join('\n');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const icerik: any[] = images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.media_type, data: img.data },
    }));
    icerik.push({
      type: 'text',
      text:
        images.length > 1
          ? `Bu ${images.length} fotoğraf AYNI partinin FARKLI gruplarına ait. Aynı kutu iki fotoğrafta görünmez; tekrar sayma.`
          : 'Bu fotoğrafı analiz et.',
    });

    const yanit = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [
        { type: 'text', text: SISTEM_PROMPT },
        {
          type: 'text',
          text: 'ÜRÜN KATALOĞU (product_id \\t ad \\t kod \\t cinsiyet):\n' + katalog,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: icerik }],
    });

    const ham = yanit.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .replace(/```json|```/g, '')
      .trim();

    let cikti: { satirlar: ModelSatir[]; tanimlanamayan_kutu_sayisi: number; not?: string };
    try {
      cikti = JSON.parse(ham);
    } catch {
      return NextResponse.json(
        { error: 'Model geçerli JSON döndürmedi', ham: ham.slice(0, 500) },
        { status: 502 }
      );
    }

    // ----------------------------------------------------------------
    // 5. Doğrulama + güven sınıflandırma
    //    Güven modelin beyanından DEĞİL çıktının yapısından türer.
    //    Model uydurma id verirse burada elenir.
    // ----------------------------------------------------------------
    const gecerli = new Set((products as any[]).map((p) => p.id));
    const katalogFiyat = new Map(
      (products as any[]).map((p) => [
        p.id,
        fiyatKolonu ? (p as any)[fiyatKolonu] ?? null : null,
      ])
    );

    const satirlar = (cikti.satirlar ?? []).map((s, i) => {
      const okunan = String(s.okunan ?? '').trim() || '(okunamadı)';
      const variant = s.variant === 'cep_boy' ? 'cep_boy' : 'ana';

      let productId =
        s.product_id && gecerli.has(s.product_id) ? s.product_id : null;
      let adaylar = (s.adaylar ?? []).filter((a) => gecerli.has(a));

      // Öğrenilmiş eşleşme modelin kararsızlığını ezer
      const ogr = ogrenilmis.get(normUrunAdi(okunan));
      if (ogr) {
        productId = ogr.product_id;
        adaylar = [];
      }

      const guven: 'kesin' | 'supheli' | 'eslesmedi' = productId
        ? adaylar.length > 0
          ? 'supheli'
          : 'kesin'
        : adaylar.length > 0
        ? 'supheli'
        : 'eslesmedi';

      // USD fiyat kaynağı sırası: cep boy sabiti -> katalog -> geçmiş parti
      let usdFiyat: number | null = null;
      let kaynak: string | null = null;
      if (variant === 'cep_boy') {
        usdFiyat = CEP_BOY_USD_FIYAT;
        kaynak = 'cep_boy';
      } else if (productId) {
        const kf = katalogFiyat.get(productId);
        if (kf != null) {
          usdFiyat = Number(kf);
          kaynak = 'katalog';
        } else if (ogr?.son_usd_fiyat != null) {
          usdFiyat = Number(ogr.son_usd_fiyat);
          kaynak = 'gecmis_parti';
        }
      }

      return {
        sira: i,
        okunan_metin: okunan,
        product_id: guven === 'kesin' ? productId : null,
        aday_product_ids: adaylar,
        bought: Math.max(1, Number(s.adet) || 1),
        variant,
        depo: 'Stok',
        usd_fiyat: guven === 'kesin' ? usdFiyat : null,
        fiyat_kaynagi: guven === 'kesin' ? kaynak : null,
        guven,
      };
    });

    // ----------------------------------------------------------------
    // 6. Taslağı yaz
    // ----------------------------------------------------------------
    const { data: taslak, error: tErr } = await supabase
      .from('parti_taslak')
      .insert({
        workspace,
        batch_id,
        foto_urls,
        durum: 'kesin_onay',
        tanimlanamayan_kutu: Math.max(
          0,
          Number(cikti.tanimlanamayan_kutu_sayisi) || 0
        ),
        model_notu: cikti.not ?? null,
      })
      .select()
      .single();
    if (tErr) throw tErr;

    const { error: sErr } = await supabase
      .from('parti_taslak_satir')
      .insert(satirlar.map((s) => ({ ...s, taslak_id: taslak.id })));
    if (sErr) throw sErr;

    return NextResponse.json({
      taslak_id: taslak.id,
      tanimlanamayan_kutu: taslak.tanimlanamayan_kutu,
      toptanci: supplier.name,
      usd_kuru: batch.usd_kuru,
      ozet: {
        kesin: satirlar.filter((s) => s.guven === 'kesin').length,
        supheli: satirlar.filter((s) => s.guven === 'supheli').length,
        eslesmedi: satirlar.filter((s) => s.guven === 'eslesmedi').length,
        toplam_adet: satirlar.reduce((t, s) => t + s.bought, 0),
      },
    });
  } catch (e: any) {
    console.error('[parti-analiz]', e);
    return NextResponse.json(
      { error: e?.message ?? 'Analiz başarısız' },
      { status: 500 }
    );
  }
}

function normUrunAdi(t: string): string {
  return t
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => 'cgiosu'['çğıöşü'.indexOf(c)])
    .replace(/[^a-z0-9]+/g, '');
}

const SISTEM_PROMPT = `Sen bir parfüm toptancısının stok giriş asistanısın. Sana parti fotoğrafları verilir; fotoğraftaki her parfüm kutusunu tespit edip aşağıdaki kataloğa eşleştireceksin.

KURALLAR

1. Sadece geçerli JSON döndür. Açıklama, önsöz, markdown backtick YOK.

2. product_id alanına SADECE katalogdan birebir kopyaladığın bir id yaz. Emin değilsen null bırak ve olası adayları "adaylar" dizisine koy. Uydurma id yazma.

3. Aynı parfümün versiyonları (EDT / EDP / Intense / Elixir / Parfum) bu katalogda AYRI ÜRÜN kayıtlarıdır. Kutudan versiyonu net okuyamıyorsan product_id null olmalı ve olası versiyonların hepsi adaylar dizisinde olmalı. Örnek: kutuda sadece "SAUVAGE" görünüyorsa EDT/EDP/Elixir kayıtlarının hepsini aday yap.

4. Katalogda ml/boy bilgisi YOK. Kutu boyutuna göre ayrım yapma, sadece isim ve versiyon üzerinden eşleştir.

5. Her kutuyu say. Aynı ürünün 2 kutusu varsa tek satır, adet 2.

6. Hiç okuyamadığın kutular (arkada kalmış, yazısı görünmeyen, düz beyaz) için satır AÇMA. Bunları tanimlanamayan_kutu_sayisi alanında bildir. Bu alan zorunludur ve dürüst olmalıdır. Senden "hepsini okudum" demen beklenmiyor; okuyamadığını bildirmen bekleniyor.

7. Belirgin şekilde küçük seyahat boyu kutular için variant: "cep_boy", normal boy için "ana".

8. Fiyat tahmin etme, fiyat alanı yok.

ÇIKTI FORMATI

{
  "satirlar": [
    {
      "okunan": "kutudan okuduğun ham metin",
      "product_id": "katalogdan id veya null",
      "adaylar": ["id1", "id2"],
      "adet": 1,
      "variant": "ana",
      "sebep": "product_id null ise neden kararsız kaldığın"
    }
  ],
  "tanimlanamayan_kutu_sayisi": 0,
  "not": "genel uyarın varsa"
}`;
