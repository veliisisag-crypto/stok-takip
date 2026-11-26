import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Tool içinden: bu isteği yapan kullanıcının token'ıyla Supabase client'ı.
// RLS, roller, workspace kısıtları ve stok trigger'ı o kullanıcıya göre çalışır.
function supabaseFor(token: string) {
  return createClient(SUPA_URL, SUPA_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function tokenOf(ctx: { http?: { authInfo?: { token: string } } }) {
  const t = ctx.http?.authInfo?.token;
  if (!t) throw new Error("Yetkisiz istek");
  return t;
}

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "kim_olarak_bagliyim",
    {
      title: "Bağlantı testi",
      description: "Redline'a hangi kullanıcıyla bağlı olunduğunu gösterir.",
      inputSchema: z.object({}),
    },
    async (_args, ctx) => {
      const sb = supabaseFor(tokenOf(ctx));
      const { data, error } = await sb.auth.getUser();
      if (error) throw new Error(error.message);
      return {
        content: [{ type: "text", text: `Bağlı kullanıcı: ${data.user?.email}` }],
      };
    }
  );
});

// Claude'un gönderdiği token'ı Supabase'e doğrulatır
async function verifyToken(_req: Request, token?: string) {
  if (!token) return undefined;
  const sb = createClient(SUPA_URL, SUPA_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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