# Stok-Takip — Claude Code çalışma kuralları

Bu dosyayı her oturumun başında oku. Buradaki kurallar, kullanıcının o anki
isteğiyle çelişiyorsa uygulamadan önce kullanıcıya sor.

## Proje

- Uygulamanın adı **Stok-Takip**. "Redline" ayrı bir proje, ayrı veritabanı ve
  ayrı uygulamadır; bu repoda Redline adını kullanma (package.json'daki eski
  `redline` adı hariç, ona dokunma).
- Parfüm işletmesinin stok, parti, satış, cari, tahsilat ve ödeme takibi.
- Canlı adres: https://stok-takip.liberyan.com
- Stack: Next.js 16 (App Router) + React 19 + Supabase (proje `cfkfaxgtqoswybazrwlx`) + Vercel.
- Deploy: `main` branch'e push → Vercel otomatik deploy. Diğer branch'ler Vercel
  preview deploy alır.

## Yetki: değişiklik talepleri

- Bu sistemde **admin** olan ve değişiklik talep edebilen kişiler yalnızca
  **Veli** ve **Aslı**'dır.
- Diğer kullanıcılar (alt satıcılar, Mihrimah dahil) sistemi kullanır ama
  yazılımda değişiklik istemez. Talep başka birinden geldiği belirtiliyorsa
  (örn. "Neşe şunu istiyor") değişikliği yapmadan önce Veli veya Aslı'nın
  onayını iste.
- Not: Bu kural asıl olarak GitHub repo erişimiyle uygulanır; repoya ve Claude
  Code'a yalnızca Veli ve Aslı erişebilir.

## Dosya yapısı

- `app/page.tsx` — Ana uygulama (tek büyük client component, `"use client"`).
  Giriş ekranı da burada (`Home` → `AppContent`).
- `app/galeri/page.tsx` — Galeri sayfası.
- `app/api/mcp/route.ts` — Claude ajanı için MCP sunucusu (bkz. aşağıda).
- `app/.well-known/oauth-protected-resource/api/mcp/route.ts` — MCP OAuth metadata.
- `app/oauth/consent/page.tsx` — Supabase OAuth 2.1 izin ekranı.
- `app/api/parti-analiz/route.ts` — Mevcut API route'u.
- `lib/supabase.ts` — Tarayıcı Supabase client'ı (`supabase`).

## Workspace kuralı

- İki workspace var: `kuzey` ve `guney`. Tüm tablolarda `workspace` kolonu var.
- **Varsayılan her zaman Güney.** Kuzey pasif; satıcılar Kuzey'in varlığını
  bilmiyor. Kullanıcı açıkça "Kuzey" demedikçe Kuzey'e dair kod, metin veya
  seçenek ekleme/gösterme.
- Güney, Kuzey'in ürün ve toptancı kataloğunu görebilir; Kuzey, Güney'in
  oluşturduğu hiçbir şeyi göremez.
- Erişim `workspace_access` tablosundan (email → workspaces) okunur.
- Depolar: Kuzey `Stok`; Güney `Adana-Depo`, `Samsun-Depo`, `Kars-Depo`.

## Veritabanı kuralları (dokunulmaz)

- `sales` tablosundaki `check_stock_before_sale` trigger'ı kalıcıdır. Stok asla
  sıfırın altına düşemez. Satış/stok mantığını değiştiren her kod bunu hesaba
  katmalı; trigger'ı kaldırma, devre dışı bırakma veya atlatma.
- RLS politikaları roller ve workspace ayrımını sağlar. Service role key ile
  RLS'i atlayan kod yazma; her zaman kullanıcının kendi oturumu/token'ı ile çalış.
- Çok satırlı okumalarda `.limit()` kullanma; PostgREST sınırına takılmamak için
  `fetchAllRows` (page.tsx) veya `hepsi` (route.ts) ile sayfalı çek.
- Stok hesabı: `get_sold_qty_by_batch_item` ve `get_sold_qty_by_product_batch`
  RPC'leri + batch_item_id'siz eski satışlar için greedy dağıtım
  (`getBatchSoldQtyForItem`). Bu mantığı değiştirme; gerekiyorsa iki yerde
  (page.tsx ve route.ts) birlikte değiştir.
