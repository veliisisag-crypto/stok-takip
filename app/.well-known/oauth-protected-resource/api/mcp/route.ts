import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from "mcp-handler";

// Claude bu adresten "token'ı kimden alacağım?" bilgisini öğrenir: Supabase Auth
const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();