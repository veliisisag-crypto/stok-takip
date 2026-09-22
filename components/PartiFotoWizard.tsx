'use client';

// components/PartiFotoWizard.tsx
//
// Mevcut bir partiye fotoğraftan kalem ekleme sihirbazı.
// Parti oluşturmaz — uygulamadaki akışı bozmaz: parti aç -> toptancı ata
// -> usd_kuru gir -> bu wizard'la kalemleri ekle.
//
// Kullanım (Parti Ürün Kaydı sekmesinde, batchForm.batchId seçiliyken):
//
//   {fotoWizardAcik && batchForm.batchId && (
//     <PartiFotoWizard
//       batchId={batchForm.batchId}
//       onTamamlandi={(eklenen) => {
//         setFotoWizardAcik(false);
//         setMessage(`${eklenen} kalem partiye eklendi.`);
//         loadAll();
//       }}
//       onKapat={() => setFotoWizardAcik(false)}
//     />
//   )}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  soruKuyruguUret,
  type Soru,
  type TaslakSatir,
  type Urun,
} from '@/lib/parti-sorulari';

const MAX_KENAR = 1568;
const MAX_FOTO = 6;

type Asama = 'foto' | 'analiz' | 'sorular' | 'ozet' | 'bitti';

type Props = {
  batchId: string;
  onTamamlandi: (eklenenKalem: number) => void;
  onKapat: () => void;
};