- Cari mahsup: `mahsup_yenile(p_customer_id)` RPC'si (tek transaction, FIFO).
- Ürünlerde ml/boyut alanı yok; EDT/EDP/Intense/Elixir ayrı ürün kayıtlarıdır.
  Cep Boy aynı ürünün `variant = 'cep_boy'` alt kalemidir.

## Para hareketleri

- Birden fazla tabloyu güncelleyen para hareketleri (toptancı/kargo/diğer
  ödemeleri, kâr payı, ön sipariş avansı, ön siparişi satışa çevirme,
  toptancı iadeleri, satıcı transferleri) **Postgres fonksiyonu (RPC) olarak**
  yazılır ve hem page.tsx hem route.ts aynı RPC'yi çağırır. Bu mantığın
  TypeScript'te ikinci bir kopyasını yazma.
- Yeni RPC'leri SQL dosyası olarak `supabase/sql/` altına koy ve kullanıcıya
  Supabase SQL Editor'da çalıştırması için ver. Veritabanında kendin SQL
  çalıştırma.
- Veri düzeltmeleri doğrudan SQL ile yapılır; kullanıcıya SQL'i ver, önce
  etkilenecek satırları gösteren bir SELECT ile başla.

## Bilinen hata

- `addSaleFromForm` (page.tsx): satış birden fazla partiye bölündüğünde her
  satıra tutarın tamamını yazıyor (`total: totalPrice`). Doğrusu adet oranında
  bölmek (`totalPrice * take / qty`, son satıra yuvarlama farkı). route.ts'deki
  `satis_gir` doğru böler. Düzeltildiğinde bu maddeyi sil.

## page.tsx değişiklikleri

- Her teslimde uygulama alt başlığındaki sürüm numarasını bir artır
  (örn. v3.42 → v3.43) ve commit mesajına yaz.
- Mevcut yorumları ve Türkçe kullanıcı mesajlarını koru; yeni mesajlar da Türkçe.
- Async aksiyonlarda çift tıklamaya karşı `processing`/loading guard kullan.

## MCP ajanı (app/api/mcp/route.ts)

- Kullanıcılar Claude (iPhone/web) üzerinden custom connector ile bağlanır.
  Kimlik doğrulama Supabase OAuth 2.1 ile; her istek kullanıcının kendi
  token'ıyla çalışır (`baglam(ctx)`), RLS aynen geçerlidir.
- Yeni araç eklerken:
  - Uygulamadaki ilgili fonksiyonun kurallarını birebir uygula (doğrulamalar,
    audit_log, workspace).
  - Workspace parametresi her zaman `WS_PARAM`; varsayılan Güney.
  - Belirsiz ürün/cari/depo durumunda tahmin etme; `bul()` ile adayları
    listeleyip hata döndür ki Claude kullanıcıya sorsun.
  - Yazma araçlarının açıklamasında "çağırmadan önce özet göster ve açık onay al"
    ifadesi bulunmalı. Okuma araçlarına `annotations: { readOnlyHint: true }` ekle.
  - Toplu yazmalarda önce tümünü doğrula; tek insert ile yaz (ya hepsi ya hiçbiri).
  - audit_log kayıtları `logYaz()` ile; `details.kaynak = "Claude ajanı"` otomatik eklenir.
- Ajana **asla** verilmeyecek işlemler: silme, iptal, kayıt düzenleme, dönem
  kapanışı, açılış/devir bakiyesi değişikliği, kullanıcı/satıcı hesabı yönetimi.
- Araç listesi değiştiğinde kullanıcıya hatırlat: Claude'da Stok-Takip
  connector'ının bağlantısını kesip yeniden bağlamaları gerekebilir.

## Çalışma akışı

1. Her değişiklik için `main`'den yeni bir branch aç. **`main`'e doğrudan push etme.**
2. Değişikliği yap, `npm run build` çalıştır; build temiz değilse düzelt.
3. Commit + push (branch'e). Vercel preview adresini kullanıcıya söyle.
4. Kullanıcıya neyi değiştirdiğini ve nasıl test edeceğini kısa yaz.
5. `main`'e birleştirme kararı kullanıcınındır.
- Paket eklerken sürümü sabitle; en az 2 haftalık bir sürüm seç.
- `npm audit fix --force` çalıştırma.
- Repoya kişisel dosya, `.lnk`, Excel/yedek dosyası ekleme.
