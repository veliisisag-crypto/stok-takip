import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// =====================================================================
// Stok-Takip MCP sunucusu
// Her istek, Claude'a giriş yapan kullanıcının KENDİ token'ıyla çalışır:
// RLS, roller, workspace kısıtları ve check_stock_before_sale trigger'ı
// uygulamadaki gibi aynen geçerlidir.
// =====================================================================

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// page.tsx ile aynı sabitler
const DEPOLAR: Record<string, string[]> = {
  kuzey: ["Stok"],
  guney: ["Adana-Depo", "Samsun-Depo", "Kars-Depo"],
};
const ORTAKLAR = (ws: string) => (ws === "guney" ? ["Veli", "Aslı"] : ["Veli", "Aslı", "Mihrimah"]);
const SATIS_TURLERI = ["Normal satış", "Fire/Bozuk", "Hibe"] as const;
const KAYNAK = "Claude ajanı";
const WS_PARAM = z.enum(["kuzey", "guney"]).optional()
  .describe("BOŞ BIRAK (varsayılan Güney). Sadece kullanıcı açıkça 'Kuzey' derse 'kuzey' ver.");

function supabaseFor(token: string) {
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
type SB = ReturnType<typeof supabaseFor>;

const metin = (text: string) => ({ content: [{ type: "text" as const, text }] });
const kucuk = (s: string) => (s || "").toLocaleLowerCase("tr").trim();
const tl = (n: number) => `${Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
const tarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
const yuvarla = (n: number) => Math.round(n * 100) / 100;
const AKTIF = "cancelled.is.null,cancelled.eq.false";

// PostgREST satır sınırına takılmadan tüm satırları çeker (page.tsx > fetchAllRows)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hepsi<T>(sorgu: () => any): Promise<T[]> {
  const boyut = 1000;
  let from = 0;
  let out: T[] = [];
  while (true) {
    const { data, error } = await sorgu().range(from, from + boyut - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out = out.concat(data as T[]);
    if (data.length < boyut) break;
    from += boyut;
  }
  return out;
}

// ---------------------------------------------------------------------
// Kullanıcı bağlamı
// ---------------------------------------------------------------------
type Baglam = { sb: SB; email: string; izinli: string[] };

async function baglam(ctx: { http?: { authInfo?: { token: string } } }): Promise<Baglam> {
  const token = ctx.http?.authInfo?.token;
  if (!token) throw new Error("Yetkisiz istek");
  const sb = supabaseFor(token);
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u.user?.email) throw new Error("Kullanıcı doğrulanamadı");
  const email = u.user.email.toLowerCase();
  const { data } = await sb.from("workspace_access").select("workspaces").eq("email", email).maybeSingle();
  const izinli: string[] = data?.workspaces?.length ? data.workspaces : ["kuzey"];
  return { sb, email, izinli };
}

// Varsayılan workspace GÜNEY. Kuzey pasif; sadece kullanıcı açıkça "Kuzey" derse kullanılır.
function varsayilanWs(b: Baglam) {
  return b.izinli.includes("guney") ? "guney" : b.izinli[0];
}
function okumaWs(b: Baglam, istenen?: string) {
  if (istenen) {
    if (!b.izinli.includes(istenen)) throw new Error(`"${istenen}" workspace'ine erişimin yok.`);
    return [istenen];
  }
  return [varsayilanWs(b)];
}
function yazmaWs(b: Baglam, istenen?: string) {
  return okumaWs(b, istenen)[0];
}
const wsAdi = (ws: string) => (ws === "guney" ? "Güney" : "KUZEY");
const katalogOf = (ws: string) => (ws === "guney" ? ["kuzey", "guney"] : ["kuzey"]);

// İsim / kod / id ile tek kayıt bul. Belirsizse adayları listeleyip hata verir.
function bul<T extends { id: string; name: string; code?: string | null }>(liste: T[], sorgu: string, tur: string): T {
  const q = kucuk(sorgu);
  const byId = liste.find((x) => x.id === sorgu);
  if (byId) return byId;
  const tam = liste.filter((x) => kucuk(x.name) === q || (x.code && kucuk(x.code) === q));
  if (tam.length === 1) return tam[0];
  const icerir = tam.length > 1 ? tam : liste.filter((x) => kucuk(x.name).includes(q) || (x.code && kucuk(x.code).includes(q)));
  if (icerir.length === 1) return icerir[0];
  if (icerir.length === 0) throw new Error(`"${sorgu}" ile eşleşen ${tur} bulunamadı.`);
  const adaylar = icerir.slice(0, 15).map((x) => `- ${x.name}${x.code ? ` (${x.code})` : ""}`).join("\n");
  throw new Error(`"${sorgu}" birden fazla ${tur} ile eşleşiyor, kullanıcıya hangisi olduğunu sor:\n${adaylar}`);
}

// ---------------------------------------------------------------------
// Veri tipleri
// ---------------------------------------------------------------------
type Urun = { id: string; name: string; code: string; gender_category: string | null; passive: boolean; manual_price: number | null };
type Kalem = {
  id: string; batch_id: string; product_id: string; bought: number; buy_price: number; sale_price: number;
  depo: string | null; variant: string | null; created_at: string;
};
type Musteri = { id: string; name: string; passive: boolean; seller_account_id: string | null };
type SaticiHesap = { id: string; name: string; email: string; active: boolean };
type Parti = { id: string; name: string; supplier_id: string | null; usd_kuru: number | null; created_at: string };
type Toptanci = { id: string; name: string };
type UrunFiyatli = Urun & { usd_fiyat_tyuksel: number | null; usd_fiyat_thasan: number | null; usd_fiyat_tamir: number | null };

// page.tsx sabitleri
const CEP_BOY_USD_FIYAT = 3;
const CEP_BOY_SATIS_FIYATI = 500;
const KATEGORILER = ["Kadın", "Erkek", "Unisex"] as const;

// page.tsx > getUsdPriceForBatch
function usdFiyatToptanciya(u: UrunFiyatli, toptanciAdi: string | undefined): number | null {
  if (toptanciAdi === "T-Yüksel") return u.usd_fiyat_tyuksel ?? null;
  if (toptanciAdi === "T-Hasan") return u.usd_fiyat_thasan ?? null;
  if (toptanciAdi === "T-Amir") return u.usd_fiyat_tamir ?? null;
  return null;
}
// page.tsx > varsayilanDepo
function varsayilanDepo(email: string, ws: string): string | null {
  if (ws !== "guney") return DEPOLAR[ws]?.[0] ?? null;
  if (email.includes("asli") || email.includes("aslı")) return "Samsun-Depo";
  if (email.includes("nese") || email.includes("neşe")) return "Adana-Depo";
  return null;
}
async function partileriGetir(sb: SB, ws: string) {
  return hepsi<Parti>(() => sb.from("batches").select("id,name,supplier_id,usd_kuru,created_at").eq("workspace", ws).order("created_at"));
}
async function toptancilariGetir(sb: SB, ws: string) {
  return hepsi<Toptanci>(() => sb.from("suppliers").select("id,name").in("workspace", katalogOf(ws)).order("name"));
}
async function fiyatliUrunler(sb: SB, ws: string) {
  return hepsi<UrunFiyatli>(() => sb.from("products")
    .select("id,name,code,gender_category,passive,manual_price,usd_fiyat_tyuksel,usd_fiyat_thasan,usd_fiyat_tamir")
    .in("workspace", katalogOf(ws)).order("created_at"));
}
// Fotoğraftan okunan ürün adlarını katalogla eşleştirmek için basit kelime benzerliği
const kelimeler = (s: string) => kucuk(s).replace(/[^a-z0-9çğıöşü]+/gi, " ").split(" ").filter((w) => w.length > 1);
function benzerlik(sorgu: string, aday: string) {
  const q = kelimeler(sorgu);
  const a = new Set(kelimeler(aday));
  if (q.length === 0) return 0;
  let eslesen = 0;
  for (const w of q) if (a.has(w) || [...a].some((x) => x.startsWith(w) || w.startsWith(x))) eslesen++;
  return eslesen / Math.max(q.length, a.size);
}
type SatisSatir = {
  id: string; customer_id: string; product_id: string; qty: number; total: number; sale_type: string;
  paid: boolean; paid_amount: number; variant: string | null; note: string | null; created_at: string;
};
type OdemeSatir = { id: string; customer_id: string; amount: number; payment_method: string | null; para_sahibi: string | null; created_at: string };

