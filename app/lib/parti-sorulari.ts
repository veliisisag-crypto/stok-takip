// lib/parti-sorulari.ts
//
// Taslak satırlarından soru kuyruğu üretir.
//
// Tasarım kuralı: başarı metriği doğruluk değil, SORU SAYISI.
// Cevabı zaten bilinen hiçbir şey sorulmaz; birden çok satırı aynı anda
// çözen sorular tek tek sorulanlardan önce gelir.

export type TaslakSatir = {
  id: string;
  sira: number;
  okunan_metin: string;
  product_id: string | null;
  aday_product_ids: string[];
  bought: number;
  variant: 'ana' | 'cep_boy';
  depo: string;
  usd_fiyat: number | null;
  fiyat_kaynagi: string | null;
  guven: 'kesin' | 'supheli' | 'eslesmedi';
  onay_durumu: 'bekliyor' | 'onayli' | 'yeni_urun' | 'atlandi';
};

export type Urun = { id: string; name: string; code?: string | null };

export type Secenek = {
  etiket: string;
  deger: string | number | null;
  vurgu?: boolean;
};

export type Soru =
  | { tip: 'toplu_onay'; anahtar: string; baslik: string; aciklama: string; satirIds: string[]; secenekler: Secenek[] }
  | { tip: 'urun_secimi'; anahtar: string; baslik: string; aciklama: string; satirId: string; secenekler: Secenek[] }
  | { tip: 'fiyat'; anahtar: string; baslik: string; aciklama: string; satirId: string; secenekler: Secenek[] }
  | { tip: 'sayim'; anahtar: string; baslik: string; aciklama: string; secenekler: Secenek[] };

export function soruKuyruguUret(
  satirlar: TaslakSatir[],
  urunler: Map<string, Urun>,
  tanimlanamayanKutu: number,
  gecmisFiyatlar: Map<string, number>
): Soru[] {
  const kuyruk: Soru[] = [];

  // 1. Kesinler — toplu onay. 15 satır tek dokunuşta geçer.
  const kesinler = satirlar.filter(
    (s) => s.guven === 'kesin' && s.onay_durumu === 'bekliyor'
  );
  if (kesinler.length > 0) {
    kuyruk.push({
      tip: 'toplu_onay',
      anahtar: 'kesin_onay',
      baslik: `${kesinler.length} ürün net okundu`,
      aciklama: `Toplam ${kesinler.reduce((t, s) => t + s.bought, 0)} adet.`,
      satirIds: kesinler.map((s) => s.id),
      secenekler: [
        { etiket: 'Hepsini onayla', deger: 'onayla', vurgu: true },
        { etiket: 'Tek tek gözden geçir', deger: 'incele' },
      ],
    });
  }

  // 2. Şüpheliler — adaylardan seçim
  for (const s of satirlar.filter(
    (x) => x.guven === 'supheli' && x.onay_durumu === 'bekliyor'
  )) {
    kuyruk.push({
      tip: 'urun_secimi',
      anahtar: `urun_${s.id}`,
      baslik: `"${s.okunan_metin}" — ${s.bought} adet`,
      aciklama: 'Hangi ürün?',
      satirId: s.id,
      secenekler: [
        ...s.aday_product_ids.map((id) => ({
          etiket: urunAdi(urunler, id),
          deger: id,
        })),
        { etiket: 'Listede yok — yeni ürün', deger: '__yeni__' },
        { etiket: 'Bu satırı atla', deger: '__atla__' },
      ],
    });
  }

  // 3. Eşleşmeyenler — sistemde yok
  for (const s of satirlar.filter(
    (x) => x.guven === 'eslesmedi' && x.onay_durumu === 'bekliyor'
  )) {
    kuyruk.push({
      tip: 'urun_secimi',
      anahtar: `yeni_${s.id}`,
      baslik: `"${s.okunan_metin}" — ${s.bought} adet`,
      aciklama:
        'Bu ürün katalogda bulunamadı. Yeni ürün olarak ayrı tutulacak, bu partiye girmeyecek.',
      satirId: s.id,
      secenekler: [
        { etiket: 'Yeni ürün olarak işaretle', deger: '__yeni__', vurgu: true },
        { etiket: 'Katalogdan arayıp seçeyim', deger: '__ara__' },
        { etiket: 'Bu satırı atla', deger: '__atla__' },
      ],
    });
  }

  // 4. USD fiyatı eksik olanlar. Katalogda fiyatı olan hiç sorulmaz.
  for (const s of satirlar.filter(
    (x) =>
      x.usd_fiyat == null &&
      x.onay_durumu !== 'atlandi' &&
      x.onay_durumu !== 'yeni_urun' &&
      (x.product_id != null || x.aday_product_ids.length > 0)
  )) {
    const secenekler: Secenek[] = [];
    const gecmis = s.product_id ? gecmisFiyatlar.get(s.product_id) : undefined;
    if (gecmis != null) {
      secenekler.push({
        etiket: `Geçen sefer: ${gecmis} USD`,
        deger: gecmis,
        vurgu: true,
      });
    }
    kuyruk.push({
      tip: 'fiyat',
      anahtar: `fiyat_${s.id}`,
      baslik: s.product_id ? urunAdi(urunler, s.product_id) : s.okunan_metin,
      aciklama:
        'Bu toptancı için ürün kartında USD fiyat yok. Alış fiyatı kaç USD?',
      satirId: s.id,
      secenekler,
    });
  }

  // 5. Sayım doğrulaması
  if (tanimlanamayanKutu > 0) {
    const listedeki = satirlar
      .filter((s) => s.onay_durumu !== 'atlandi')
      .reduce((t, s) => t + s.bought, 0);
    kuyruk.push({
      tip: 'sayim',
      anahtar: 'sayim',
      baslik: `${tanimlanamayanKutu} kutu okunamadı`,
      aciklama: `Listede ${listedeki} adet var. Fotoğrafta yazısı görünmeyen ${tanimlanamayanKutu} kutu daha var; partiye eksik kalem olarak işlenecek.`,
      secenekler: [
        { etiket: 'Anladım, devam et', deger: 'devam', vurgu: true },
        { etiket: 'Yeni fotoğraf ekleyeyim', deger: 'foto' },
      ],
    });
  }

  return kuyruk;
}

function urunAdi(urunler: Map<string, Urun>, id: string): string {
  const u = urunler.get(id);
  if (!u) return id;
  return u.code ? `${u.name} (${u.code})` : u.name;
}
