"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Detay = {
  authorization_id: string;
  redirect_uri: string;
  client: { name: string; uri: string };
  user: { email: string };
  scope: string;
};

export default function OAuthConsent() {
  const [authId, setAuthId] = useState<string | null>(null);
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [detay, setDetay] = useState<Detay | null>(null);
  const [hata, setHata] = useState("");
  const [isleniyor, setIsleniyor] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setAuthId(new URLSearchParams(window.location.search).get("authorization_id"));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !authId) return;
    supabase.auth.oauth.getAuthorizationDetails(authId).then(({ data, error }) => {
      if (error) return setHata(error.message);
      if (!data) return setHata("Yetkilendirme bilgisi alınamadı.");
      // Daha önce izin verilmişse Supabase doğrudan yönlendirme adresi döndürür
      if ("redirect_url" in data) {
        window.location.href = data.redirect_url;
        return;
      }
      setDetay(data as Detay);
    });
  }, [session, authId]);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const karar = async (onay: boolean) => {
    if (!authId || isleniyor) return;
    setIsleniyor(true);
    const { error } = onay
      ? await supabase.auth.oauth.approveAuthorization(authId)
      : await supabase.auth.oauth.denyAuthorization(authId);
    // Başarılıysa supabase-js tarayıcıyı Claude'a kendisi yönlendirir
    if (error) {
      setHata(error.message);
      setIsleniyor(false);
    }
  };

  const kutu = (icerik: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow text-slate-900">{icerik}</div>
    </main>
  );

  if (loading) return <main className="p-8">Yükleniyor...</main>;
  if (!authId) return kutu(<p>Geçersiz istek: authorization_id eksik.</p>);

  if (!session) {
    return kutu(
      <>
        <h1 className="mb-2 text-2xl font-bold">Giriş Yap</h1>
        <p className="mb-4 text-sm text-slate-600">Bağlantıya izin vermek için Stok-Takip hesabınla giriş yap.</p>
        <div className="space-y-3">
          <input className="w-full rounded-xl border p-3" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-xl border p-3" placeholder="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={login} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Giriş Yap</button>
        </div>
      </>
    );
  }

  if (hata) return kutu(<p className="text-red-600">Hata: {hata}</p>);
  if (!detay) return kutu(<p>Yükleniyor...</p>);

  let hedef = detay.redirect_uri;
  try { hedef = new URL(detay.redirect_uri).host; } catch {}

  return kutu(
    <>
      <h1 className="mb-4 text-2xl font-bold">Bağlantı İzni</h1>
      <p className="mb-2"><b>{detay.client.name}</b> uygulaması, Stok-Takip hesabın adına işlem yapmak istiyor.</p>
      <p className="mb-2 text-sm">Hesap: <b>{detay.user.email}</b></p>
      <p className="mb-6 text-sm">Yönlendirilecek adres: <b>{hedef}</b></p>
      <p className="mb-6 text-xs text-slate-500">Bu adres claude.ai değilse izin verme.</p>
      <div className="flex gap-3">
        <button type="button" disabled={isleniyor} onClick={() => karar(false)} className="flex-1 rounded-xl border p-3 font-semibold">Reddet</button>
        <button type="button" disabled={isleniyor} onClick={() => karar(true)} className="flex-1 rounded-xl bg-black p-3 font-semibold text-white">İzin Ver</button>
      </div>
    </>
  );
}