// ---------------------------------------------------------------------
// Stok hesabı — page.tsx > getBatchSoldQtyForItem ile birebir aynı mantık
// ---------------------------------------------------------------------
async function stokVerisi(sb: SB, ws: string) {
  const [urunler, kalemler, r1, r2] = await Promise.all([
    hepsi<Urun>(() => sb.from("products").select("id,name,code,gender_category,passive,manual_price").in("workspace", katalogOf(ws)).order("created_at")),
    hepsi<Kalem>(() => sb.from("batch_items").select("id,batch_id,product_id,bought,buy_price,sale_price,depo,variant,created_at").eq("workspace", ws).order("created_at")),
    sb.rpc("get_sold_qty_by_batch_item", { p_workspace: ws }),
    sb.rpc("get_sold_qty_by_product_batch", { p_workspace: ws }),
  ]);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);

  const byItem: Record<string, number> = {};
  for (const r of (r1.data || []) as { batch_item_id: string; toplam_satilan: number }[]) byItem[r.batch_item_id] = Number(r.toplam_satilan || 0);
  const byPB: Record<string, number> = {};
  for (const r of (r2.data || []) as { product_id: string; batch_id: string; toplam_satilan: number }[]) byPB[`${r.product_id}__${r.batch_id}`] = Number(r.toplam_satilan || 0);

  const satilan = (item: Kalem) => {
    const yeni = byItem[item.id] || 0;
    const eski = byPB[`${item.product_id}__${item.batch_id}`] || 0;
    if (eski === 0) return yeni;
    const kardesler = kalemler.filter((i) => i.product_id === item.product_id && i.batch_id === item.batch_id);
    if (kardesler.length <= 1) return yeni + eski;
    let kalan = eski;
    for (const k of [...kardesler].sort((a, b) => b.bought - a.bought)) {
      const ata = Math.min(k.bought, kalan);
      if (k.id === item.id) return yeni + ata;
      kalan -= ata;
    }
    return yeni;
  };
  const kalanOf = (item: Kalem) => Math.max(Number(item.bought) - satilan(item), 0);

  // ürün + varyant + depo bazında özet
  const urunMap = new Map(urunler.map((u) => [u.id, u]));
  const ozetMap = new Map<string, { urun: Urun; variant: string; depo: string; kalan: number }>();
  for (const item of kalemler) {
    const urun = urunMap.get(item.product_id);
    if (!urun) continue;
    const variant = item.variant || "ana";
    const depo = item.depo || "Stok";
    const key = `${item.product_id}|${variant}|${depo}`;
    const s = ozetMap.get(key) ?? { urun, variant, depo, kalan: 0 };
    s.kalan += kalanOf(item);
    ozetMap.set(key, s);
  }
  return { urunler, kalemler, kalanOf, ozet: [...ozetMap.values()] };
}

async function musterileriGetir(sb: SB, ws: string) {
  return hepsi<Musteri>(() => sb.from("customers").select("id,name,passive,seller_account_id").eq("workspace", ws).order("created_at"));
}
async function saticiHesaplari(sb: SB, ws: string) {
  return hepsi<SaticiHesap>(() => sb.from("seller_accounts").select("id,name,email,active").eq("workspace", ws).order("created_at"));
}

// "Para kimde?" seçeneğini doğrular ve uygulamadaki yazımıyla döndürür
function paraKimdeDogrula(deger: string | undefined, ws: string, saticilar: SaticiHesap[]) {
  const secenekler = ORTAKLAR(ws).concat(saticilar.map((s) => s.name));
  if (!deger) throw new Error(`"Para kimde?" zorunlu. Seçenekler: ${secenekler.join(", ")}. Kullanıcıya sor.`);
  const bulunan = secenekler.find((s) => kucuk(s) === kucuk(deger));
  if (!bulunan) throw new Error(`"${deger}" geçerli bir "Para kimde?" seçeneği değil. Seçenekler: ${secenekler.join(", ")}`);
  return bulunan;
}

async function logYaz(sb: SB, ws: string, email: string, action: string, entityType: string, entityName: string, details: Record<string, unknown>) {
  try {
    await sb.from("audit_log").insert({
      action, entity_type: entityType, entity_name: entityName, user_email: email,
      details: { ...details, kaynak: KAYNAK }, workspace: ws,
    });
  } catch {
    // uygulamadaki gibi: log yazılamazsa işlemi bozma
  }
}

