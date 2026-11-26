import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function supabaseFor(token: string) {
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
type SB = ReturnType<typeof supabaseFor>;

function tokenOf(ctx: { http?: { authInfo?: { token: string } } }) {
  const t = ctx.http?.authInfo?.token;
  if (!t) throw new Error("Yetkisiz istek");
  return t;
}

const metin = (text: string) => ({ content: [{ type: "text" as const, text }] });
const kucuk = (s: string) => s.toLocaleLowerCase("tr");

// PostgREST satır sınırına takılmadan tüm satırları çeker (page.tsx'teki fetchAllRows gibi)
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

// Kullanıcının hangi workspace'lere erişimi var (page.tsx ile aynı kural)
async function workspaceler(sb: SB, token: string, istenen?: string) {
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u.user?.email) throw new Error("Kullanıcı doğrulanamadı");
  const email = u.user.email.toLowerCase();
  const { data } = await sb.from("workspace_access").select("workspaces").eq("email", email).maybeSingle();
  const izinli: string[] = data?.workspaces?.length ? data.workspaces : ["kuzey"];
  if (istenen && !izinli.includes(istenen)) {
    throw new Error(`Bu kullanıcının "${istenen}" workspace'ine erişimi yok. İzinli: ${izinli.join(", ")}`);
  }
  return { email, liste: istenen ? [istenen] : izinli };
}

type Urun = { id: string; name: string; code: string; passive: boolean };
type Kalem = { id: string; batch_id: string; product_id: string; bought: number; depo: string | null; variant: string | null };

// page.tsx > getBatchSoldQtyForItem ile birebir aynı mantık
async function stokHesapla(sb: SB, ws: string) {
  const katalog = ws === "guney" ? ["kuzey", "guney"] : ["kuzey"];
  const [urunler, kalemler, r1, r2] = await Promise.all([
    hepsi<Urun>(() => sb.from("products").select("id,name,code,passive").in("workspace", katalog).order("created_at")),
    hepsi<Kalem>(() => sb.from("batch_items").select("id,batch_id,product_id,bought,depo,variant").eq("workspace", ws).order("created_at")),
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

  // ürün + varyant + depo bazında kalan stok
  const ozet = new Map<string, { urun: Urun; variant: string; depo: string; kalan: number }>();
  const urunMap = new Map(urunler.map((u) => [u.id, u]));
  for (const item of kalemler) {
    const urun = urunMap.get(item.product_id);
    if (!urun) continue;
    const variant = item.variant || "ana";
    const depo = item.depo || "Stok";
    const key = `${item.product_id}|${variant}|${depo}`;
    const satir = ozet.get(key) ?? { urun, variant, depo, kalan: 0 };
    satir.kalan += Math.max(item.bought - satilan(item), 0);
    ozet.set(key, satir);
  }
  return { urunler, ozet: [...ozet.values()] };
}

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "kim_olarak_bagliyim",
    {
      title: "Bağlantı testi",
      description: "Stok-Takip'e hangi kullanıcıyla bağlı olunduğunu ve erişilebilen workspace'leri gösterir.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const token = tokenOf(ctx);
      const { email, liste } = await workspaceler(supabaseFor(token), token);
      return metin(`Bağlı kullanıcı: ${email}\nWorkspace'ler: ${liste.join(", ")}`);
    }
  );

  server.registerTool(
    "stok_sorgula",
    {
      title: "Stok sorgula",
      description:
        "Stok-Takip'deki kalan stoku ürün, varyant (normal / Cep Boy) ve depo bazında gösterir. " +
        "Ürün adı veya kodunun bir kısmıyla arama yapılabilir; boş bırakılırsa stokta olan tüm ürünler listelenir. " +
        "Workspace belirtilmezse kullanıcının erişebildiği tüm workspace'ler ayrı ayrı gösterilir. " +
        "Depolar: Kuzey'de 'Stok'; Güney'de 'Adana-Depo', 'Samsun-Depo', 'Kars-Depo'.",
      inputSchema: z.object({
        urun: z.string().optional().describe("Ürün adı veya kodunun bir kısmı, örn. 'sauvage'"),
        depo: z.string().optional().describe("Depo adı, örn. 'Samsun-Depo'"),
        workspace: z.enum(["kuzey", "guney"]).optional(),
      }),
    },
    async ({ urun, depo, workspace }, ctx) => {
      const token = tokenOf(ctx);
      const sb = supabaseFor(token);
      const { liste } = await workspaceler(sb, token, workspace);
      const arama = urun ? kucuk(urun.trim()) : "";
      const bloklar: string[] = [];

      for (const ws of liste) {
        const { ozet } = await stokHesapla(sb, ws);
        let satirlar = ozet.filter((s) =>
          (!arama || kucuk(s.urun.name).includes(arama) || kucuk(s.urun.code || "").includes(arama)) &&
          (!depo || kucuk(s.depo) === kucuk(depo))
        );
        if (!arama) satirlar = satirlar.filter((s) => s.kalan > 0);
        satirlar.sort((a, b) => a.urun.name.localeCompare(b.urun.name, "tr") || a.depo.localeCompare(b.depo, "tr"));

        const baslik = ws === "guney" ? "GÜNEY" : "KUZEY";
        if (satirlar.length === 0) {
          bloklar.push(`${baslik}: eşleşen stok kaydı yok.`);
          continue;
        }
        const toplam = satirlar.reduce((t, s) => t + s.kalan, 0);
        const govde = satirlar.slice(0, 300).map((s) =>
          `- ${s.urun.name}${s.urun.code ? ` (${s.urun.code})` : ""}${s.variant === "cep_boy" ? " [Cep Boy]" : ""} | ${s.depo}: ${s.kalan} adet${s.urun.passive ? " (pasif ürün)" : ""}`
        );
        if (satirlar.length > 300) govde.push(`... ve ${satirlar.length - 300} satır daha (aramayı daralt)`);
        bloklar.push(`${baslik} — toplam ${toplam} adet\n${govde.join("\n")}`);
      }
      return metin(bloklar.join("\n\n"));
    }
  );
});

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