export default function PartiFotoWizard({ batchId, onTamamlandi, onKapat }: Props) {
  const [asama, setAsama] = useState<Asama>('foto');
  const [islemde, setIslemde] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [fotolar, setFotolar] = useState<{ file: File; onizleme: string }[]>([]);
  const [taslakId, setTaslakId] = useState<string | null>(null);
  const [satirlar, setSatirlar] = useState<TaslakSatir[]>([]);
  const [urunler, setUrunler] = useState<Map<string, Urun>>(new Map());
  const [gecmisFiyatlar, setGecmisFiyatlar] = useState<Map<string, number>>(new Map());
  const [tanimlanamayan, setTanimlanamayan] = useState(0);
  const [toptanci, setToptanci] = useState('');
  const [usdKuru, setUsdKuru] = useState(0);
  const [soruIndex, setSoruIndex] = useState(0);
  const [serbestFiyat, setSerbestFiyat] = useState('');
  const [aramaMetni, setAramaMetni] = useState('');
  const [aramaSonuc, setAramaSonuc] = useState<Urun[]>([]);
  const [aramaSatirId, setAramaSatirId] = useState<string | null>(null);

  const kuyruk = useMemo(
    () => soruKuyruguUret(satirlar, urunler, tanimlanamayan, gecmisFiyatlar),
    [satirlar, urunler, tanimlanamayan, gecmisFiyatlar]
  );
  const aktifSoru: Soru | undefined = kuyruk[soruIndex];

  useEffect(() => {
    return () => fotolar.forEach((f) => URL.revokeObjectURL(f.onizleme));
  }, [fotolar]);

  const fotoEkle = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const yeni: { file: File; onizleme: string }[] = [];
      for (const f of Array.from(files).slice(0, MAX_FOTO - fotolar.length)) {
        const kucuk = await kucult(f);
        yeni.push({ file: kucuk, onizleme: URL.createObjectURL(kucuk) });
      }
      setFotolar((p) => [...p, ...yeni]);
    },
    [fotolar.length]
  );

  // ------------------------------------------------------------------
  // Analiz
  // ------------------------------------------------------------------
  const analizEt = async () => {
    if (islemde || fotolar.length === 0) return;
    setIslemde(true);
    setHata(null);
    setAsama('analiz');
    try {
      // Fotoğrafları arşiv için batch_photos'a da yaz — mevcut çoklu
      // fotoğraf özelliğiyle aynı bucket ve tablo.
      const fotoUrls: string[] = [];
      for (const [i, f] of fotolar.entries()) {
        const yol = `batch/${batchId}/${Date.now()}-${i}.jpg`;
        const { error } = await supabase.storage
          .from('product-images')
          .upload(yol, f.file, { upsert: true, contentType: 'image/jpeg' });
        if (!error) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(yol);
          fotoUrls.push(data.publicUrl);
        }
      }

      const images = await Promise.all(
        fotolar.map(async (f) => ({
          media_type: 'image/jpeg',
          data: await base64(f.file),
        }))
      );

      const res = await fetch('/api/parti-analiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId, images, foto_urls: fotoUrls }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Analiz başarısız');

      setTaslakId(json.taslak_id);
      setTanimlanamayan(json.tanimlanamayan_kutu);
      setToptanci(json.toptanci);
      setUsdKuru(Number(json.usd_kuru));
      await taslakYukle(json.taslak_id);
      setAsama('sorular');
    } catch (e: any) {
      setHata(e.message);
      setAsama('foto');
    } finally {
      setIslemde(false);
    }
  };

  const taslakYukle = async (id: string) => {
    const { data } = await supabase
      .from('parti_taslak_satir')
      .select('*')
      .eq('taslak_id', id)
      .order('sira');
    const sat = (data ?? []) as TaslakSatir[];
    setSatirlar(sat);

    const ids = Array.from(
      new Set(sat.flatMap((x) => [x.product_id, ...x.aday_product_ids]).filter(Boolean))
    ) as string[];
    if (!ids.length) return;

    const { data: u } = await supabase
      .from('products')
      .select('id, name, code')
      .in('id', ids);
    setUrunler((prev) => {
      const m = new Map(prev);
      (u ?? []).forEach((x: any) => m.set(x.id, x));
      return m;
    });

    const { data: v } = await supabase
      .from('tedarikci_urun_varsayilan')
      .select('product_id, son_usd_fiyat')
      .in('product_id', ids);
    setGecmisFiyatlar(
      new Map(
        (v ?? [])
          .filter((x: any) => x.son_usd_fiyat != null)
          .map((x: any) => [x.product_id, Number(x.son_usd_fiyat)])
      )
    );
  };

  // ------------------------------------------------------------------
  // Katalog arama ("__ara__" seçeneği)
  // ------------------------------------------------------------------
  const araUrun = async (metin: string) => {
    setAramaMetni(metin);
    if (metin.trim().length < 2) return setAramaSonuc([]);
    const { data } = await supabase
      .from('products')
      .select('id, name, code')
      .eq('passive', false)
      .ilike('name', `%${metin.trim()}%`)
      .order('name')
      .limit(12);
    setAramaSonuc((data ?? []) as Urun[]);
  };

  const aramadanSec = async (u: Urun) => {
    if (!aramaSatirId) return;
    setUrunler((prev) => new Map(prev).set(u.id, u));
    await guncelle(aramaSatirId, {
      product_id: u.id,
      aday_product_ids: [],
      guven: 'kesin',
      onay_durumu: 'onayli',
    });
    setAramaSatirId(null);
    setAramaMetni('');
    setAramaSonuc([]);
    await taslakYukle(taslakId!);
    ilerle();
  };

  // ------------------------------------------------------------------
  // Cevap işleme
  // ------------------------------------------------------------------
  const ilerle = () => {
    const sonraki = soruIndex + 1;
    if (sonraki >= kuyruk.length) setAsama('ozet');
    else setSoruIndex(sonraki);
  };

  const cevapla = async (deger: string | number | null) => {
    if (islemde || !aktifSoru) return;
    setIslemde(true);
    setHata(null);
    try {
      if (aktifSoru.tip === 'toplu_onay') {
        await supabase
          .from('parti_taslak_satir')
          .update(
            deger === 'onayla'
              ? { onay_durumu: 'onayli' }
              : { guven: 'supheli' }
          )
          .in('id', aktifSoru.satirIds);
      } else if (aktifSoru.tip === 'urun_secimi') {
        if (deger === '__atla__') {
          await guncelle(aktifSoru.satirId, { onay_durumu: 'atlandi' });
        } else if (deger === '__yeni__') {
          await guncelle(aktifSoru.satirId, { onay_durumu: 'yeni_urun' });
        } else if (deger === '__ara__') {
          setAramaSatirId(aktifSoru.satirId);
          setIslemde(false);
          return;
        } else {
          await guncelle(aktifSoru.satirId, {
            product_id: deger as string,
            aday_product_ids: [],
            guven: 'kesin',
            onay_durumu: 'onayli',
          });
        }
      } else if (aktifSoru.tip === 'fiyat') {
        const fiyat =
          deger === null ? Number(serbestFiyat.replace(',', '.')) : Number(deger);
        if (!Number.isFinite(fiyat) || fiyat <= 0) {
          throw new Error("USD fiyat 0'dan büyük olmalı");
        }
        await guncelle(aktifSoru.satirId, {
          usd_fiyat: fiyat,
          fiyat_kaynagi: deger === null ? 'elle' : 'gecmis_parti',
          onay_durumu: 'onayli',
        });
        setSerbestFiyat('');
      } else if (aktifSoru.tip === 'sayim' && deger === 'foto') {
        setAsama('foto');
        setIslemde(false);
        return;
      }

      await taslakYukle(taslakId!);
      ilerle();
    } catch (e: any) {
      setHata(e.message);
    } finally {
      setIslemde(false);
    }
  };

  const guncelle = (id: string, alanlar: Record<string, unknown>) =>
    supabase.from('parti_taslak_satir').update(alanlar).eq('id', id);

  // ------------------------------------------------------------------
  // Commit
  // ------------------------------------------------------------------
  const partiyeEkle = async () => {
    if (islemde || !taslakId) return;
    setIslemde(true);
    setHata(null);
    try {
      const { data, error } = await supabase.rpc('parti_taslak_commit', {
        p_taslak_id: taslakId,
      });
      if (error) throw new Error(error.message);

      // Audit log — uygulamadaki logAction ile aynı tabloya
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('audit_log').insert({
        action: 'Fotoğraftan parti girişi yapıldı',
        entity_type: 'batch_items',
        entity_name: `${toptanci} / ${data} kalem`,
        user_email: auth.user?.email ?? '',
        details: {
          taslak_id: taslakId,
          eklenen_kalem: data,
          toplam_adet: toplamAdet,
          usd_kuru: usdKuru,
          yeni_urun: yeniUrunler.length,
          okunamayan_kutu: tanimlanamayan,
        },
        workspace: (satirlar as any)[0]?.workspace ?? undefined,
      });

      setAsama('bitti');
      onTamamlandi(Number(data));
    } catch (e: any) {
      setHata(e.message);
    } finally {
      setIslemde(false);
    }
  };

  const onayli = satirlar.filter((s) => s.onay_durumu === 'onayli');
  const yeniUrunler = satirlar.filter((s) => s.onay_durumu === 'yeni_urun');
  const toplamAdet = onayli.reduce((t, s) => t + s.bought, 0);
  const toplamUsd = onayli.reduce((t, s) => t + s.bought * (s.usd_fiyat ?? 0), 0);

  const ad = (s: TaslakSatir) =>
    s.product_id ? urunler.get(s.product_id)?.name ?? s.okunan_metin : s.okunan_metin;

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Fotoğraftan parti girişi
          </h2>
          {toptanci && (
            <p className="text-sm text-gray-500">
              {toptanci} · kur {usdKuru}
            </p>
          )}
        </div>
        <button
          onClick={onKapat}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Kapat
        </button>
      </div>

      {hata && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{hata}</div>
      )}

      {/* --- Katalog arama modalı --- */}
      {aramaSatirId && (
        <div className="mb-4 space-y-2 rounded-lg border border-gray-200 p-3">
          <input
            autoFocus
            value={aramaMetni}
            onChange={(e) => araUrun(e.target.value)}
            placeholder="Ürün adı ara…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto">
            {aramaSonuc.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => aramadanSec(u)}
                  className="w-full px-1 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                >
                  {u.name}
                  {u.code && <span className="ml-1 text-gray-500">({u.code})</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setAramaSatirId(null);
              setAramaMetni('');
              setAramaSonuc([]);
            }}
            className="text-sm text-gray-600 underline"
          >
            Vazgeç
          </button>
        </div>
      )}

      {asama === 'foto' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Kutuları üst üste gelmeyecek şekilde, ön yüzleri görünür halde çek.
            Birden fazla fotoğraf ekleyebilirsin — her fotoğraf farklı bir grup
            olmalı, aynı grubu iki açıdan çekme.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {fotolar.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.onizleme} alt="" className="h-24 w-full rounded-lg object-cover" />
                <button
                  onClick={() => setFotolar((p) => p.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
            {fotolar.length < MAX_FOTO && (
              <label className="flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400">
                Fotoğraf ekle
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => fotoEkle(e.target.files)}
                />
              </label>
            )}
          </div>

          <button
            onClick={analizEt}
            disabled={islemde || fotolar.length === 0}
            className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Analiz et
          </button>
        </div>
      )}

      {asama === 'analiz' && (
        <div className="py-10 text-center text-sm text-gray-600">
          Fotoğraflar okunuyor ve katalogla eşleştiriliyor…
        </div>
      )}

      {asama === 'sorular' && aktifSoru && !aramaSatirId && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-gray-100">
              <div
                className="h-1 rounded-full bg-gray-900 transition-all"
                style={{ width: `${((soruIndex + 1) / kuyruk.length) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-gray-500">
              {soruIndex + 1}/{kuyruk.length}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">{aktifSoru.baslik}</h3>
            <p className="mt-1 text-sm text-gray-600">{aktifSoru.aciklama}</p>
          </div>

          {aktifSoru.tip === 'toplu_onay' && (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm">
              {satirlar
                .filter((s) => aktifSoru.satirIds.includes(s.id))
                .map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="truncate text-gray-800">
                      {ad(s)}
                      {s.variant === 'cep_boy' && (
                        <span className="ml-1 text-gray-500">(cep boy)</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      {s.bought} ad{s.usd_fiyat != null && ` · ${s.usd_fiyat}$`}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          <div className="space-y-2">
            {aktifSoru.secenekler.map((sec) => (
              <button
                key={String(sec.deger)}
                onClick={() => cevapla(sec.deger)}
                disabled={islemde}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm disabled:opacity-40 ${
                  sec.vurgu
                    ? 'border-gray-900 bg-gray-900 font-medium text-white'
                    : 'border-gray-200 text-gray-800 hover:border-gray-400'
                }`}
              >
                {sec.etiket}
              </button>
            ))}

            {aktifSoru.tip === 'fiyat' && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={serbestFiyat}
                    onChange={(e) => setSerbestFiyat(e.target.value)}
                    placeholder="USD fiyat"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  />
                  <button
                    onClick={() => cevapla(null)}
                    disabled={islemde || !serbestFiyat}
                    className="rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Kaydet
                  </button>
                </div>
                {serbestFiyat && usdKuru > 0 && (
                  <p className="text-xs text-gray-500">
                    {Number(serbestFiyat.replace(',', '.'))} × {usdKuru} ={' '}
                    {(
                      Math.round(
                        Number(serbestFiyat.replace(',', '.')) * usdKuru * 100
                      ) / 100
                    ).toLocaleString('tr-TR')}{' '}
                    TL alış
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {asama === 'ozet' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Partiye eklenecek</h3>

          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
            {onayli.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate text-gray-800">
                  {ad(s)}
                  {s.variant === 'cep_boy' && (
                    <span className="ml-1 text-gray-500">(cep boy)</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-gray-600">
                  {s.bought} × {s.usd_fiyat}$
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Kalem</dt>
              <dd className="tabular-nums text-gray-900">{onayli.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Toplam adet</dt>
              <dd className="tabular-nums text-gray-900">{toplamAdet}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Toplam alış</dt>
              <dd className="tabular-nums text-gray-900">
                {toplamUsd.toFixed(2)} USD ·{' '}
                {(toplamUsd * usdKuru).toLocaleString('tr-TR', {
                  maximumFractionDigits: 2,
                })}{' '}
                TL
              </dd>
            </div>
          </dl>

          {(yeniUrunler.length > 0 || tanimlanamayan > 0) && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {yeniUrunler.length > 0 && (
                <p>
                  Katalogda olmayan {yeniUrunler.length} ürün bu partiye
                  girmiyor: {yeniUrunler.map((s) => s.okunan_metin).join(', ')}
                </p>
              )}
              {tanimlanamayan > 0 && (
                <p className="mt-1">{tanimlanamayan} kutu fotoğraftan okunamadı.</p>
              )}
              <p className="mt-1">
                Parti eksik kalem uyarısıyla işaretlenecek.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSoruIndex(0);
                setAsama('sorular');
              }}
              disabled={islemde}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-800 disabled:opacity-40"
            >
              Geri dön
            </button>
            <button
              onClick={partiyeEkle}
              disabled={islemde || onayli.length === 0}
              className="flex-[2] rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {islemde ? 'Ekleniyor…' : 'Partiye ekle'}
            </button>
          </div>
        </div>
      )}

      {asama === 'bitti' && (
        <div className="py-8 text-center text-sm text-gray-900">
          {toplamAdet} adet partiye eklendi.
        </div>
      )}
    </div>
  );
}

// Telefondan gelen 4MB'lık JPEG'i olduğu gibi göndermek maliyeti ve süreyi
// katlar, doğruluğa katkısı olmaz.
async function kucult(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const oran = Math.min(1, MAX_KENAR / Math.max(bitmap.width, bitmap.height));
  if (oran === 1 && file.size < 1_500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * oran);
  canvas.height = Math.round(bitmap.height * oran);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85)
  );
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

function base64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = () => rej(new Error('Fotoğraf okunamadı'));
    r.readAsDataURL(file);
  });
}