// =====================================================================
// MCP sunucusu
// =====================================================================
const mcp = createMcpHandler(
  (server) => {
    // -----------------------------------------------------------------
    server.registerTool(
      "kim_olarak_bagliyim",
      {
        title: "Bağlantı bilgisi",
        description: "Stok-Takip'e hangi kullanıcıyla bağlı olunduğunu, rolünü ve erişilebilen workspace'leri gösterir.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async (_args, ctx) => {
        const b = await baglam(ctx);
        const satirlar = [`Kullanıcı: ${b.email}`];
        for (const ws of [varsayilanWs(b)]) {
          const saticilar = await saticiHesaplari(b.sb, ws);
          const ben = saticilar.find((s) => s.active && kucuk(s.email) === b.email);
          satirlar.push(`${wsAdi(ws)} rolü: ${ben ? `satıcı (${ben.name})` : "yönetici/ortak"} — depolar: ${DEPOLAR[ws].join(", ")}`);
        }
        return metin(satirlar.join("\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "stok_sorgula",
      {
        title: "Stok sorgula",
        description:
          "Kalan stoku ürün, varyant (normal / Cep Boy) ve depo bazında gösterir. Ürün adı veya kodunun bir kısmıyla aranabilir; " +
          "boş bırakılırsa stokta olan tüm ürünler listelenir.",
        inputSchema: z.object({
          urun: z.string().optional().describe("Ürün adı veya kodunun bir kısmı"),
          depo: z.string().optional().describe("'Adana-Depo', 'Samsun-Depo' veya 'Kars-Depo'"),
          workspace: WS_PARAM,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ urun, depo, workspace }, ctx) => {
        const b = await baglam(ctx);
        const arama = urun ? kucuk(urun) : "";
        const bloklar: string[] = [];
        for (const ws of okumaWs(b, workspace)) {
          const { ozet } = await stokVerisi(b.sb, ws);
          let satirlar = ozet.filter((s) =>
            (!arama || kucuk(s.urun.name).includes(arama) || kucuk(s.urun.code).includes(arama)) &&
            (!depo || kucuk(s.depo) === kucuk(depo))
          );
          if (!arama) satirlar = satirlar.filter((s) => s.kalan > 0);
          satirlar.sort((a, b2) => a.urun.name.localeCompare(b2.urun.name, "tr") || a.depo.localeCompare(b2.depo, "tr"));
          if (satirlar.length === 0) {
            bloklar.push(`${wsAdi(ws)}: eşleşen stok kaydı yok.`);
            continue;
          }
          const toplam = satirlar.reduce((t, s) => t + s.kalan, 0);
          const govde = satirlar.slice(0, 300).map((s) =>
            `- ${s.urun.name}${s.urun.code ? ` (${s.urun.code})` : ""}${s.variant === "cep_boy" ? " [Cep Boy]" : ""} | ${s.depo}: ${s.kalan} adet${s.urun.passive ? " (pasif)" : ""}`
          );
          if (satirlar.length > 300) govde.push(`... ve ${satirlar.length - 300} satır daha (aramayı daralt)`);
          bloklar.push(`${wsAdi(ws)} — toplam ${toplam} adet\n${govde.join("\n")}`);
        }
        return metin(bloklar.join("\n\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "urun_ara",
      {
        title: "Ürün ara",
        description:
          "Ürün kataloğunda arama yapar: ad, kod, kategori, toplam kalan stok ve son partideki satış fiyatı. " +
          "Satış girmeden önce doğru ürünü ve fiyatı bulmak için kullan.",
        inputSchema: z.object({
          sorgu: z.string().describe("Ürün adı veya kodunun bir kısmı"),
          workspace: WS_PARAM,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ sorgu, workspace }, ctx) => {
        const b = await baglam(ctx);
        const q = kucuk(sorgu);
        const bloklar: string[] = [];
        for (const ws of okumaWs(b, workspace)) {
          const { urunler, kalemler, kalanOf } = await stokVerisi(b.sb, ws);
          const eslesen = urunler.filter((u) => kucuk(u.name).includes(q) || kucuk(u.code).includes(q)).slice(0, 50);
          if (eslesen.length === 0) {
            bloklar.push(`${wsAdi(ws)}: "${sorgu}" ile eşleşen ürün yok.`);
            continue;
          }
          const satirlar = eslesen.map((u) => {
            const kendi = kalemler.filter((k) => k.product_id === u.id);
            const ana = kendi.filter((k) => (k.variant || "ana") === "ana");
            const cep = kendi.filter((k) => k.variant === "cep_boy");
            const stokAna = ana.reduce((t, k) => t + kalanOf(k), 0);
            const stokCep = cep.reduce((t, k) => t + kalanOf(k), 0);
            const sonFiyat = ana.length ? ana[ana.length - 1].sale_price : null;
            return `- ${u.name}${u.code ? ` (${u.code})` : ""} | ${u.gender_category ?? "-"} | stok: ${stokAna}` +
              (stokCep ? ` + Cep Boy ${stokCep}` : "") +
              (sonFiyat ? ` | son parti satış fiyatı: ${tl(sonFiyat)}` : "") +
              (u.manual_price ? ` | manuel fiyat: ${tl(u.manual_price)}` : "") +
              (u.passive ? " | PASİF" : "");
          });
          bloklar.push(`${wsAdi(ws)}\n${satirlar.join("\n")}`);
        }
        return metin(bloklar.join("\n\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "musteri_ara",
      {
        title: "Cari / müşteri ara",
        description:
          "Carileri (müşterileri) bakiyeleriyle listeler. Pozitif bakiye = müşterinin borcu, negatif = müşterinin bizde alacağı. " +
          "Arama tek bir cariye denk gelirse son satışları ve ödemeleri de gösterir. sadece_borclular=true ile borçlu cariler listelenir.",
        inputSchema: z.object({
          sorgu: z.string().optional().describe("Cari adının bir kısmı"),
          sadece_borclular: z.boolean().optional(),
          workspace: WS_PARAM,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ sorgu, sadece_borclular, workspace }, ctx) => {
        const b = await baglam(ctx);
        const q = sorgu ? kucuk(sorgu) : "";
        const bloklar: string[] = [];
        for (const ws of okumaWs(b, workspace)) {
          const [musteriler, satislar, odemeler] = await Promise.all([
            musterileriGetir(b.sb, ws),
            hepsi<SatisSatir>(() => b.sb.from("sales").select("id,customer_id,product_id,qty,total,sale_type,paid,paid_amount,variant,note,created_at").eq("workspace", ws).or(AKTIF).order("created_at", { ascending: false })),
            hepsi<OdemeSatir>(() => b.sb.from("payments").select("id,customer_id,amount,payment_method,para_sahibi,created_at").eq("workspace", ws).or(AKTIF).order("created_at", { ascending: false })),
          ]);
          const satisT: Record<string, number> = {};
          for (const s of satislar) satisT[s.customer_id] = (satisT[s.customer_id] || 0) + Number(s.total || 0);
          const odemeT: Record<string, number> = {};
          for (const o of odemeler) odemeT[o.customer_id] = (odemeT[o.customer_id] || 0) + Number(o.amount || 0);
          const bakiye = (id: string) => yuvarla((satisT[id] || 0) - (odemeT[id] || 0));

          let liste = musteriler.filter((m) => !q || kucuk(m.name).includes(q));
          if (sadece_borclular) liste = liste.filter((m) => bakiye(m.id) > 0);
          liste.sort((a, c) => bakiye(c.id) - bakiye(a.id));
          if (liste.length === 0) {
            bloklar.push(`${wsAdi(ws)}: eşleşen cari yok.`);
            continue;
          }
          const toplamBorc = liste.reduce((t, m) => t + Math.max(bakiye(m.id), 0), 0);
          const govde = liste.slice(0, 150).map((m) => {
            const bk = bakiye(m.id);
            const durum = bk > 0 ? `borç ${tl(bk)}` : bk < 0 ? `alacaklı ${tl(-bk)}` : "bakiye 0";
            return `- ${m.name}: ${durum}${m.passive ? " (pasif)" : ""}`;
          });
          let blok = `${wsAdi(ws)} — ${liste.length} cari, toplam borç ${tl(toplamBorc)}\n${govde.join("\n")}`;

          if (liste.length === 1) {
            const m = liste[0];
            const { urunler } = await stokVerisi(b.sb, ws);
            const urunAd = new Map(urunler.map((u) => [u.id, u.name]));
            const sonSatis = satislar.filter((s) => s.customer_id === m.id).slice(0, 10).map((s) =>
              `  • ${tarih(s.created_at)} ${s.variant === "cep_boy" ? "Cep-" : ""}${urunAd.get(s.product_id) ?? "?"} x${s.qty} = ${tl(s.total)} (${s.sale_type}${s.paid ? ", ödendi" : ""})`);
            const sonOdeme = odemeler.filter((o) => o.customer_id === m.id).slice(0, 10).map((o) =>
              `  • ${tarih(o.created_at)} ${tl(o.amount)} ${o.payment_method ?? ""}${o.para_sahibi ? ` (kimde: ${o.para_sahibi})` : ""}`);
            blok += `\n\nSon satışlar:\n${sonSatis.join("\n") || "  yok"}\nSon ödemeler:\n${sonOdeme.join("\n") || "  yok"}`;
          }
          bloklar.push(blok);
        }
        return metin(bloklar.join("\n\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "satislari_listele",
      {
        title: "Satışları listele",
        description:
          "Belirli tarih aralığındaki satışları listeler ve toplamlarını verir (adet, ciro, tahsil edilmemiş tutar). " +
          "Tarih verilmezse son 30 gün. Cari ve ürüne göre filtrelenebilir. İptal edilmiş satışlar dahil edilmez.",
        inputSchema: z.object({
          baslangic: z.string().optional().describe("YYYY-MM-DD"),
          bitis: z.string().optional().describe("YYYY-MM-DD (dahil)"),
          musteri: z.string().optional().describe("Cari adı"),
          urun: z.string().optional().describe("Ürün adı veya kodu"),
          workspace: WS_PARAM,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ baslangic, bitis, musteri, urun, workspace }, ctx) => {
        const b = await baglam(ctx);
        const bas = baslangic ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const bit = bitis ?? new Date().toISOString().slice(0, 10);
        const bloklar: string[] = [];
        for (const ws of okumaWs(b, workspace)) {
          const [musteriler, { urunler }] = await Promise.all([musterileriGetir(b.sb, ws), stokVerisi(b.sb, ws)]);
          const m = musteri ? bul(musteriler, musteri, "cari") : undefined;
          const u = urun ? bul(urunler, urun, "ürün") : undefined;
          const satislar = await hepsi<SatisSatir>(() => {
            let s = b.sb.from("sales").select("id,customer_id,product_id,qty,total,sale_type,paid,paid_amount,variant,note,created_at")
              .eq("workspace", ws).or(AKTIF)
              .gte("created_at", `${bas}T00:00:00+03:00`).lte("created_at", `${bit}T23:59:59+03:00`)
              .order("created_at", { ascending: false });
            if (m) s = s.eq("customer_id", m.id);
            if (u) s = s.eq("product_id", u.id);
            return s;
          });
          const mAd = new Map(musteriler.map((x) => [x.id, x.name]));
          const uAd = new Map(urunler.map((x) => [x.id, x.name]));
          const adet = satislar.reduce((t, s) => t + Number(s.qty), 0);
          const ciro = satislar.reduce((t, s) => t + Number(s.total || 0), 0);
          const acik = satislar.reduce((t, s) => t + Math.max(Number(s.total || 0) - Number(s.paid_amount || 0), 0), 0);
          const govde = satislar.slice(0, 200).map((s) =>
            `- ${tarih(s.created_at)} | ${mAd.get(s.customer_id) ?? "?"} | ${s.variant === "cep_boy" ? "Cep-" : ""}${uAd.get(s.product_id) ?? "?"} x${s.qty} | ${tl(s.total)} | ${s.sale_type}${s.paid ? "" : " | ödenmedi"}${s.note ? ` | not: ${s.note}` : ""}`);
          if (satislar.length > 200) govde.push(`... ve ${satislar.length - 200} satış daha (aralığı daralt)`);
          bloklar.push(`${wsAdi(ws)} — ${bas} / ${bit}: ${satislar.length} satır, ${adet} adet, ciro ${tl(ciro)}, tahsil edilmemiş ${tl(acik)}\n${govde.join("\n") || "satış yok"}`);
        }
        return metin(bloklar.join("\n\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "musteri_ekle",
      {
        title: "Yeni cari ekle",
        description: "Yeni cari (müşteri) kaydı açar. Kaydetmeden önce adı kullanıcıya teyit ettir.",
        inputSchema: z.object({
          ad: z.string().describe("Cari adı (en fazla 50 karakter)"),
          workspace: WS_PARAM,
        }),
      },
      async ({ ad, workspace }, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, workspace);
        const name = ad.trim();
        if (!name || name.length > 50) throw new Error("Cari adı zorunlu ve en fazla 50 karakter olmalı.");
        const [musteriler, saticilar] = await Promise.all([musterileriGetir(b.sb, ws), saticiHesaplari(b.sb, ws)]);
        if (musteriler.some((m) => kucuk(m.name) === kucuk(name))) throw new Error(`"${name}" zaten kayıtlı.`);
        const ben = saticilar.find((s) => s.active && kucuk(s.email) === b.email);
        const { error } = await b.sb.from("customers").insert({
          name, seller_account_id: ben?.id ?? null, created_by: b.email, workspace: ws,
        });
        if (error) throw new Error(error.message);
        await logYaz(b.sb, ws, b.email, "Cari eklendi", "customers", name, {});
        return metin(`${wsAdi(ws)}: "${name}" carisi eklendi.`);
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "satis_gir",
      {
        title: "Satış gir",
        description:
          "Yeni satış kaydeder (uygulamadaki 'Yeni Satış Girişi' ile aynı kurallar). Stok en eski partiden (FIFO) düşülür. " +
          "ÖNEMLİ: Çağırmadan önce cari, ürün, adet, depo, toplam tutar, ödeme şekli ve 'para kimde' bilgisini kullanıcıya " +
          "özetle ve açık onay al. Eksik bilgi varsa tahmin etme, sor. Ürün/cari belirsizse önce urun_ara / musteri_ara kullan.",
        inputSchema: z.object({
          musteri: z.string().describe("Cari adı (kayıtlı olmalı; yoksa önce musteri_ekle)"),
          urun: z.string().describe("Ürün adı veya kodu"),
          adet: z.number().int().positive(),
          toplam_tutar: z.number().nonnegative().optional().describe("Satışın TOPLAM tutarı (TL). Normal satışta zorunlu; Hibe ve Fire/Bozuk'ta 0 kabul edilir"),
          satis_turu: z.enum(SATIS_TURLERI).default("Normal satış"),
          odeme: z.enum(["veresiye", "nakit", "banka"]).describe("veresiye = ödenmedi, cariye borç yazılır"),
          para_kimde: z.string().optional().describe("Nakit/banka ödemede zorunlu: paranın kimde olduğu"),
          depo: z.string().optional().describe("Belirtilmezse ürünün stoğu tek depodaysa o seçilir"),
          varyant: z.enum(["ana", "cep_boy"]).default("ana").describe("cep_boy = Cep Boy (küçük boy)"),
          satisi_yapan: z.string().optional().describe("Sadece yönetici/ortak kullanıcılar için: 'Aslı', 'Mihrimah' veya bir alt satıcının adı"),
          satici_kari: z.number().nonnegative().optional().describe("Alt satıcı satışlarında satıcı komisyonu / satıcının kendi kârı (TL, toplam)"),
          aciklama: z.string().optional().describe("Hibe ve Fire/Bozuk satışlarda zorunlu"),
          workspace: WS_PARAM,
          yine_de_kaydet: z.boolean().optional().describe("Mükerrer uyarısından sonra kullanıcı onaylarsa true"),
        }),
      },
      async (a, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, a.workspace);
        const sifirFiyat = a.satis_turu === "Hibe" || a.satis_turu === "Fire/Bozuk";
        if (sifirFiyat && !a.aciklama?.trim()) throw new Error("Hibe / Fire-Bozuk satışlarda açıklama zorunlu. Kullanıcıya sor.");
        if (!sifirFiyat && (a.toplam_tutar === undefined || a.toplam_tutar <= 0)) throw new Error("Normal satışta toplam tutar zorunlu. Kullanıcıya sor.");

        const [musteriler, saticilar, stok] = await Promise.all([musterileriGetir(b.sb, ws), saticiHesaplari(b.sb, ws), stokVerisi(b.sb, ws)]);
        const musteri = bul(musteriler, a.musteri, "cari");
        const urun = bul(stok.urunler, a.urun, "ürün");
        const odendi = a.odeme !== "veresiye";
        const paraKimde = odendi && !sifirFiyat ? paraKimdeDogrula(a.para_kimde, ws, saticilar) : null;

        // Rol: page.tsx > currentSellerAccount / selectedSubSeller
        const ben = saticilar.find((s) => s.active && kucuk(s.email) === b.email);
        let altSatici: SaticiHesap | undefined;
        let ortakSatici: string | null = null;
        if (!ben) {
          if (a.satisi_yapan) {
            altSatici = saticilar.find((s) => kucuk(s.name) === kucuk(a.satisi_yapan!));
            if (!altSatici) {
              const ortak = ["Aslı", "Mihrimah"].find((o) => kucuk(o) === kucuk(a.satisi_yapan!));
              if (!ortak) throw new Error(`"${a.satisi_yapan}" tanınmadı. Seçenekler: Aslı, Mihrimah, ${saticilar.map((s) => s.name).join(", ")}`);
              ortakSatici = ortak;
            }
          } else {
            ortakSatici = b.email.includes("mihrimah") ? "Mihrimah" : "Aslı";
          }
        }
        const saticiHesapId = ben?.id ?? altSatici?.id ?? null;
        const saticiKarAkisi = !!ben || !!altSatici;

        // Depo seçimi
        const varyant = a.varyant;
        const urunKalemleri = stok.kalemler.filter((k) => k.product_id === urun.id && (k.variant || "ana") === varyant);
        let depo = a.depo;
        if (depo) {
          const gecerli = DEPOLAR[ws].find((d) => kucuk(d) === kucuk(depo!));
          if (!gecerli) throw new Error(`"${depo}" geçerli depo değil. ${wsAdi(ws)} depoları: ${DEPOLAR[ws].join(", ")}`);
          depo = gecerli;
        } else {
          const depoStok = new Map<string, number>();
          for (const k of urunKalemleri) depoStok.set(k.depo || "Stok", (depoStok.get(k.depo || "Stok") || 0) + stok.kalanOf(k));
          const dolu = [...depoStok.entries()].filter(([, n]) => n > 0);
          if (dolu.length === 0) throw new Error(`${urun.name}${varyant === "cep_boy" ? " (Cep Boy)" : ""} için ${wsAdi(ws)}'de stok yok.`);
          if (dolu.length > 1) throw new Error(`Bu ürün birden fazla depoda var (${dolu.map(([d, n]) => `${d}: ${n}`).join(", ")}). Hangi depodan satıldığını kullanıcıya sor.`);
          depo = dolu[0][0];
        }
        const uygun = urunKalemleri.filter((k) => (k.depo || "Stok") === depo);
        const depoStogu = uygun.reduce((t, k) => t + stok.kalanOf(k), 0);
        if (depoStogu < a.adet) throw new Error(`Yetersiz stok. ${depo} deposunda bu üründen${varyant === "cep_boy" ? " (Cep Boy)" : ""} sadece ${depoStogu} adet var.`);

        // Mükerrer kontrolü (son 3 dakika, aynı cari + ürün + adet)
        if (!a.yine_de_kaydet) {
          const { data: yakin } = await b.sb.from("sales").select("id")
            .eq("customer_id", musteri.id).eq("product_id", urun.id).or(AKTIF)
            .gte("created_at", new Date(Date.now() - 3 * 60000).toISOString());
          if (yakin && yakin.length > 0) {
            throw new Error(`Son 3 dakika içinde ${musteri.name} için ${urun.name} satışı zaten girilmiş. Mükerrer olabilir; kullanıcı yine de istiyorsa yine_de_kaydet=true ile tekrar çağır.`);
          }
        }

        // Satır oluşturma (FIFO). Tutar ve satıcı kârı satırlara adet oranında bölünür.
        const toplam = sifirFiyat ? 0 : Number(a.toplam_tutar);
        const saticiKariToplam = saticiKarAkisi && !sifirFiyat ? Number(a.satici_kari || 0) : 0;
        const satirlar: Record<string, unknown>[] = [];
        let kalanAdet = a.adet;
        let dagitilanTutar = 0;
        let dagitilanKar = 0;
        for (const item of uygun) {
          if (kalanAdet <= 0) break;
          const al = Math.min(stok.kalanOf(item), kalanAdet);
          if (al <= 0) continue;
          kalanAdet -= al;
          const sonSatir = kalanAdet === 0;
          const satirTutar = sonSatir ? yuvarla(toplam - dagitilanTutar) : yuvarla((toplam * al) / a.adet);
          const satirKar = sonSatir ? yuvarla(saticiKariToplam - dagitilanKar) : yuvarla((saticiKariToplam * al) / a.adet);
          dagitilanTutar += satirTutar;
          dagitilanKar += satirKar;
          const satirOdendi = odendi || sifirFiyat;
          satirlar.push({
            customer_id: musteri.id,
            product_id: urun.id,
            batch_id: item.batch_id,
            batch_item_id: item.id,
            seller: saticiKarAkisi ? null : ortakSatici,
            sale_type: a.satis_turu,
            qty: al,
            total: satirTutar,
            cost: Number(item.buy_price) * al + satirKar,
            paid: satirOdendi,
            paid_amount: satirOdendi ? satirTutar : 0,
            payment_method: odendi ? a.odeme : null,
            seller_account_id: saticiHesapId,
            seller_profit: saticiKarAkisi ? satirKar : null,
            note: sifirFiyat ? a.aciklama!.trim() : null,
            variant: varyant,
            cancelled: false,
            workspace: ws,
          });
        }
        if (kalanAdet > 0) throw new Error("Parti stokları yetersiz.");

        const { error } = await b.sb.from("sales").insert(satirlar);
        if (error) throw new Error(`Satış kaydedilemedi: ${error.message}`);

        const uyarilar: string[] = [];
        if (odendi && a.satis_turu === "Normal satış" && toplam > 0) {
          const { error: payErr } = await b.sb.from("payments").insert({
            customer_id: musteri.id, amount: toplam, user_email: b.email, cancelled: false,
            payment_method: a.odeme, kasa_tutari: toplam, para_sahibi: paraKimde,
            seller_account_id: saticiHesapId, workspace: ws,
          });
          if (payErr) uyarilar.push(`Satış kaydedildi ama tahsilat kaydı açılamadı: ${payErr.message}. Uygulamadan kontrol edilmeli.`);
        }
        // Avans/açıkta kalan ödemeleri bu satışa da dağıt (page.tsx > allocatePaymentsForCustomer)
        const { error: mahsupErr } = await b.sb.rpc("mahsup_yenile", { p_customer_id: musteri.id });
        if (mahsupErr) uyarilar.push(`Mahsup yenilenemedi: ${mahsupErr.message}`);

        const etiket = `${musteri.name} - ${varyant === "cep_boy" ? "Cep-" : ""}${urun.name}`;
        await logYaz(b.sb, ws, b.email, "Satış eklendi", "sales", etiket, { adet: a.adet, toplam, satir_sayisi: satirlar.length });

        return metin(
          `${wsAdi(ws)}: Satış kaydedildi — ${etiket} x${a.adet}, ${depo}, ${tl(toplam)}, ${a.satis_turu}, ` +
          `${odendi ? `${a.odeme} (kimde: ${paraKimde ?? "-"})` : "veresiye"}` +
          (uyarilar.length ? `\nUYARI:\n${uyarilar.join("\n")}` : "")
        );
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "odeme_al",
      {
        title: "Tahsilat / ödeme gir",
        description:
          "Bir cariden alınan ödemeyi kaydeder ve açık satışlara FIFO mahsup eder (uygulamadaki 'Ödeme Ekle' ile aynı). " +
          "Çağırmadan önce cari, tutar, yöntem ve 'para kimde' bilgisini kullanıcıya özetleyip açık onay al.",
        inputSchema: z.object({
          musteri: z.string().describe("Cari adı"),
          tutar: z.number().positive().describe("TL"),
          yontem: z.enum(["nakit", "banka"]),
          para_kimde: z.string().describe("Paranın kimde olduğu"),
          workspace: WS_PARAM,
          yine_de_kaydet: z.boolean().optional().describe("Mükerrer veya fazla ödeme uyarısından sonra kullanıcı onaylarsa true"),
        }),
      },
      async (a, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, a.workspace);
        const [musteriler, saticilar] = await Promise.all([musterileriGetir(b.sb, ws), saticiHesaplari(b.sb, ws)]);
        const musteri = bul(musteriler, a.musteri, "cari");
        const paraKimde = paraKimdeDogrula(a.para_kimde, ws, saticilar);
        const ben = saticilar.find((s) => s.active && kucuk(s.email) === b.email);

        if (!a.yine_de_kaydet) {
          const [satislar, odemeler] = await Promise.all([
            hepsi<{ total: number }>(() => b.sb.from("sales").select("total").eq("customer_id", musteri.id).or(AKTIF)),
            hepsi<{ amount: number; created_at: string }>(() => b.sb.from("payments").select("amount,created_at").eq("customer_id", musteri.id).or(AKTIF)),
          ]);
          const simdi = Date.now();
          if (odemeler.some((o) => Number(o.amount) === a.tutar && simdi - new Date(o.created_at).getTime() < 3 * 60000)) {
            throw new Error(`${musteri.name} için son 3 dakika içinde aynı tutarda (${tl(a.tutar)}) ödeme zaten girilmiş. Mükerrer olabilir; kullanıcı yine de istiyorsa yine_de_kaydet=true ile tekrar çağır.`);
          }
          const satisT = satislar.reduce((t, s) => t + Number(s.total || 0), 0);
          const odemeT = odemeler.reduce((t, o) => t + Number(o.amount || 0), 0);
          if (odemeT + a.tutar > satisT) {
            throw new Error(`Bu ödeme ${musteri.name} carisinin toplam satışını ${tl(odemeT + a.tutar - satisT)} aşıyor (müşteri alacaklı duruma düşer). Kullanıcı yine de istiyorsa yine_de_kaydet=true ile tekrar çağır.`);
          }
        }

        const { error } = await b.sb.from("payments").insert({
          customer_id: musteri.id, amount: a.tutar, user_email: b.email, payment_method: a.yontem,
          kasa_tutari: a.tutar, para_sahibi: paraKimde, seller_account_id: ben?.id ?? null, workspace: ws,
        });
        if (error) throw new Error(`Ödeme kaydedilemedi: ${error.message}`);
        const { error: mahsupErr } = await b.sb.rpc("mahsup_yenile", { p_customer_id: musteri.id });

        await logYaz(b.sb, ws, b.email, "Ödeme eklendi", "payments", musteri.name, {
          tutar: a.tutar, yontem: a.yontem === "nakit" ? "Nakit" : "Banka", kimde: paraKimde,
        });
        return metin(
          `${wsAdi(ws)}: ${musteri.name} carisinden ${tl(a.tutar)} ${a.yontem} tahsilat kaydedildi (kimde: ${paraKimde}).` +
          (mahsupErr ? `\nUYARI: Ödeme kaydedildi ama mahsup yenilenemedi: ${mahsupErr.message}. Uygulamadan kontrol edilmeli.` : "")
        );
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "urunleri_eslestir",
      {
        title: "Ürün adlarını katalogla eşleştir",
        description:
          "Bir liste ürün adını (örn. fotoğraftan okunan marka + model + EDT/EDP) katalogdaki ürünlerle eşleştirir; her biri için en iyi 3 adayı " +
          "benzerlik puanı ve mevcut stokla döndürür. Fotoğraftan toplu stok girişinde partiye_toplu_ekle'den ÖNCE kullan.",
        inputSchema: z.object({
          adlar: z.array(z.string()).min(1).max(60).describe("Tespit edilen ürün adları, örn. 'Dior Sauvage EDT'"),
          workspace: WS_PARAM,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ adlar, workspace }, ctx) => {
        const b = await baglam(ctx);
        const ws = okumaWs(b, workspace)[0];
        const { urunler, kalemler, kalanOf } = await stokVerisi(b.sb, ws);
        const aktifUrunler = urunler.filter((u) => !u.passive);
        const stokOf = (id: string) => kalemler.filter((k) => k.product_id === id).reduce((t, k) => t + kalanOf(k), 0);
        const satirlar = adlar.map((ad) => {
          const adaylar = aktifUrunler
            .map((u) => ({ u, p: benzerlik(ad, `${u.name} ${u.code}`) }))
            .filter((x) => x.p > 0)
            .sort((x, y) => y.p - x.p)
            .slice(0, 3);
          if (adaylar.length === 0) return `• "${ad}": katalogda benzeri YOK (yeni ürün tanımı gerekebilir)`;
          return `• "${ad}":\n` + adaylar.map((x) => `    - ${x.u.name} (${x.u.code}) | benzerlik %${Math.round(x.p * 100)} | stok ${stokOf(x.u.id)}`).join("\n");
        });
        return metin(satirlar.join("\n"));
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "partileri_listele",
      {
        title: "Partileri listele",
        description: "Partileri toptancı, USD kuru ve kalem sayısıyla listeler (en yeni önce). Toptancı listesini de verir.",
        inputSchema: z.object({ workspace: WS_PARAM }),
        annotations: { readOnlyHint: true },
      },
      async ({ workspace }, ctx) => {
        const b = await baglam(ctx);
        const ws = okumaWs(b, workspace)[0];
        const [partiler, toptancilar, kalemler] = await Promise.all([
          partileriGetir(b.sb, ws),
          toptancilariGetir(b.sb, ws),
          hepsi<{ batch_id: string; bought: number }>(() => b.sb.from("batch_items").select("batch_id,bought").eq("workspace", ws)),
        ]);
        const tAd = new Map(toptancilar.map((t) => [t.id, t.name]));
        const satirlar = [...partiler].reverse().slice(0, 40).map((p) => {
          const k = kalemler.filter((x) => x.batch_id === p.id);
          return `- ${p.name} | toptancı: ${p.supplier_id ? tAd.get(p.supplier_id) ?? "?" : "YOK"} | kur: ${p.usd_kuru ?? "YOK"} | ${k.length} kalem, ${k.reduce((t, x) => t + Number(x.bought), 0)} adet | ${tarih(p.created_at)}`;
        });
        return metin(`Toptancılar: ${toptancilar.map((t) => t.name).join(", ")}\n\nPartiler:\n${satirlar.join("\n") || "yok"}`);
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "parti_olustur",
      {
        title: "Yeni parti oluştur",
        description: "Yeni parti açar (toptancı ve USD kuru ile). Kaydetmeden önce kullanıcıya teyit ettir.",
        inputSchema: z.object({
          ad: z.string().describe("Parti adı (benzersiz)"),
          toptanci: z.string().describe("Toptancı adı, örn. T-Yüksel"),
          usd_kuru: z.number().positive().describe("Partinin USD/TL kuru"),
          workspace: WS_PARAM,
        }),
      },
      async ({ ad, toptanci, usd_kuru, workspace }, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, workspace);
        const name = ad.trim();
        if (!name) throw new Error("Parti adı boş olamaz.");
        const [partiler, toptancilar] = await Promise.all([partileriGetir(b.sb, ws), toptancilariGetir(b.sb, ws)]);
        if (partiler.some((p) => p.name === name)) throw new Error(`"${name}" partisi zaten kayıtlı.`);
        const t = bul(toptancilar, toptanci, "toptancı");
        const { error } = await b.sb.from("batches").insert({ name, supplier_id: t.id, usd_kuru, workspace: ws });
        if (error) throw new Error(error.message);
        await logYaz(b.sb, ws, b.email, "Parti eklendi", "batches", name, { toptanci: t.name, usd_kuru });
        return metin(`"${name}" partisi açıldı — toptancı ${t.name}, kur ${usd_kuru}.`);
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "urun_tanimi_ekle",
      {
        title: "Yeni ürün tanımı ekle",
        description:
          "Katalogda olmayan yeni ürün tanımı açar. Her konsantrasyon (EDT/EDP/Parfum/Intense/Elixir) ayrı üründür; adı buna göre yaz, " +
          "örn. 'Dior Sauvage EDP'. Kaydetmeden önce adı ve kategoriyi kullanıcıya teyit ettir.",
        inputSchema: z.object({
          ad: z.string().describe("En fazla 50 karakter"),
          kategori: z.enum(KATEGORILER),
          usd_tyuksel: z.number().positive().optional(),
          usd_thasan: z.number().positive().optional(),
          usd_tamir: z.number().positive().optional(),
          satis_fiyati: z.number().positive().optional().describe("Manuel satış fiyatı (TL)"),
          workspace: WS_PARAM,
        }),
      },
      async (a, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, a.workspace);
        const name = a.ad.trim();
        if (!name || name.length > 50) throw new Error("Ürün adı zorunlu ve en fazla 50 karakter olmalı.");
        const urunler = await fiyatliUrunler(b.sb, ws);
        if (urunler.some((u) => kucuk(u.name) === kucuk(name))) throw new Error(`"${name}" zaten kayıtlı.`);
        const code = `URN-${Date.now().toString().slice(-6)}`;
        const { error } = await b.sb.from("products").insert({
          name, code, gender_category: a.kategori, image_url: null,
          usd_fiyat_tyuksel: a.usd_tyuksel ?? null, usd_fiyat_thasan: a.usd_thasan ?? null, usd_fiyat_tamir: a.usd_tamir ?? null,
          manual_price: a.satis_fiyati ?? null, workspace: ws,
        });
        if (error) throw new Error(error.message);
        await logYaz(b.sb, ws, b.email, "Ürün eklendi", "products", name, {
          code, usd_tyuksel: a.usd_tyuksel ?? null, usd_thasan: a.usd_thasan ?? null, usd_tamir: a.usd_tamir ?? null, satis_fiyati: a.satis_fiyati ?? null,
        });
        return metin(`"${name}" (${code}, ${a.kategori}) ürün tanımı eklendi.`);
      }
    );

    // -----------------------------------------------------------------
    server.registerTool(
      "partiye_toplu_ekle",
      {
        title: "Partiye toplu ürün girişi",
        description:
          "Bir partiye birden fazla ürünü tek seferde ekler (stok girişi). Alış fiyatı verilmezse uygulamadaki gibi otomatik hesaplanır: " +
          "ürünün o toptancıya ait USD fiyatı × parti kuru (Cep Boy: 3 USD × kur, satış 500 TL). Satış fiyatı verilmezse ürünün manuel fiyatı kullanılır. " +
          "Tüm kalemler önce doğrulanır; bir tanesinde bile sorun varsa HİÇBİRİ kaydedilmez ve sorunlar listelenir. " +
          "ÖNEMLİ: Çağırmadan önce parti, depo ve kalem listesini (ürün, adet, varyant) tablo olarak kullanıcıya gösterip açık onay al.",
        inputSchema: z.object({
          parti: z.string().describe("Parti adı (önceden açılmış olmalı; yoksa parti_olustur)"),
          depo: z.string().optional().describe("'Adana-Depo', 'Samsun-Depo' veya 'Kars-Depo'. Bilinmiyorsa kullanıcıya sor"),
          kalemler: z.array(z.object({
            urun: z.string().describe("Katalogdaki ürün adı veya kodu (urunleri_eslestir ile bulunmuş)"),
            adet: z.number().int().positive(),
            varyant: z.enum(["ana", "cep_boy"]).default("ana"),
            alis_fiyati: z.number().positive().optional().describe("Birim alış fiyatı TL; boşsa otomatik"),
            satis_fiyati: z.number().nonnegative().optional().describe("Birim satış fiyatı TL; boşsa ürünün manuel fiyatı"),
          })).min(1).max(100),
          workspace: WS_PARAM,
        }),
      },
      async (a, ctx) => {
        const b = await baglam(ctx);
        const ws = yazmaWs(b, a.workspace);
        const [partiler, toptancilar, urunler, mevcut] = await Promise.all([
          partileriGetir(b.sb, ws),
          toptancilariGetir(b.sb, ws),
          fiyatliUrunler(b.sb, ws),
          hepsi<{ batch_id: string; product_id: string; variant: string | null; depo: string | null; bought: number }>(
            () => b.sb.from("batch_items").select("batch_id,product_id,variant,depo,bought").eq("workspace", ws)),
        ]);
        const parti = bul(partiler, a.parti, "parti");
        if (!parti.supplier_id) throw new Error("Bu partiye toptancı atanmamış. Uygulamadan Parti Maliyet Kaydı'nda toptancıyı seçin.");
        if (!parti.usd_kuru) throw new Error("Bu partiye USD kuru girilmemiş. Uygulamadan Parti Maliyet Kaydı'nda kuru girin.");
        const toptanciAdi = toptancilar.find((t) => t.id === parti.supplier_id)?.name;

        let depo = a.depo;
        if (depo) {
          const g = DEPOLAR[ws].find((d) => kucuk(d) === kucuk(depo!));
          if (!g) throw new Error(`"${depo}" geçerli depo değil. Depolar: ${DEPOLAR[ws].join(", ")}`);
          depo = g;
        } else {
          depo = varsayilanDepo(b.email, ws) ?? undefined;
          if (!depo) throw new Error(`Depo belirtilmeli: ${DEPOLAR[ws].join(", ")}. Kullanıcıya sor.`);
        }

        const sorunlar: string[] = [];
        const satirlar: Record<string, unknown>[] = [];
        const ozet: string[] = [];
        const gorulen = new Set<string>();
        a.kalemler.forEach((k, i) => {
          let urun: UrunFiyatli;
          try { urun = bul(urunler, k.urun, "ürün"); } catch (e) { sorunlar.push(`${i + 1}. ${(e as Error).message}`); return; }
          const varyant = k.varyant;
          const anahtar = `${urun.id}|${varyant}`;
          if (gorulen.has(anahtar)) { sorunlar.push(`${i + 1}. ${urun.name}${varyant === "cep_boy" ? " (Cep Boy)" : ""} listede iki kez var; adetleri birleştir.`); return; }
          gorulen.add(anahtar);
          const var_ = mevcut.find((m) => m.batch_id === parti.id && m.product_id === urun.id && (m.variant || "ana") === varyant && (m.depo || "Stok") === depo);
          if (var_) { sorunlar.push(`${i + 1}. ${urun.name}${varyant === "cep_boy" ? " (Cep Boy)" : ""} bu partide ${depo} için zaten var (${var_.bought} adet). Adet artırma uygulamadan yapılmalı.`); return; }
          let alis = k.alis_fiyati;
          let satis = k.satis_fiyati;
          if (varyant === "cep_boy") {
            alis = alis ?? yuvarla(CEP_BOY_USD_FIYAT * Number(parti.usd_kuru));
            satis = satis ?? CEP_BOY_SATIS_FIYATI;
          } else if (alis === undefined) {
            const usd = usdFiyatToptanciya(urun, toptanciAdi);
            if (usd === null) { sorunlar.push(`${i + 1}. ${urun.name}: ${toptanciAdi ?? "bu toptancı"} için USD fiyatı tanımlı değil, alış fiyatını kullanıcıya sor.`); return; }
            alis = yuvarla(usd * Number(parti.usd_kuru));
          }
          satis = satis ?? Number(urun.manual_price ?? 0);
          satirlar.push({ product_id: urun.id, batch_id: parti.id, bought: k.adet, buy_price: alis, sale_price: satis, depo, variant: varyant, workspace: ws });
          ozet.push(`- ${urun.name}${varyant === "cep_boy" ? " (Cep Boy)" : ""} x${k.adet} | alış ${tl(alis!)} | satış ${tl(satis)}`);
        });
        if (sorunlar.length) throw new Error(`Hiçbir kalem kaydedilmedi. Sorunlar:\n${sorunlar.join("\n")}`);

        // Tek insert = tek transaction: ya hepsi ya hiçbiri
        const { error } = await b.sb.from("batch_items").insert(satirlar);
        if (error) {
          if ((error as { code?: string }).code === "23505") throw new Error("Kalemlerden biri bu partide zaten var (benzersiz indeks). Hiçbiri kaydedilmedi.");
          throw new Error(`Kaydedilemedi: ${error.message}`);
        }
        for (const s of satirlar) {
          const u = urunler.find((x) => x.id === s.product_id)!;
          await logYaz(b.sb, ws, b.email, "Partiye ürün eklendi", "batch_items",
            `${u.name} / ${parti.name}${s.variant === "cep_boy" ? " (Cep Boy)" : ""}`,
            { adet: s.bought, alis: s.buy_price, satis: s.sale_price, depo: s.depo, variant: s.variant });
        }
        const toplamAdet = satirlar.reduce((t, s) => t + Number(s.bought), 0);
        const toplamAlis = satirlar.reduce((t, s) => t + Number(s.bought) * Number(s.buy_price), 0);
        return metin(`"${parti.name}" partisine ${depo} deposuna ${satirlar.length} kalem, ${toplamAdet} adet eklendi (toplam alış ${tl(toplamAlis)}):\n${ozet.join("\n")}`);
      }
    );
  },
  {
    serverInfo: { name: "stok-takip", version: "1.0.0" },
    instructions:
      "Stok-Takip, bir parfüm işletmesinin stok, satış ve cari takip uygulamasıdır. Tüm işlemler varsayılan olarak Güney " +
      "workspace'inde yapılır: workspace parametresini boş bırak. Kuzey pasiftir; kullanıcı açıkça 'Kuzey' demedikçe Kuzey'i " +
      "kullanma, önerme ve ondan bahsetme. Para tutarları Türk lirasıdır. Kayıt yazan araçlarda (satis_gir, odeme_al, musteri_ekle, parti_olustur, urun_tanimi_ekle, partiye_toplu_ekle) " +
      "asla tahmin yapma: eksik bilgiyi sor, kaydetmeden önce özet gösterip açık onay al. Satış iptali, düzenleme ve silme bu " +
      "ajanla yapılamaz; kullanıcıyı uygulamaya yönlendir. " +
      "FOTOĞRAFTAN STOK GİRİŞİ: Kullanıcı ürün fotoğrafı gönderip stok girişi isterse (1) fotoğraftaki her farklı ürünü marka, model, " +
      "konsantrasyon (EDT/EDP/Parfum/Intense/Elixir), Cep Boy olup olmadığı ve adet olarak tespit et; etiketi okunamayan, üst üste binen " +
      "veya emin olmadığın ürünleri açıkça işaretle, tahmin etme. (2) urunleri_eslestir ile katalog karşılıklarını bul; EDT/EDP farkı ayrı " +
      "üründür, yanlış konsantrasyonla eşleştirme. (3) Ürün | Katalog eşleşmesi | Adet | Emin misin tablosunu göster, katalogda olmayanları " +
      "ayrıca listele (urun_tanimi_ekle ile açılabilir). (4) Parti ve depoyu sor (partileri_listele). (5) Kullanıcı tabloyu düzeltip onaylayınca " +
      "partiye_toplu_ekle çağır.",
  }
);

// Claude'un gönderdiği token'ı Supabase'e doğrulatır
async function verifyToken(_req: Request, token?: string) {
  if (!token) return undefined;
  const sb = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims) return undefined;
  const c = data.claims as Record<string, unknown>;
  return {
    token,
    clientId: String(c.client_id ?? "supabase"),
    scopes: typeof c.scope === "string" ? c.scope.split(" ") : [],
    expiresAt: typeof c.exp === "number" ? c.exp : undefined,
  };
}

const handler = withMcpAuth(mcp, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { handler as GET, handler as POST, handler as DELETE };
