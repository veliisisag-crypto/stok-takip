"use client";

import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

// Supabase/PostgREST varsayılan olarak tek istekte sınırlı sayıda satır döndürür.
// Kayıt sayısı arttıkça (500+, 1000+ vb.) sabit bir .limit() eski kayıtları sessizce
// gizleyebiliyor. Bu fonksiyon .range() ile sayfa sayfa çekip TÜM satırları getirir.
async function fetchAllRows<T>(table: string, orderCol: string, ascending: boolean): Promise<{ data: T[] | null; error: unknown }> {
  const pageSize = 1000;
  let allRows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").order(orderCol, { ascending }).range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
}

function AuditSection({ supabase }: { supabase: typeof import("@/lib/supabase").supabase }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  useEffect(() => {
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setLogs((data || []) as AuditLog[]); setLoading(false); });
  }, []);
  return (
    <div className="space-y-4">
      <Card title="İşlem Geçmişi">
        {loading ? <p className="text-sm text-slate-500">Yükleniyor...</p> : (
          <Table
            headers={["Tarih", "İşlem", "Tablo", "Kayıt", "Kullanıcı", "Detay"]}
            rows={logs.map((log) => [
              toTR(log.created_at, true),
              log.action,
              log.entity_type,
              log.entity_name || "-",
              log.user_email || "-",
              <button
                key="detay"
                type="button"
                className="btn-secondary"
                style={{ fontSize: "0.75rem", padding: "3px 10px" }}
                onClick={() => setDetailLog(log)}
              >
                Detay
              </button>,
            ])}
          />
        )}
      </Card>

      {detailLog && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setDetailLog(null)}
        >
          <div
            style={{ background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{detailLog.action}</h2>
              <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setDetailLog(null)}>Kapat</button>
            </div>
            <p className="text-xs text-slate-500" style={{ marginBottom: 14 }}>
              {toTR(detailLog.created_at, true)} · {detailLog.entity_type} · {detailLog.entity_name || "-"} · {detailLog.user_email || "-"}
            </p>
            {(() => {
              const details = (detailLog.details || {}) as Record<string, unknown>;
              const before = details.before as Record<string, unknown> | undefined;
              const after = details.after as Record<string, unknown> | undefined;

              if (before && after && typeof before === "object" && typeof after === "object") {
                const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
                if (!keys.length) return <p className="text-sm text-slate-500">Bu işlem için ek detay kaydı yok.</p>;
                return (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>Alan</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Önce</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Sonra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => {
                        const b = formatLogValue(before[key]);
                        const a = formatLogValue(after[key]);
                        const changed = b !== a;
                        return (
                          <tr key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: 8, fontWeight: 600, color: "#334155" }}>{logFieldLabel(key)}</td>
                            <td style={{ padding: 8, color: changed ? "#dc2626" : "#64748b" }}>{b}</td>
                            <td style={{ padding: 8, color: changed ? "#16a34a" : "#64748b", fontWeight: changed ? 700 : 400 }}>{a}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              }

              const flatKeys = Object.keys(details);
              if (!flatKeys.length) return <p className="text-sm text-slate-500">Bu işlem için ek detay kaydı yok.</p>;
              return (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <tbody>
                    {flatKeys.map((key) => (
                      <tr key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: 8, fontWeight: 600, color: "#334155", width: "40%" }}>{logFieldLabel(key)}</td>
                        <td style={{ padding: 8, color: "#0f172a" }}>{formatLogValue(details[key])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}


type GenderCategory = "Kadın" | "Erkek" | "Unisex";
type SaleType = "Normal satış" | "Fire/Bozuk" | "Hibe";
type Seller = "Aslı" | "Mihrimah";

type SellerAccount = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
};

type SellerSettlement = {
  id: string;
  seller_account_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

// Satıcıdan ortağa yapılan iç transfer - müşteri tahsilatlarından tamamen ayrı bir kayıt.
type SellerTransfer = {
  id: string;
  seller_account_id: string;
  amount: number;
  alici: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

type PreorderItem = {
  id: string;
  preorder_id: string;
  product_id: string;
  qty: number;
};

type Preorder = {
  id: string;
  customer_id: string;
  created_by: string;
  created_at: string;
  note: string;
  status: string;
  seller_account_id?: string | null;
  items?: PreorderItem[];
};

type Product = {
  id: string;
  name: string;
  code: string;
  gender_category: GenderCategory;
  image_url: string | null;
  usd_fiyat_tyuksel?: number | null;
  usd_fiyat_thasan?: number | null;
  usd_fiyat_tamir?: number | null;
  manual_price?: number | null;

  passive: boolean;
};

type Customer = {
  id: string;
  name: string;
  passive: boolean;
  seller_account_id?: string | null;
  created_by?: string | null;
};

type Batch = {
  id: string;
  name: string;
  created_at: string;
  supplier_id?: string | null;
  usd_kuru?: number | null;
};

type Supplier = {
  id: string;
  name: string;
  created_at: string;
};

type SupplierReturn = {
  id: string;
  product_id: string;
  batch_item_id: string;
  batch_id: string;
  supplier_id: string | null;
  qty: number;
  resolution_type: "bekliyor" | "urun" | "para" | "farkli_urun";
  refund_amount: number | null;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};

type BatchItem = {
  id: string;
  batch_id: string;
  product_id: string;
  bought: number;
  buy_price: number;
  sale_price: number;
  depo?: string;
  variant?: "ana" | "cep_boy"; // "ana" = normal boy ürün, "cep_boy" = küçük boy alt ürün (aynı ürün tanımı, ayrı stok/fiyat)
  created_at: string;
};

type Sale = {
  id: string;
  customer_id: string;
  product_id: string;
  batch_id: string;
  batch_item_id?: string | null;
  seller: Seller | null;
  sale_type: SaleType;
  qty: number;
  total: number;
  cost: number;
  paid: boolean;
  paid_amount: number;
  payment_method?: "nakit" | "banka" | null;
  seller_account_id?: string | null;
  seller_profit?: number | null;
  note?: string | null;
  variant?: "ana" | "cep_boy"; // hangi alt üründen satıldığı - raporlarda etiketlemek için
  cancelled: boolean;
  created_at: string;
};

type Payment = {
  id: string;
  customer_id: string;
  amount: number;
  payment_method?: "nakit" | "banka" | null;
  note?: string | null;
  kasa_tutari?: number | null;
  aciklama?: string | null;
  preorder_id?: string | null;
  seller_account_id?: string | null;
  cancelled?: boolean;
  created_at: string;
  user_email?: string | null;
  para_sahibi?: string | null;
  hesap?: string | null;
};

type Odeme = {
  id: string;
  sira_no: number;
  tip: "toptanci" | "kargo" | "diger" | "kar_payi";
  supplier_id: string | null;
  batch_id: string | null;
  recipient_name: string | null;
  tutar: number;
  aciklama: string | null;
  created_by: string | null;
  created_at: string;
};

type OdemeKaynak = {
  id: string;
  odeme_id: string;
  kaynak_tipi: "tahsilat" | "devir" | "sahsi";
  para_sahibi: string | null;
  payment_id: string | null;
  period_id: string | null;
  kullanilan_tutar: number;
  created_at: string;
};

type PartnerRow = {
  id: string;
  partner_name: "Veli" | "Aslı" | "Mihrimah";
  role: string;
  contribution: number;
  receivable: number;
  debt: number;
  profit_share: number;
};

type BatchCost = {
  id: string;
  batch_id: string;
  veli: number;
  asli: number;
  mihrimah: number;
  kasa: number;
  kargo: number;
  diger: number;
  // Kargo/Diğer ödemelerinde şahsi cüzdan kullanılırsa buraya yazılır - veli/asli/mihrimah
  // sadece TOPTANCI şahsi katkısı için ayrılmış olduğundan bunlarla KARIŞTIRILMAZ.
  kargo_veli?: number;
  kargo_asli?: number;
  kargo_mihrimah?: number;
  diger_veli?: number;
  diger_asli?: number;
  diger_mihrimah?: number;
  aciklama: string;
};

type Period = {
  id: string;
  name: string;
  sponsor_contribution: number;
  asli_contribution: number;
  mihrimah_contribution: number;
  net_odeme?: number;
  asli_net_odeme?: number;
  mihri_net_odeme?: number;
  product_cost: number;
  shipping_cost: number;
  closing_cash?: number | null;
  asli_distribution?: number | null;
  mihrimah_distribution?: number | null;
  urun_maliyeti?: number | null;
  diger_maliyetler?: number | null;
  toplam_tahsilat?: number | null;
  donem_kari?: number | null;
  devir_bakiyesi?: number | null;
  devir_bakiyesi_notu?: string | null;
  seller_distributions?: { seller_id: string; name: string; amount: number }[] | null;
  closed: boolean;
  created_at: string;
  closed_at: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  user_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const today = () => new Date().toISOString().slice(0, 10);

const shortUserName = (email?: string | null) => {
  if (!email) return "-";
  const lower = email.toLowerCase();
  if (lower.includes("asli")) return "Aslı";
  if (lower.includes("mihrimah")) return "Mihri";
  if (lower.includes("veli")) return "Veli";
  return email.split("@")[0];
};

const toTR = (isoStr?: string | null, withTime = false) => {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  d.setHours(d.getHours() + 3);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  if (!withTime) return `${dd}.${mm}.${yyyy}`;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
};
const toNum = (v: unknown) => Number(v || 0);

// Log detay modalında ham alan adlarını (örn. "usd_kuru") okunaklı Türkçe etiketlere çevirir.
const LOG_FIELD_LABELS: Record<string, string> = {
  ad: "Ad",
  yeni_ad: "Ad",
  name: "Ad",
  tutar: "Tutar",
  amount: "Tutar",
  not: "Not",
  note: "Not",
  aciklama: "Açıklama",
  kasa_tutari: "Kasa Tutarı",
  usd_fiyat: "USD Fiyat",
  usd_kuru: "USD Kuru",
  toptanci: "Toptancı",
  supplier_id: "Toptancı",
  code: "Kod",
  gender_category: "Cinsiyet Kategorisi",
  passive: "Pasif",
  pasif: "Pasif",
  aktif: "Aktif",
  manual_price: "Manuel Fiyat",
  bought: "Alınan Adet",
  buy_price: "Alış Fiyatı",
  sale_price: "Satış Fiyatı",
  depo: "Depo",
  batch_id: "Parti",
  seller: "Satıcı",
  sale_type: "Satış Türü",
  qty: "Adet",
  total: "Toplam",
  cost: "Maliyet",
  paid: "Ödendi mi",
  paid_amount: "Ödenen Tutar",
  devir_bakiyesi: "Devir Bakiyesi",
  urunler: "Ürünler",
  yontem: "Yöntem",
  email: "E-posta",
  items: "Ürün Sayısı",
  contribution: "Katkı",
  debt: "Borç",
  receivable: "Alacak",
  partner_name: "Ortak",
  role: "Rol",
};
const logFieldLabel = (key: string) => LOG_FIELD_LABELS[key] || key;

// Log detay modalında değerleri okunaklı hale getirir (null -> "-", boolean -> Evet/Hayır, sayı -> tr-TR formatı).
const formatLogValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v === "number") return v.toLocaleString("tr-TR");
  return String(v);
};

function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      {title ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function StatCard({ title, value, note }: { title: string; value: ReactNode; note?: string }) {
  return (
    <section className="rounded-xl border bg-white shadow-sm" style={{padding:"12px 16px"}}>
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-xl font-semibold" style={{marginTop:2}}>{value}</p>
      {note ? <p className="text-xs text-slate-400" style={{marginTop:2}}>{note}</p> : null}
    </section>
  );
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input"
        placeholder={placeholder}
        value={open ? query : (selected?.label || "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 200,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 240,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
          }}
        >
          {value && (
            <div
              onMouseDown={() => { onChange(""); setQuery(""); setOpen(false); }}
              style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.8rem", color: "#94a3b8", borderBottom: "1px solid #f1f5f9" }}
            >
              Seçimi temizle
            </div>
          )}
          {filtered.length ? filtered.map((o) => (
            <div
              key={o.value}
              onMouseDown={() => { onChange(o.value); setQuery(""); setOpen(false); }}
              style={{ padding: "8px 10px", cursor: "pointer", fontSize: "0.85rem", background: o.value === value ? "#f1f5f9" : "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = o.value === value ? "#f1f5f9" : "transparent")}
            >
              {o.label}
            </div>
          )) : <div style={{ padding: "8px 10px", fontSize: "0.85rem", color: "#94a3b8" }}>Sonuç yok</div>}
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap p-3 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="whitespace-nowrap p-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="p-3 text-slate-500" colSpan={headers.length}>
                Kayıt yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState("dashboard");
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState("");
  const [forcedErrorMessage, setForcedErrorMessage] = useState(false);

  useEffect(() => {
    if (!message) { setForcedErrorMessage(false); return; }
    const t = setTimeout(() => { setMessage(""); setForcedErrorMessage(false); }, 6000);
    return () => clearTimeout(t);
  }, [message]);

  const getMessageTone = (msg: string): "error" | "success" => {
    if (forcedErrorMessage) return "error";
    const negative = ["yetersiz", "hata", "zorunlu", "olamaz", "olmalı", "silinmedi", "seçin", "girin", "eklemeli", "bulunamadı", "reddedildi", "geçerli", "yok"];
    const lower = msg.toLowerCase();
    return negative.some((w) => lower.includes(w)) ? "error" : "success";
  };
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [sellerAccounts, setSellerAccounts] = useState<SellerAccount[]>([]);
  const [sellerSettlements, setSellerSettlements] = useState<SellerSettlement[]>([]);
  const [sellerTransfers, setSellerTransfers] = useState<SellerTransfer[]>([]);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerEmail, setNewSellerEmail] = useState("");
  const [sellerTransferDetailId, setSellerTransferDetailId] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferAlici, setTransferAlici] = useState<string>("");
  const [openSellerId, setOpenSellerId] = useState<string | null>(null);
  const [sellerSalesDetailId, setSellerSalesDetailId] = useState<string | null>(null);
  const [sellerPaymentsDetailId, setSellerPaymentsDetailId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [batchCosts, setBatchCosts] = useState<BatchCost[]>([]);
  const [costInputs, setCostInputs] = useState<Record<string, Record<string, string>>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newBatchSupplierId, setNewBatchSupplierId] = useState("");
  const [returnFormItemId, setReturnFormItemId] = useState<string | null>(null);
  const [returnFormQty, setReturnFormQty] = useState("");
  const [returnFormSupplierId, setReturnFormSupplierId] = useState("");
  const [returnFormNote, setReturnFormNote] = useState("");
  const [resolvingReturnId, setResolvingReturnId] = useState<string | null>(null);
  const [resolveMoneyAmount, setResolveMoneyAmount] = useState("");
  const [resolvingDifferentId, setResolvingDifferentId] = useState<string | null>(null);
  const [resolveDifferentProductNote, setResolveDifferentProductNote] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [odemeler, setOdemeler] = useState<Odeme[]>([]);
  const [odemeKaynaklari, setOdemeKaynaklari] = useState<OdemeKaynak[]>([]);
  const [soldQtyByProduct, setSoldQtyByProduct] = useState<Record<string, number>>({});
  const [soldQtyByBatchItem, setSoldQtyByBatchItem] = useState<Record<string, number>>({});
  const [soldQtyByProductBatch, setSoldQtyByProductBatch] = useState<Record<string, number>>({});
  const [odemeTip, setOdemeTip] = useState<"toptanci" | "kargo" | "diger" | "kar_payi">("toptanci");
  const [odemeSupplierId, setOdemeSupplierId] = useState("");
  const [odemeBatchId, setOdemeBatchId] = useState("");
  const [odemeKarPayiAlici, setOdemeKarPayiAlici] = useState("");
  const [odemeTutar, setOdemeTutar] = useState("");
  const [odemeKimden, setOdemeKimden] = useState<string[]>([]);
  const [odemeKimdenSecim, setOdemeKimdenSecim] = useState("");
  const [sahsiKarsilamaSecili, setSahsiKarsilamaSecili] = useState<string | null>(null); // odeme_kaynaklari.id (kaynak_tipi='sahsi')
  const [sahsiKarsilamaTutar, setSahsiKarsilamaTutar] = useState("");
  const [sahsiKarsilamaKimden, setSahsiKarsilamaKimden] = useState<string[]>([]);
  const [sahsiKarsilamaKimdenSecim, setSahsiKarsilamaKimdenSecim] = useState("");
  const [editingPaymentRowId, setEditingPaymentRowId] = useState<string | null>(null);
  const [paymentRowDraft, setPaymentRowDraft] = useState<{ note: string; kasa: string; paraSahibi: string; aciklama: string }>({ note: "", kasa: "", paraSahibi: "", aciklama: "" });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [preorderItems, setPreorderItems] = useState<PreorderItem[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<{id:string; payment_id:string; sale_id:string; amount:number; created_at:string}[]>([]);
  const [preorderForm, setPreorderForm] = useState<{ customerId: string; note: string; items: { productId: string; qty: string }[] }>({ customerId: "", note: "", items: [{ productId: "", qty: "1" }] });
  const [editingPreorderId, setEditingPreorderId] = useState<string | null>(null);
  const [convertModal, setConvertModal] = useState<{ preorder: Preorder; item: PreorderItem } | null>(null);
  const [advancePaymentModal, setAdvancePaymentModal] = useState<Preorder | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("banka");
  const [advanceNote, setAdvanceNote] = useState("");
  const [convertPrices, setConvertPrices] = useState<Record<string, string>>({});
  const [convertPaid, setConvertPaid] = useState<string>("false");
  const [convertSellerProfit, setConvertSellerProfit] = useState<string>("");
  const [convertParaSahibi, setConvertParaSahibi] = useState<string>("");

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [paymentMethodInputs, setPaymentMethodInputs] = useState<Record<string, string>>({});
  const [paymentParaSahibiInputs, setPaymentParaSahibiInputs] = useState<Record<string, string>>({});
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceDraft, setOpeningBalanceDraft] = useState("");
  const [editingOpeningBalanceNote, setEditingOpeningBalanceNote] = useState(false);
  const [openingBalanceNoteDraft, setOpeningBalanceNoteDraft] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [viewingSaleNote, setViewingSaleNote] = useState<Sale | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState<string>("");
  const [showKarDetay, setShowKarDetay] = useState(false);
  const [showTahsilatDetay, setShowTahsilatDetay] = useState(false);
  const [showMusteriDetay, setShowMusteriDetay] = useState(false);
  const [showStokDetay, setShowStokDetay] = useState(false);
  const [stokSort, setStokSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "urun", dir: "asc"});
  const [saleLoading, setSaleLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingNetOdemeId, setEditingNetOdemeId] = useState<string | null>(null);
  const [expandedSellerDistPeriodId, setExpandedSellerDistPeriodId] = useState<string | null>(null);
  const [editingNetOdemeVal, setEditingNetOdemeVal] = useState<string>("");
  const [salesSort, setSalesSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "created_at", dir: "desc"});
  const [saleStatusFilter, setSaleStatusFilter] = useState<string>("Tümü");
  const [splitModal, setSplitModal] = useState<{item: BatchItem; newDepo: string} | null>(null);
  const [splitQty, setSplitQty] = useState<string>("");
  const [saleDrafts, setSaleDrafts] = useState<Record<string, { qty: string; total: string; cost: string; seller: Seller; sale_type: SaleType; paid: boolean; note: string }>>({});
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, Partial<Product>>>({});
  const pendingImageRef = useRef<Record<string, string>>({});
  const [salesModalProductId, setSalesModalProductId] = useState<string | null>(null);
  const [customerDrafts, setCustomerDrafts] = useState<Record<string, Partial<Customer>>>({});
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ name: "", genderCategory: "Kadın" as GenderCategory, image: "", usdTyuksel: "", usdThasan: "", usdTamir: "" });
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [batchReportFilter, setBatchReportFilter] = useState("");
  const [partiTab, setPartiTab] = useState<"giris" | "maliyet" | "rapor">("giris");
  const [showPartiDetayModal, setShowPartiDetayModal] = useState(false);
  const [batchReportSort, setBatchReportSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "batch", dir: "asc"});
  const [batchForm, setBatchForm] = useState({ batchId: "", productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Stok", variant: "ana" as "ana" | "cep_boy" });
  const [saleForm, setSaleForm] = useState({ customerId: "", productId: "", batchId: "", qty: "1", seller: "Aslı" as Seller, saleType: "Normal satış" as SaleType, paid: "false", customSalePrice: "", depo: "Stok", sellerProfit: "", note: "", paraSahibi: "", variant: "ana" as "ana" | "cep_boy" });
  const [periodForm, setPeriodForm] = useState({ name: `Dönem ${today()}`, sponsor: "0", asli: "0", mihrimah: "0", productCost: "0", shippingCost: "0" });

  const activeSales = sales.filter((sale) => !sale.cancelled);
  const activePayments = payments.filter((payment) => !payment.cancelled);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // Bir satışın ürün adını döner; satış Cep Boy ise başına "Cep-" ekler (loglar/tablolar/raporlar için ortak).
  const saleProductName = (sale: { product_id: string; variant?: "ana" | "cep_boy" }) =>
    `${sale.variant === "cep_boy" ? "Cep-" : ""}${productMap.get(sale.product_id)?.name || "-"}`;
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const preorderMap = useMemo(() => new Map(preorders.map((po) => [po.id, po])), [preorders]);
  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const sellerAccountMap = useMemo(() => new Map(sellerAccounts.map((s) => [s.id, s])), [sellerAccounts]);
  const currentSellerAccount = useMemo(
    () => sellerAccounts.find((s) => s.email.toLowerCase() === currentUserEmail.toLowerCase() && s.active),
    [sellerAccounts, currentUserEmail]
  );
  const isSellerRole = !!currentSellerAccount;

  // Satıcı ekranlarında kullanılacak "sadece benim verim" görünümleri.
  // Stok hesapları (getProductStock vb.) HER ZAMAN tam veriyi (sales/activeSales) kullanır, bunları değil.
  const mySales = useMemo(
    () => (isSellerRole ? sales.filter((s) => s.seller_account_id === currentSellerAccount!.id) : sales),
    [sales, isSellerRole, currentSellerAccount]
  );
  const myActiveSales = useMemo(() => mySales.filter((s) => !s.cancelled), [mySales]);
  const myCustomers = useMemo(
    () => (isSellerRole ? customers.filter((c) => c.seller_account_id === currentSellerAccount!.id) : customers),
    [customers, isSellerRole, currentSellerAccount]
  );
  const myPayments = useMemo(
    () => (isSellerRole ? payments.filter((p) => p.seller_account_id === currentSellerAccount!.id) : payments),
    [payments, isSellerRole, currentSellerAccount]
  );
  const myActivePayments = useMemo(() => myPayments.filter((p) => !p.cancelled), [myPayments]);
  const myPreorders = useMemo(
    () => (isSellerRole ? preorders.filter((p) => p.seller_account_id === currentSellerAccount!.id) : preorders),
    [preorders, isSellerRole, currentSellerAccount]
  );

  const getUsdPriceForBatch = (product: Product | undefined, batch: Batch | undefined): number | null => {
    if (!product || !batch || !batch.supplier_id) return null;
    const supplier = supplierMap.get(batch.supplier_id);
    if (!supplier) return null;
    if (supplier.name === "T-Yüksel") return product.usd_fiyat_tyuksel ?? null;
    if (supplier.name === "T-Hasan") return product.usd_fiyat_thasan ?? null;
    if (supplier.name === "T-Amir") return product.usd_fiyat_tamir ?? null;
    return null;
  };

  // Cep Boy (küçük boy alt ürün) için sabit varsayılanlar - her ürün/toptancı için aynı,
  // ama kullanıcı isterse formda üzerine yazabilir (sadece varsayılan olarak otomatik dolar).
  const CEP_BOY_USD_FIYAT = 3;
  const CEP_BOY_SATIS_FIYATI = 500;

  const recalcBatchFormBuyPrice = (productId: string, batchId: string) => {
    const product = productMap.get(productId);
    const batch = batchMap.get(batchId);
    if (!product || !batch) return;
    if (batchForm.variant === "cep_boy") {
      if (!batch.usd_kuru) return;
      const computed = Math.round(CEP_BOY_USD_FIYAT * batch.usd_kuru * 100) / 100;
      setBatchForm((prev) => ({ ...prev, buyPrice: String(computed), salePrice: String(CEP_BOY_SATIS_FIYATI) }));
      return;
    }
    const usdPrice = getUsdPriceForBatch(product, batch);
    if (usdPrice === null || !batch.usd_kuru) return;
    const computed = Math.round(usdPrice * batch.usd_kuru * 100) / 100;
    setBatchForm((prev) => ({ ...prev, buyPrice: String(computed) }));
  };

  useEffect(() => {
    if (!batchForm.productId || !batchForm.batchId) return;
    recalcBatchFormBuyPrice(batchForm.productId, batchForm.batchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchForm.productId, batchForm.batchId, batchForm.variant, products, batches]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [products]
  );
  const sortedActiveProducts = useMemo(
    () => sortedProducts.filter((p) => !p.passive),
    [sortedProducts]
  );
  type ProductSortCol = "fiyat" | "alinan" | "satilan" | "stok";
  type ProductSortState =
    | { mode: "az" }
    | { mode: "gender"; orderIndex: number }
    | { mode: "column"; col: ProductSortCol; dir: "asc" | "desc" }
    | { mode: "gender-column"; orderIndex: number; col: ProductSortCol; dir: "asc" | "desc" };
  const [productSort, setProductSort] = useState<ProductSortState>({ mode: "az" });
  const genderSortOrders: GenderCategory[][] = [
    ["Kadın", "Erkek", "Unisex"],
    ["Erkek", "Kadın", "Unisex"],
    ["Unisex", "Kadın", "Erkek"],
  ];
  const getProductLatestPrice = (productId: string) => {
    const items = batchItemsForProduct(productId).filter((i) => Number(i.sale_price) > 0);
    if (items.length) {
      return Number(
        items.slice().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0].sale_price
      );
    }
    const product = productMap.get(productId);
    return Number(product?.manual_price || 0);
  };
  const sortedCustomers = useMemo(
    () => [...(isSellerRole ? myCustomers : customers)].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [customers, myCustomers, isSellerRole]
  );
  const sortedActiveCustomers = useMemo(
    () => sortedCustomers.filter((c) => !c.passive),
    [sortedCustomers]
  );
  const sortedBatches = useMemo(
    () => [...batches].sort((a, b) => b.name.localeCompare(a.name, "tr", { numeric: true })),
    [batches]
  );

  const showError = (error: unknown) => {
    if (!error) return;
    const msg = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String((error as {message: unknown}).message)
      : JSON.stringify(error);
    if (/jwt issued at future|jwt.*future/i.test(msg)) {
      setForcedErrorMessage(true);
      setMessage("Telefonunun saat/tarih ayarı sunucuyla uyuşmuyor (JWT hatası). Lütfen telefonunun Ayarlar > Tarih ve Saat bölümünden \"Otomatik tarih ve saat\" seçeneğini açık olduğundan emin ol, gerekirse telefonu yeniden başlat. Sorun devam ederse bu sayfadan çıkış yapıp tekrar giriş yap.");
      return;
    }
    setForcedErrorMessage(true);
    setMessage(msg);
  };

  const loadAll = async (isRetry = false) => {
    setLoadingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email || "";
      setCurrentUserEmail(email);
      const defaultDepo = email.includes("mihrimah") ? "Stok" : "Stok";
      const defaultSeller: Seller = email.includes("mihrimah") ? "Mihrimah" : "Aslı";
      setSaleForm((prev) => ({ ...prev, depo: defaultDepo, seller: defaultSeller }));
      setBatchForm((prev) => ({ ...prev, depo: defaultDepo }));

      const [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes, preordersRes, preorderItemsRes, paymentAllocationsRes, suppliersRes, supplierReturnsRes, sellerAccountsRes, sellerSettlementsRes, sellerTransfersRes, odemelerRes, odemeKaynaklariRes, soldByProductRes, soldByBatchItemRes, soldByProductBatchRes] = await Promise.all([
        supabase.from("products").select("id,name,code,gender_category,image_url,passive,usd_fiyat_tyuksel,usd_fiyat_thasan,usd_fiyat_tamir,manual_price").order("created_at", { ascending: true }),
        supabase.from("customers").select("*").order("created_at", { ascending: true }),
        supabase.from("batches").select("*").order("created_at", { ascending: true }),
        supabase.from("batch_items").select("*").order("created_at", { ascending: true }),
        fetchAllRows<Sale>("sales", "created_at", false),
        fetchAllRows<Payment>("payments", "created_at", false),
        supabase.from("partner_ledger").select("*").order("partner_name", { ascending: true }),
        supabase.from("periods").select("*").order("created_at", { ascending: false }),
        supabase.from("batch_costs").select("*"),
        supabase.from("preorders").select("*").order("created_at", { ascending: false }),
        supabase.from("preorder_items").select("*"),
        supabase.from("payment_allocations").select("*").order("created_at", { ascending: true }),
        supabase.from("suppliers").select("*").order("name", { ascending: true }),
        supabase.from("supplier_returns").select("*").order("created_at", { ascending: false }),
        supabase.from("seller_accounts").select("*").order("name", { ascending: true }),
        supabase.from("seller_settlements").select("*").order("created_at", { ascending: false }),
        supabase.from("seller_transfers").select("*").order("created_at", { ascending: false }),
        supabase.from("odemeler").select("*").order("created_at", { ascending: false }),
        supabase.from("odeme_kaynaklari").select("*"),
        supabase.rpc("get_sold_qty_by_product"),
        supabase.rpc("get_sold_qty_by_batch_item"),
        supabase.rpc("get_sold_qty_by_product_batch"),
      ]);

      for (const res of [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes, suppliersRes, supplierReturnsRes, sellerAccountsRes, sellerSettlementsRes, sellerTransfersRes]) {
        if (res.error) throw res.error;
      }
      // odemeler/odeme_kaynaklari satıcı rolünde RLS ile boş döner, hata fırlatmaz - ayrı kontrol
      if (odemelerRes.error && !isSellerRole) throw odemelerRes.error;
      if (odemeKaynaklariRes.error && !isSellerRole) throw odemeKaynaklariRes.error;
      setOdemeler((odemelerRes.data || []) as Odeme[]);
      setOdemeKaynaklari((odemeKaynaklariRes.data || []) as OdemeKaynak[]);

      // RLS nedeniyle satıcı oturumunda "sales" tablosu kendi satışlarıyla sınırlı olduğu için,
      // stok hesaplaması bu RPC'lerden gelen (RLS'i bypass eden, sadece agregat) rakamları kullanır.
      if (soldByProductRes.error) console.warn("get_sold_qty_by_product hata", soldByProductRes.error);
      if (soldByBatchItemRes.error) console.warn("get_sold_qty_by_batch_item hata", soldByBatchItemRes.error);
      if (soldByProductBatchRes.error) console.warn("get_sold_qty_by_product_batch hata", soldByProductBatchRes.error);
      const soldByProductMap: Record<string, number> = {};
      for (const row of (soldByProductRes.data || []) as { product_id: string; toplam_satilan: number }[]) {
        soldByProductMap[row.product_id] = Number(row.toplam_satilan || 0);
      }
      setSoldQtyByProduct(soldByProductMap);
      const soldByBatchItemMap: Record<string, number> = {};
      for (const row of (soldByBatchItemRes.data || []) as { batch_item_id: string; toplam_satilan: number }[]) {
        soldByBatchItemMap[row.batch_item_id] = Number(row.toplam_satilan || 0);
      }
      setSoldQtyByBatchItem(soldByBatchItemMap);
      const soldByProductBatchMap: Record<string, number> = {};
      for (const row of (soldByProductBatchRes.data || []) as { product_id: string; batch_id: string; toplam_satilan: number }[]) {
        soldByProductBatchMap[`${row.product_id}__${row.batch_id}`] = Number(row.toplam_satilan || 0);
      }
      setSoldQtyByProductBatch(soldByProductBatchMap);

      setProducts((productsRes.data || []) as Product[]);

      const loadedSellers = (sellerAccountsRes.data || []) as SellerAccount[];

      setCustomers((customersRes.data || []) as Customer[]);
      setBatches((batchesRes.data || []) as Batch[]);
      setBatchItems((batchItemsRes.data || []) as BatchItem[]);
      setSales((salesRes.data || []) as Sale[]);
      setPayments((paymentsRes.data || []) as Payment[]);
      setPartners((partnersRes.data || []) as PartnerRow[]);
      setPeriods((periodsRes.data || []) as Period[]);
      setBatchCosts((batchCostsRes.data || []) as BatchCost[]);
      setPreorders((preordersRes.data || []) as Preorder[]);
      setPreorderItems((preorderItemsRes.data || []) as PreorderItem[]);
      setPaymentAllocations((paymentAllocationsRes.data || []) as {id:string; payment_id:string; sale_id:string; amount:number; created_at:string}[]);
      setSuppliers((suppliersRes.data || []) as Supplier[]);
      setSupplierReturns((supplierReturnsRes.data || []) as SupplierReturn[]);
      setSellerAccounts(loadedSellers);
      setSellerSettlements((sellerSettlementsRes.data || []) as SellerSettlement[]);
      setSellerTransfers((sellerTransfersRes.data || []) as SellerTransfer[]);
      // Initialize costInputs from loaded data - merge with existing to not lose unsaved changes
      const inputs: Record<string, Record<string, string>> = {};
      for (const c of (batchCostsRes.data || []) as BatchCost[]) {
        inputs[c.batch_id] = {
          veli: String(c.veli || 0),
          asli: String(c.asli || 0),
          mihrimah: String(c.mihrimah || 0),
          kasa: String(c.kasa || 0),
          kargo: String(c.kargo || 0),
          diger: String(c.diger || 0),
          aciklama: c.aciklama || "",
        };
      }
      // Veritabanındaki taze veri önceliklidir (örn. Ödemeler ekranından Kargo alanına yazılan güncelleme
      // burada da görünsün diye) - sadece DB'de hiç kaydı olmayan (henüz hiç kaydedilmemiş, yeni girilen)
      // partiler için yerel taslak korunur.
      setCostInputs((prev) => ({ ...prev, ...inputs }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) : String(err);
      if (!isRetry && /jwt issued at future|jwt.*future/i.test(errMsg)) {
        // Saat kayması nedeniyle token geçersiz görünüyor olabilir - oturumu tazeleyip bir kez daha dene.
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr) {
          setLoadingData(false);
          return loadAll(true);
        }
      }
      showError(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const logAction = async (
    action: string,
    entityType: string,
    entityName?: string,
    details?: Record<string, unknown>
  ) => {
    try {
      const { data } = await supabase.auth.getUser();
      await supabase.from("audit_log").insert({
        action,
        entity_type: entityType,
        entity_name: entityName || "",
        user_email: data.user?.email || "",
        details: details || {},
      });
    } catch (err) {
      console.warn("Audit log yazılamadı", err);
    }
  };

  // Bir kaydın güncelleme öncesi (oldObj) ve yeni değerlerini (patch) alıp
  // logAction'a { before, after } formatında geçirilecek diff objesi üretir.
  const diffOf = (oldObj: Record<string, unknown> | null | undefined, patch: Record<string, unknown>) => {
    const before: Record<string, unknown> = {};
    Object.keys(patch).forEach((key) => {
      before[key] = oldObj && oldObj[key] !== undefined ? oldObj[key] : null;
    });
    return { before, after: patch };
  };

  const batchItemsForProduct = (productId: string) => batchItems.filter((item) => item.product_id === productId);

  const getBatchSoldQty = (productId: string, batchId: string) => {
    // Find all batch_items for this product+batch combination
    const items = batchItems.filter((i) => i.product_id === productId && i.batch_id === batchId);
    if (items.length <= 1) {
      // Only one row — normal calculation
      return activeSales.filter((sale) => sale.product_id === productId && sale.batch_id === batchId).reduce((sum, sale) => sum + sale.qty, 0);
    }
    // Multiple rows (split depo) — assign sales only to the first/oldest row
    // We identify "this" item by checking if it's the one with the most bought (original row)
    // Sales are assigned to the row with the highest bought count (the original)
    return 0; // Will be overridden below
  };

  const getBatchSoldQtyForItem = (item: BatchItem) => {
    // RLS nedeniyle "sales" state'i satıcı oturumunda kendi satışlarıyla sınırlı;
    // bu yüzden RPC'den gelen (tüm satıcıları kapsayan) agregat rakamları kullanıyoruz.
    // Yeni satışlar (batch_item_id ile etiketli):
    const byItemId = soldQtyByBatchItem[item.id] || 0;
    // Eski satışlar (batch_item_id'siz, ürün+parti ile eşleşen):
    const oldTotal = soldQtyByProductBatch[`${item.product_id}__${item.batch_id}`] || 0;
    if (oldTotal === 0) return byItemId;
    // Split depo (aynı ürün+parti için birden fazla satır) varsa eski satışları
    // en yüksek "bought" değerine sahip satırdan başlayarak dağıt (greedy).
    const siblings = batchItems.filter((i) => i.product_id === item.product_id && i.batch_id === item.batch_id);
    if (siblings.length <= 1) return byItemId + oldTotal;
    const sorted = [...siblings].sort((a, b) => b.bought - a.bought);
    let remaining = oldTotal;
    for (const sib of sorted) {
      const assign = Math.min(sib.bought, remaining);
      if (sib.id === item.id) return byItemId + assign;
      remaining -= assign;
    }
    return byItemId;
  };

  const getProductTotalBought = (productId: string) => batchItemsForProduct(productId).reduce((sum, item) => sum + item.bought, 0);
  // RLS nedeniyle satıcı oturumunda "sales" state'i sadece kendi satışlarını içerir;
  // stok hesabı bu yüzden RPC'den gelen (tüm satıcıları kapsayan agregat) rakamı kullanır.
  const getProductSoldQty = (productId: string) => soldQtyByProduct[productId] || 0;
  const getProductStock = (productId: string) => getProductTotalBought(productId) - getProductSoldQty(productId);
  // Varyant bazlı stok (Ana / Cep Boy) - RPC ürün bazında toplu geldiği için burada
  // batch_item bazlı (getBatchSoldQtyForItem) hesaplama kullanılır, variant'a göre filtrelenir.
  const getProductVariantStock = (productId: string, variant: "ana" | "cep_boy") =>
    batchItemsForProduct(productId)
      .filter((item) => (item.variant || "ana") === variant)
      .reduce((sum, item) => sum + Math.max(item.bought - getBatchSoldQtyForItem(item), 0), 0);
  const getCustomerSalesTotal = (customerId: string) =>
    activeSales
      .filter((sale) => sale.customer_id === customerId)
      .reduce((sum, sale) => sum + toNum(sale.total), 0);

  const getCustomerUnpaidSalesTotal = (customerId: string) =>
    activeSales
      .filter((sale) => sale.customer_id === customerId && !sale.paid)
      .reduce((sum, sale) => sum + toNum(sale.total), 0);

  const getCustomerPaidSalesTotal = (customerId: string) =>
    activeSales
      .filter((sale) => sale.customer_id === customerId && sale.paid)
      .reduce((sum, sale) => sum + toNum(sale.total), 0);

  const getCustomerManualPaymentsTotal = (customerId: string) =>
    activePayments
      .filter((payment) => payment.customer_id === customerId)
      .reduce((sum, payment) => sum + toNum(payment.amount), 0);

  const getCustomerCollectedTotal = (customerId: string) => {
    const manualPayments = getCustomerManualPaymentsTotal(customerId);
    // Eski peşin satışlar (payments tablosunda kaydı olmayanlar)
    const paymentCustomerIds = new Set(activePayments.map((p) => p.customer_id));
    const oldPaidSales = activeSales
      .filter((s) => s.customer_id === customerId && s.paid && s.sale_type === "Normal satış")
      .reduce((sum, s) => {
        // Bu satış için payments'ta kayıt var mı?
        const hasPayment = activePayments.some(
          (p) => p.customer_id === customerId &&
          Math.abs(toNum(p.amount) - toNum(s.total)) < 0.01 &&
          Math.abs(new Date(p.created_at).getTime() - new Date(s.created_at).getTime()) < 5000
        );
        return hasPayment ? sum : sum + toNum(s.total);
      }, 0);
    return manualPayments + oldPaidSales;
  };

  const getCustomerBalance = (customerId: string) =>
    Math.max(getCustomerSalesTotal(customerId) - getCustomerCollectedTotal(customerId), 0);

  // Her partideki toplam alınan adet (bought) - birim ek maliyet hesaplamak için
  const batchBoughtTotal = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of batchItems) {
      map.set(item.batch_id, (map.get(item.batch_id) || 0) + Number(item.bought || 0));
    }
    return map;
  }, [batchItems]);
  // Birim ek maliyet artık manuel girilmiyor: Parti Maliyet Kaydı'ndaki Kargo tutarı
  // (kasa'dan ödenen + şahsi cüzdandan ödenen kargo toplamı), o partideki toplam alınan
  // adede bölünerek otomatik hesaplanır.
  const getKargoToplam = (cost: BatchCost | undefined) =>
    Number(cost?.kargo || 0) + Number(cost?.kargo_veli || 0) + Number(cost?.kargo_asli || 0) + Number(cost?.kargo_mihrimah || 0);
  const getDigerToplam = (cost: BatchCost | undefined) =>
    Number(cost?.diger || 0) + Number(cost?.diger_veli || 0) + Number(cost?.diger_asli || 0) + Number(cost?.diger_mihrimah || 0);
  const getEkMaliyet = (batchId: string) => {
    const cost = batchCosts.find((c) => c.batch_id === batchId);
    const kargo = getKargoToplam(cost);
    const totalQty = batchBoughtTotal.get(batchId) || 0;
    if (!kargo || !totalQty) return 0;
    return kargo / totalQty;
  };

  const anlıkKar = useMemo(() => {
    const lastClosed = periods
      .filter((p) => p.closed && p.closed_at)
      .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
    const sinceDate = lastClosed ? new Date(lastClosed.closed_at!) : new Date(0);

    // Son kapanıştan sonra gelen allocation'lar
    const recentAllocs = paymentAllocations.filter((a) => new Date(a.created_at) > sinceDate);

    // Sale map
    const saleMap = new Map(activeSales.map((s) => [s.id, s]));

    return recentAllocs.reduce((toplam, alloc) => {
      const sale = saleMap.get(alloc.sale_id);
      if (!sale) return toplam;
      if (sale.sale_type === "Fire/Bozuk") return toplam;

      const realCost = toNum(sale.cost) - Number(sale.seller_profit || 0);
      const ekMaliyet = getEkMaliyet(sale.batch_id) * sale.qty + Number(sale.seller_profit || 0);

      if (sale.sale_type === "Hibe") {
        return toplam - (realCost + ekMaliyet);
      }

      const total = toNum(sale.total);
      if (total <= 0) return toplam;
      const oran = alloc.amount / total;
      return toplam + alloc.amount - (realCost + ekMaliyet) * oran;
    }, 0);
  }, [paymentAllocations, activeSales, batchCosts, batchBoughtTotal, periods]);

  // Her satıcının SADECE son kapanıştan bu yana gerçekleşen kâr payı (anlıkKar ile aynı "sinceDate" mantığı)
  const sellerRealizedProfitSinceClose = useMemo(() => {
    const lastClosed = periods
      .filter((p) => p.closed && p.closed_at)
      .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
    const sinceDate = lastClosed ? new Date(lastClosed.closed_at!) : new Date(0);
    const recentAllocs = paymentAllocations.filter((a) => new Date(a.created_at) > sinceDate);
    const saleMap = new Map(activeSales.map((s) => [s.id, s]));
    const map = new Map<string, number>();
    for (const alloc of recentAllocs) {
      const sale = saleMap.get(alloc.sale_id);
      if (!sale || !sale.seller_account_id) continue;
      const total = toNum(sale.total);
      if (total <= 0) continue;
      const oran = alloc.amount / total;
      const profit = Number(sale.seller_profit || 0);
      map.set(sale.seller_account_id, (map.get(sale.seller_account_id) || 0) + profit * oran);
    }
    return map;
  }, [paymentAllocations, activeSales, periods]);

  const sellerRealizedProfitTotalSinceClose = useMemo(
    () => Array.from(sellerRealizedProfitSinceClose.values()).reduce((s, v) => s + v, 0),
    [sellerRealizedProfitSinceClose]
  );

  // Dönem kapanışında dağıtılacak toplam kâr = şirket kârı (anlıkKar) + satıcıların bu dönem gerçekleşen kâr payları
  const donemKapanisKari = useMemo(
    () => anlıkKar + sellerRealizedProfitTotalSinceClose,
    [anlıkKar, sellerRealizedProfitTotalSinceClose]
  );

  const karDetay = useMemo(() => {
    const lastClosed = periods
      .filter((p) => p.closed && p.closed_at)
      .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
    const sinceDate = lastClosed ? new Date(lastClosed.closed_at!) : new Date(0);
    const recentAllocs = paymentAllocations.filter((a) => new Date(a.created_at) > sinceDate);
    const saleMap = new Map(activeSales.map((s) => [s.id, s]));
    const paymentMap = new Map(payments.map((p) => [p.id, p]));

    return recentAllocs
      .filter((alloc) => {
        const sale = saleMap.get(alloc.sale_id);
        return sale && sale.sale_type !== "Fire/Bozuk";
      })
      .map((alloc) => {
        const sale = saleMap.get(alloc.sale_id)!;
        const realCost = toNum(sale.cost) - Number(sale.seller_profit || 0);
        const total = toNum(sale.total);
        const ekMaliyet = getEkMaliyet(sale.batch_id) * sale.qty + Number(sale.seller_profit || 0);
        const oran = sale.sale_type === "Hibe" ? 1 : (total > 0 ? alloc.amount / total : 1);
        const gercekMaliyet = (realCost + ekMaliyet) * oran;
        const kar = sale.sale_type === "Hibe" ? -(realCost + ekMaliyet) : alloc.amount - gercekMaliyet;
        const linkedPayment = paymentMap.get(alloc.payment_id);
        const fromPreviousPeriod = !!linkedPayment && new Date(linkedPayment.created_at) <= sinceDate;
        return {
          tarih: alloc.created_at,
          cari: customerMap.get(sale.customer_id)?.name || "-",
          urun: saleProductName(sale),
          adet: sale.qty,
          satisFiyati: total,
          tahsilat: alloc.amount,
          maliyet: realCost,
          ekMaliyet,
          kar,
          saleType: sale.sale_type,
          fromPreviousPeriod,
        };
      })
      .sort((a, b) => b.kar - a.kar);
  }, [paymentAllocations, activeSales, payments, batchCosts, batchBoughtTotal, periods, customerMap, productMap]);

  const totals = useMemo(() => {
    const scopedCustomers = isSellerRole ? myCustomers : customers;
    const scopedActivePayments = isSellerRole ? myActivePayments : activePayments;
    const scopedActiveSales = isSellerRole ? myActiveSales : activeSales;
    const customerDebt = scopedCustomers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const stockValue = batchItems.reduce((sum, item) => sum + Math.max(item.bought - getBatchSoldQtyForItem(item), 0) * item.buy_price, 0);
    const totalStock = products.filter((p) => !p.passive).reduce((sum, p) => sum + getProductStock(p.id), 0);
    const lastClosedPeriod = periods.filter((p) => p.closed && p.closed_at).sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
    const lastClosedAt = lastClosedPeriod?.closed_at;
    const openingBalance = Number(lastClosedPeriod?.devir_bakiyesi || 0);
    const openingBalancePeriodId = lastClosedPeriod?.id || null;
    const openingBalanceNote = lastClosedPeriod?.devir_bakiyesi_notu || "";
    const sinceDate = lastClosedAt ? new Date(lastClosedAt) : new Date(0);
    const recentPayments = scopedActivePayments.filter((p) => new Date(p.created_at) > sinceDate);
    // Son kapanıştan ÖNCE girilmiş ama kasa bakiyesi hâlâ harcanmamış (devir bakiyesine kaynak) tahsilatlar -
    // bunlar artık "bu dönem" listesinde değil ama parası hâlâ orada duruyor, ayrı renkte gösterilecek.
    const carriedOverPayments = scopedActivePayments.filter((p) => new Date(p.created_at) <= sinceDate && Number(p.kasa_tutari || 0) > 0);
    const isPendingAdvance = (p: Payment) => {
      if (!p.preorder_id) return false;
      const po = preorderMap.get(p.preorder_id);
      return !!po && po.status === "bekliyor";
    };
    const tahsilatEligiblePayments = recentPayments.filter((p) => !isPendingAdvance(p));
    const recentRefunds = supplierReturns.filter((r) => r.resolution_type === "para" && r.resolved_at && new Date(r.resolved_at) > sinceDate);
    const refundIncome = isSellerRole ? 0 : recentRefunds.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
    const grossCash = tahsilatEligiblePayments.reduce((sum, item) => sum + item.amount, 0) + refundIncome;
    const pendingAdvanceTotal = scopedActivePayments
      .filter((p) => isPendingAdvance(p))
      .reduce((sum, p) => sum + Number(p.kasa_tutari ?? p.amount ?? 0), 0);
    const pastPendingAdvanceTotal = scopedActivePayments
      .filter((p) => isPendingAdvance(p) && new Date(p.created_at) <= sinceDate)
      .reduce((sum, p) => sum + Number(p.kasa_tutari ?? p.amount ?? 0), 0);
    const distributedCash = isSellerRole ? 0 : periods
      .filter((period) => period.closed)
      .reduce((sum, period) => sum + Number(period.asli_distribution || 0) + Number(period.mihrimah_distribution || 0), 0);
    const cash = Math.max(grossCash - distributedCash, 0);
    const revenue = cash + customerDebt + distributedCash;
    const profit = scopedActiveSales.reduce((sum, item) => sum + (item.total - item.cost), 0);
    return { revenue, profit, customerDebt, stockValue, totalStock, grossCash, distributedCash, cash, recentPayments, carriedOverPayments, refundIncome, openingBalance, openingBalancePeriodId, openingBalanceNote, pendingAdvanceTotal, pastPendingAdvanceTotal };
  }, [products, customers, myCustomers, batchItems, activeSales, myActiveSales, activePayments, myActivePayments, periods, supplierReturns, preorderMap, isSellerRole]);


  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return sortedCustomers;
    return sortedCustomers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [sortedCustomers, customerSearch]);

  const recentMovements = useMemo(() => {
    const scopedActiveSales = isSellerRole ? myActiveSales : activeSales;
    const scopedActivePayments = isSellerRole ? myActivePayments : activePayments;
    const shortUser = (email?: string, seller?: string | null) => {
      if (seller === "Aslı" || seller === "Mihrimah") return seller === "Mihrimah" ? "Mihri" : "Aslı";
      if (!email) return "-";
      if (email.includes("asli")) return "Aslı";
      if (email.includes("mihrimah")) return "Mihri";
      if (email.includes("veli")) return "Veli";
      const matchedSeller = sellerAccounts.find((s) => s.email.toLowerCase() === email.toLowerCase());
      if (matchedSeller) return matchedSeller.name;
      return email.split("@")[0];
    };

    const saleRows = scopedActiveSales.map((sale) => {
      const methodSuffix = sale.paid && sale.sale_type === "Normal satış"
        ? (sale.payment_method === "nakit" ? " (Nakit)" : sale.payment_method === "banka" ? " (Banka)" : "")
        : "";
      return {
        id: `sale-${sale.id}`,
        date: sale.created_at,
        type: sale.sale_type === "Fire/Bozuk" ? "Fire/Bozuk" : sale.paid ? "Peşin satış" : "Cari satış",
        customer: customerMap.get(sale.customer_id)?.name || "-",
        detail: `${saleProductName(sale)} / ${batchMap.get(sale.batch_id)?.name || "-"} / ${sale.qty} adet${methodSuffix}`,
        amount: toNum(sale.total),
        user: sale.seller_account_id ? (sellerAccountMap.get(sale.seller_account_id)?.name || "Satıcı") : shortUser(undefined, sale.seller),
      };
    });

    // Peşin satışlara otomatik eklenen payment'ları filtrele (aynı müşteri, aynı tutar, aynı dakika)
    const pesinSaleKeys = new Set(
      scopedActiveSales
        .filter((s) => s.paid && s.sale_type === "Normal satış")
        .map((s) => `${s.customer_id}-${s.total}-${s.created_at?.slice(0,16)}`)
    );

    const paymentRows = scopedActivePayments
      .filter((payment) => {
        const key = `${payment.customer_id}-${payment.amount}-${payment.created_at?.slice(0,16)}`;
        return !pesinSaleKeys.has(key);
      })
      .map((payment) => ({
        id: `payment-${payment.id}`,
        date: payment.created_at,
        type: "Tahsilat",
        customer: customerMap.get(payment.customer_id)?.name || "-",
        detail: payment.payment_method === "nakit" ? "Tahsilat nakit alındı" : payment.payment_method === "banka" ? "Tahsilat banka alındı" : "Cari ödeme",
        amount: toNum(payment.amount),
        user: shortUser(payment.user_email ?? undefined),
      }));

    const auditRows = isSellerRole ? [] : auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      date: log.created_at,
      type: log.action,
      customer: log.entity_type,
      detail: log.entity_name || "-",
      amount: 0,
      user: shortUser(log.user_email ?? undefined),
    }));

    return [...saleRows, ...paymentRows, ...auditRows]
      .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())
      .slice(0, 100);
  }, [activeSales, myActiveSales, activePayments, myActivePayments, isSellerRole, auditLogs, customerMap, productMap, batchMap, sellerAccounts, sellerAccountMap]);

  const uploadImageToStorage = async (base64: string, fileName: string): Promise<string | null> => {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "jpg";
      const path = `${fileName}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) { showError(error); return null; }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      showError(err);
      return null;
    }
  };

  const addProductDefinition = async () => {
    const name = newProduct.name.trim();
    if (!name || name.length > 50) return setMessage("Ürün adı zorunlu ve en fazla 50 karakter olmalı.");
    if (products.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setMessage("Bu kaynak ürün zaten kayıtlı.");

    const idTail = Date.now().toString().slice(-6);
    const code = `URN-${idTail}`;

    let imageUrl: string | null = null;
    if (newProduct.image) {
      setMessage("Resim yükleniyor...");
      imageUrl = await uploadImageToStorage(newProduct.image, code);
    }

    const { error } = await supabase.from("products").insert({
      name,
      code,
      gender_category: newProduct.genderCategory,
      image_url: imageUrl,
      usd_fiyat_tyuksel: newProduct.usdTyuksel ? Number(newProduct.usdTyuksel) : null,
      usd_fiyat_thasan: newProduct.usdThasan ? Number(newProduct.usdThasan) : null,
      usd_fiyat_tamir: newProduct.usdTamir ? Number(newProduct.usdTamir) : null,
    });
    if (error) return showError(error);
    await logAction("Ürün eklendi", "products", name, { code, usd_tyuksel: newProduct.usdTyuksel || null, usd_thasan: newProduct.usdThasan || null, usd_tamir: newProduct.usdTamir || null });
    setNewProduct({ name: "", genderCategory: "Kadın", image: "", usdTyuksel: "", usdThasan: "", usdTamir: "" });
    setMessage("Kaynak ürün kaydedildi.");
    loadAll();
  };

  const updateProduct = async (productId: string, patch: Partial<Product>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.code !== undefined) dbPatch.code = patch.code;
    if (patch.gender_category !== undefined) dbPatch.gender_category = patch.gender_category;
    if (patch.image_url !== undefined) dbPatch.image_url = patch.image_url;
    if (patch.passive !== undefined) dbPatch.passive = patch.passive;
    if (patch.manual_price !== undefined) dbPatch.manual_price = patch.manual_price;
    const oldProduct = products.find((p) => p.id === productId);
    const { error } = await supabase.from("products").update(dbPatch).eq("id", productId);
    if (error) return showError(error);
    // Exclude image_url from log to avoid storing large base64/URL data
    const { image_url: _img, ...logPatch } = dbPatch as Record<string, unknown> & { image_url?: unknown };
    await logAction("Ürün değiştirildi", "products", oldProduct?.name || productId, diffOf(oldProduct as unknown as Record<string, unknown>, logPatch));
    loadAll();
  };

  const deleteProduct = async (productId: string) => {

    const product = products.find((p) => p.id === productId);
    if (!product) return;


    const hasSales = activeSales.some((sale) => sale.product_id === productId);
    if (hasSales) {
      await updateProduct(productId, { passive: true });
      await logAction("Ürün pasife alındı", "products", product.name);
      return setMessage("Ürün satışlarda kullanıldığı için silinmedi, pasife alındı.");
    }
    const hasBatch = batchItems.some((item) => item.product_id === productId);
    if (hasBatch) return setMessage("Bu ürüne bağlı parti girişi var. Önce parti satırlarını silin.");
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return showError(error);
    await logAction("Ürün silindi", "products", product.name);
    setMessage("Ürün silindi.");
    loadAll();
  };

  const addCustomer = async () => {
    const name = newCustomerName.trim();
    if (!name || name.length > 50) return setMessage("Cari adı zorunlu ve en fazla 50 karakter olmalı.");
    if (customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setMessage("Bu cari zaten kayıtlı.");
    const { error } = await supabase.from("customers").insert({ name, seller_account_id: currentSellerAccount?.id || null, created_by: currentUserEmail || null });
    if (error) return showError(error);
    await logAction("Cari eklendi", "customers", name);
    setNewCustomerName("");
    loadAll();
  };

  const updateCustomerName = async (customerId: string, name: string) => {
    if (name.length > 50) return;
    const oldName = customers.find((c) => c.id === customerId)?.name || customerId;
    const { error } = await supabase.from("customers").update({ name }).eq("id", customerId);
    if (error) return showError(error);
    await logAction("Cari değiştirildi", "customers", oldName, diffOf({ ad: oldName }, { ad: name }));
    loadAll();
  };

  const deleteCustomer = async (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;	
    const hasSales = activeSales.some((sale) => sale.customer_id === customerId);
    const hasPayments = activePayments.some((p) => p.customer_id === customerId);
    if (hasSales || hasPayments) {
      const { error } = await supabase.from("customers").update({ passive: true }).eq("id", customerId);
      if (error) return showError(error);
      await logAction("Cari pasife alındı", "customers", customer.name, diffOf({ pasif: customer.passive }, { pasif: true }));
      setMessage("Cari hareket gördüğü için silinmedi, pasife alındı.");
      return loadAll();
    }
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) return showError(error);
    await logAction("Cari silindi", "customers", customer.name);
    setMessage("Cari silindi.");
    loadAll();
  };

  const addBatchName = async () => {
    const name = newBatchName.trim();
    if (!name) return setMessage("Parti adı boş olamaz.");
    if (batches.some((b) => b.name === name)) return setMessage("Bu parti zaten kayıtlı.");
    const { error } = await supabase.from("batches").insert({ name, supplier_id: newBatchSupplierId || null });
    if (error) return showError(error);
    await logAction("Parti eklendi", "batches", name, { toptanci: newBatchSupplierId ? supplierMap.get(newBatchSupplierId)?.name : "Belirtilmedi" });
    setNewBatchName("");
    setNewBatchSupplierId("");
    setMessage("Yeni parti adı kaynak listeye eklendi.");
    loadAll();
  };

  const deleteBatchName = async (batchId: string) => {
    const used = batchItems.some((item) => item.batch_id === batchId) || activeSales.some((sale) => sale.batch_id === batchId);
    if (used) return setMessage("Bu parti kullanıldığı için silinemez.");
    const batchName = batches.find((b) => b.id === batchId)?.name || batchId;
    const { error } = await supabase.from("batches").delete().eq("id", batchId);
    if (error) return showError(error);
    await logAction("Parti silindi", "batches", batchName);
    loadAll();
  };

  const renameBatchName = async (batchId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    if (batches.some((b) => b.name === clean && b.id !== batchId)) return setMessage("Bu parti adı zaten var.");
    const oldName = batches.find((b) => b.id === batchId)?.name || batchId;
    const { error } = await supabase.from("batches").update({ name: clean }).eq("id", batchId);
    if (error) return showError(error);
    await logAction("Parti değiştirildi", "batches", oldName, diffOf({ ad: oldName }, { ad: clean }));
    loadAll();
  };

  const addSupplier = async () => {
    const clean = newSupplierName.trim();
    if (!clean) return setMessage("Toptancı adı zorunlu.");
    if (suppliers.some((s) => s.name.toLowerCase() === clean.toLowerCase())) return setMessage("Bu toptancı zaten var.");
    const { data, error } = await supabase.from("suppliers").insert({ name: clean }).select();
    if (error) return showError(error);
    if (data && data[0]) setSuppliers((prev) => [...prev, data[0] as Supplier].sort((a, b) => a.name.localeCompare(b.name, "tr")));
    await logAction("Toptancı eklendi", "suppliers", clean);
    setNewSupplierName("");
    setMessage(`${clean} eklendi.`);
  };

  const addSellerAccount = async () => {
    const name = newSellerName.trim();
    const email = newSellerEmail.trim().toLowerCase();
    if (!name || !email) return setMessage("Satıcı adı ve e-postası zorunlu.");
    if (sellerAccounts.some((s) => s.email.toLowerCase() === email)) return setMessage("Bu e-posta zaten bir satıcıya ait.");
    const { data, error } = await supabase.from("seller_accounts").insert({ name, email, active: true }).select();
    if (error) return showError(error);
    if (data && data[0]) setSellerAccounts((prev) => [...prev, data[0] as SellerAccount].sort((a, b) => a.name.localeCompare(b.name, "tr")));
    await logAction("Satıcı eklendi", "seller_accounts", name, { email });
    setNewSellerName("");
    setNewSellerEmail("");
    setMessage(`${name} satıcı olarak eklendi. Şimdi Supabase Authentication'dan bu e-posta ile bir kullanıcı oluşturman gerekiyor: ${email}`);
  };

  const toggleSellerActive = async (seller: SellerAccount) => {
    const { error } = await supabase.from("seller_accounts").update({ active: !seller.active }).eq("id", seller.id);
    if (error) return showError(error);
    setSellerAccounts((prev) => prev.map((s) => s.id === seller.id ? { ...s, active: !s.active } : s));
    await logAction(seller.active ? "Satıcı pasif edildi" : "Satıcı aktif edildi", "seller_accounts", seller.name, diffOf({ aktif: seller.active }, { aktif: !seller.active }));
  };

  const deleteSellerAccount = async (seller: SellerAccount) => {
    const hasSales = sales.some((s) => s.seller_account_id === seller.id);
    const hasPayments = payments.some((p) => p.seller_account_id === seller.id);
    const hasCustomers = customers.some((c) => c.seller_account_id === seller.id);
    const hasPreorders = preorders.some((p) => p.seller_account_id === seller.id);
    const hasSettlements = sellerSettlements.some((s) => s.seller_account_id === seller.id);
    if (hasSales || hasPayments || hasCustomers || hasPreorders || hasSettlements) {
      setMessage(`${seller.name} adına satış/tahsilat/cari/ön sipariş kaydı var, silinemiyor. "Pasif Et" kullanabilirsin.`);
      return;
    }
    if (!confirm(`${seller.name} satıcısı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    const { error } = await supabase.from("seller_accounts").delete().eq("id", seller.id);
    if (error) return showError(error);
    setSellerAccounts((prev) => prev.filter((s) => s.id !== seller.id));
    await logAction("Satıcı silindi", "seller_accounts", seller.name);
    setMessage(`${seller.name} silindi.`);
    if (openSellerId === seller.id) setOpenSellerId(null);
  };

  const getSellerSummary = (sellerId: string) => {
    // Son kapanıştan bu yana - diğer tüm ekranlarla (anlıkKar, karDetay) aynı mantık
    const lastClosed = periods
      .filter((p) => p.closed && p.closed_at)
      .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())[0];
    const sinceDate = lastClosed ? new Date(lastClosed.closed_at!) : new Date(0);

    const sellerSales = activeSales.filter((s) => s.seller_account_id === sellerId);
    const sellerSaleIds = new Set(sellerSales.map((s) => s.id));
    const sellerCustomerIds = new Set(customers.filter((c) => c.seller_account_id === sellerId).map((c) => c.id));
    // "Satış" kutusu bilinçli olarak kümülatif (tüm zamanlar) kalıyor - dönem kapanışıyla sıfırlanmıyor.
    const totalSatis = sellerSales.reduce((sum, s) => sum + toNum(s.total), 0);
    // Kâr payı (toplam) - SADECE son kapanıştan sonra yapılmış satışlardan
    const totalKarPayi = sellerSales
      .filter((s) => new Date(s.created_at) > sinceDate)
      .reduce((sum, s) => sum + Number(s.seller_profit || 0), 0);
    // Satışın sadece FİİLEN TAHSİL EDİLMİŞ kısmı satıcının elinde olabilir - bu yüzden
    // "bize borç" ve "gerçekleşen kâr" tam satış tutarı üzerinden değil, her tahsilatın
    // (payment_allocations) o satışa düşen oranı üzerinden hesaplanır (anlıkKar/karDetay
    // ile aynı yöntem). Ayrıca SADECE son kapanıştan sonraki tahsisler sayılır.
    const saleMap = new Map(sellerSales.map((s) => [s.id, s]));
    const sellerAllocs = paymentAllocations.filter((a) => sellerSaleIds.has(a.sale_id) && new Date(a.created_at) > sinceDate);
    let totalBizeBorcOrantili = 0;
    let gerceklesenKarPayi = 0;
    for (const alloc of sellerAllocs) {
      const sale = saleMap.get(alloc.sale_id);
      if (!sale) continue;
      const total = toNum(sale.total);
      if (total <= 0) continue;
      const oran = alloc.amount / total;
      const profit = Number(sale.seller_profit || 0);
      totalBizeBorcOrantili += (toNum(sale.cost) - profit) * oran;
      gerceklesenKarPayi += profit * oran;
    }
    const totalTeslimEdilen = sellerTransfers.filter((t) => t.seller_account_id === sellerId && new Date(t.created_at) > sinceDate).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const cariBorcu = customers.filter((c) => sellerCustomerIds.has(c.id)).reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const totalTahsilat = activePayments.filter((p) => p.seller_account_id === sellerId && new Date(p.created_at) > sinceDate).reduce((sum, p) => sum + toNum(p.amount), 0);
    // Size Kalan Borç = Tahsilat - Gerçekleşen Kâr Payı - (satıcının size zaten transfer ettiği tutar), ikisi de son kapanıştan bu yana.
    // Eksi çıkabilir: satıcı kendi kâr payı dahil HER ŞEYİ size verdiyse, eksi değer "siz ona borçlusunuz" anlamına gelir
    // (dönem kapanışında kâr payı öde mekanizmasıyla ona geri ödenir).
    const kalanBorc = totalTahsilat - gerceklesenKarPayi - totalTeslimEdilen;
    return { totalSatis, totalKarPayi, gerceklesenKarPayi, totalBizeBorc: totalBizeBorcOrantili, totalTeslimEdilen, kalanBorc, cariBorcu, totalTahsilat };
  };

  // Satıcıdan ortağa/Veli'ye yapılan iç transfer - bir müşteri tahsilatı DEĞİL, bu yüzden
  // "payments" tablosuna hiç dokunmuyor, kendi ayrı tablosunda (seller_transfers) tutuluyor.
  const recordSellerTransfer = async (sellerId: string, amount: number, alici: string, note: string) => {
    if (!amount || amount <= 0) return setMessage("Geçerli bir tutar girin.");
    if (!alici) return setMessage("Parayı kimin teslim aldığını seçmelisin.");
    try {
      const { error } = await supabase.from("seller_transfers").insert({ seller_account_id: sellerId, amount, alici, note: note || null, created_by: currentUserEmail });
      if (error) throw error;
      const sellerName = sellerAccountMap.get(sellerId)?.name || "";
      await logAction("Satıcı → Ortak transferi yapıldı", "seller_transfers", sellerName, { tutar: amount, alici });
      setMessage(`${money(amount)} transfer kaydedildi.`);
      loadAll();
    } catch (err) {
      showError(err);
    }
  };

  const updateBatchSupplier = async (batchId: string, supplierId: string) => {
    const value = supplierId || null;
    const oldSupplierId = batchMap.get(batchId)?.supplier_id || null;
    const { error } = await supabase.from("batches").update({ supplier_id: value }).eq("id", batchId);
    if (error) return showError(error);
    setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, supplier_id: value } : b));
    await logAction("Parti toptancısı güncellendi", "batches", batchMap.get(batchId)?.name || batchId, diffOf(
      { toptanci: oldSupplierId ? supplierMap.get(oldSupplierId)?.name : "Belirtilmedi" },
      { toptanci: value ? supplierMap.get(value)?.name : "Belirtilmedi" }
    ));
  };

  const submitSupplierReturn = async (item: BatchItem) => {
    const qty = Number(returnFormQty);
    if (!qty || qty <= 0) return setMessage("Geçerli bir adet girin.");
    const kalan = item.bought - getBatchSoldQtyForItem(item);
    if (qty > kalan) return setMessage(`Yetersiz stok: bu partide en fazla ${kalan} adet iade gönderebilirsin.`);

    const supplierId = returnFormSupplierId || batchMap.get(item.batch_id)?.supplier_id || null;

    const { error: updateErr } = await supabase.from("batch_items").update({ bought: item.bought - qty }).eq("id", item.id);
    if (updateErr) return showError(updateErr);

    const { error: insertErr } = await supabase.from("supplier_returns").insert({
      product_id: item.product_id,
      batch_item_id: item.id,
      batch_id: item.batch_id,
      supplier_id: supplierId,
      qty,
      resolution_type: "bekliyor",
      note: returnFormNote || null,
    });
    if (insertErr) return showError(insertErr);

    await logAction("İade gönderildi", "supplier_returns", productMap.get(item.product_id)?.name || item.product_id, {
      adet: qty,
      parti: batchMap.get(item.batch_id)?.name,
      toptanci: supplierId ? supplierMap.get(supplierId)?.name : "Belirtilmedi",
    });
    setMessage(`${qty} adet toptancıya iade için gönderildi olarak işaretlendi, stoktan düşüldü.`);
    setReturnFormItemId(null);
    setReturnFormQty("");
    setReturnFormSupplierId("");
    setReturnFormNote("");
    loadAll();
  };

  const resolveReturnAsProduct = async (ret: SupplierReturn) => {
    const item = batchItems.find((i) => i.id === ret.batch_item_id);
    if (!item) return setMessage("Orijinal parti kalemi bulunamadı, elle kontrol etmen gerekebilir.");
    const { error: updateErr } = await supabase.from("batch_items").update({ bought: item.bought + ret.qty }).eq("id", item.id);
    if (updateErr) return showError(updateErr);
    const { error } = await supabase.from("supplier_returns").update({ resolution_type: "urun", resolved_at: new Date().toISOString() }).eq("id", ret.id);
    if (error) return showError(error);
    await logAction("İade ürünle kapatıldı", "supplier_returns", productMap.get(ret.product_id)?.name || ret.product_id, { adet: ret.qty, parti: batchMap.get(ret.batch_id)?.name });
    setMessage(`${ret.qty} adet, eski maliyetiyle aynı partiye geri eklendi.`);
    loadAll();
  };

  const resolveReturnAsDifferentProduct = async (retId: string) => {
    const noteText = resolveDifferentProductNote.trim();
    if (!noteText) return setMessage("Yerine gelen ürünü açıklayan bir not girin.");
    const ret = supplierReturns.find((r) => r.id === retId);
    const { error } = await supabase.from("supplier_returns").update({ resolution_type: "farkli_urun", note: noteText, resolved_at: new Date().toISOString() }).eq("id", retId);
    if (error) return showError(error);
    await logAction("İade farklı ürünle kapatıldı", "supplier_returns", ret ? (productMap.get(ret.product_id)?.name || ret.product_id) : retId, { not: noteText });
    setMessage("İade, yerine farklı ürün geldi notuyla kapatıldı. Stoğa dokunulmadı (yeni ürünü zaten manuel eklediğini varsayıyorum).");
    setResolvingDifferentId(null);
    setResolveDifferentProductNote("");
    loadAll();
  };

  const resolveReturnAsMoney = async (retId: string) => {
    const amount = Number(resolveMoneyAmount);
    if (!amount || amount <= 0) return setMessage("Geçerli bir tutar girin.");
    const ret = supplierReturns.find((r) => r.id === retId);
    const { error } = await supabase.from("supplier_returns").update({ resolution_type: "para", refund_amount: amount, resolved_at: new Date().toISOString() }).eq("id", retId);
    if (error) return showError(error);
    await logAction("İade parayla kapatıldı", "supplier_returns", ret ? (productMap.get(ret.product_id)?.name || ret.product_id) : retId, { tutar: amount });
    setMessage(`${money(amount)} iade geliri kaydedildi, dönem kapanışında ortaklara eşit dağıtılacak.`);
    setResolvingReturnId(null);
    setResolveMoneyAmount("");
    loadAll();
  };

  const addBatchProduct = async () => {
    const productId = batchForm.productId;
    const batchId = batchForm.batchId;
    const bought = Number(batchForm.bought || 0);
    const buyPrice = Number(batchForm.buyPrice || 0);
    const salePrice = Number(batchForm.salePrice || 0);
    if (!productId) return setMessage("Parti kaydı için kaynak ürün seçmelisiniz.");
    if (!batchId) return setMessage("Parti adı zorunlu.");
    const batch = batchMap.get(batchId);
    if (!batch?.supplier_id) return setMessage("Bu partiye henüz toptancı atanmamış. Önce Parti Maliyet Kaydı'ndan toptancıyı seçin.");
    if (!batch?.usd_kuru) return setMessage("Bu partiye henüz USD kuru girilmemiş. Önce Parti Maliyet Kaydı'ndan USD kurunu girin.");
    if (bought <= 0 || buyPrice <= 0) return setMessage("Adet ve alış fiyatı 0'dan büyük olmalı.");

    const { error } = await supabase.from("batch_items").insert({
      product_id: productId,
      batch_id: batchId,
      bought,
      buy_price: buyPrice,
      sale_price: salePrice,
      depo: batchForm.depo || "Belirsiz",
      variant: batchForm.variant,
    });
    if (error) return showError(error);
    await logAction("Partiye ürün eklendi", "batch_items", `${productMap.get(productId)?.name || productId} / ${batchMap.get(batchId)?.name || batchId}${batchForm.variant === "cep_boy" ? " (Cep Boy)" : ""}`, { adet: bought, alis: buyPrice, satis: salePrice, depo: batchForm.depo, variant: batchForm.variant });
    setBatchForm({ batchId, productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Stok", variant: "ana" });
    setMessage("Parti ürün kaydı eklendi.");
    loadAll();
  };

  const updateBatchItem = async (itemId: string, patch: Partial<BatchItem>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.batch_id !== undefined) dbPatch.batch_id = patch.batch_id;
    if (patch.bought !== undefined) dbPatch.bought = patch.bought;
    if (patch.buy_price !== undefined) dbPatch.buy_price = patch.buy_price;
    if (patch.sale_price !== undefined) dbPatch.sale_price = patch.sale_price;
    if (patch.depo !== undefined) dbPatch.depo = patch.depo;
    if (patch.variant !== undefined) dbPatch.variant = patch.variant;
    const oldItem = batchItems.find((i) => i.id === itemId);
    const { error } = await supabase.from("batch_items").update(dbPatch).eq("id", itemId);
    if (error) return showError(error);
    const entityName = oldItem ? `${productMap.get(oldItem.product_id)?.name || oldItem.product_id} / ${batchMap.get(oldItem.batch_id)?.name || oldItem.batch_id}` : itemId;
    await logAction("Parti ürün satırı değiştirildi", "batch_items", entityName, diffOf(oldItem as unknown as Record<string, unknown>, dbPatch));
    loadAll();
  };

  const deleteBatchItem = async (item: BatchItem) => {
    const sold = getBatchSoldQtyForItem(item);
    if (sold > 0) return setMessage("Bu parti satırına bağlı aktif satış var. Önce ilgili satışları iptal edin.");
    // İptal edilmiş satışlar dahil, bu satıra referans veren HERHANGİ bir satış kaydı var mı kontrol et.
    // (İptal edilmiş bir satış bile veritabanında bu satıra foreign key ile bağlı kalır ve silmeyi engeller.)
    const hasAnySaleRef = sales.some((s) => s.batch_item_id === item.id);
    if (hasAnySaleRef) {
      return setMessage("Bu parti satırına bağlı (iptal edilmiş dahil) geçmiş satış kayıtları olduğu için silinemiyor. Bunun yerine miktarı 0 yaparak stoktan düşebilirsin; satır geçmiş kayıt olarak sistemde kalır.");
    }
    const { error } = await supabase.from("batch_items").delete().eq("id", item.id);
    if (error) {
      if ((error as { code?: string }).code === "23503") {
        return setMessage("Bu parti satırına bağlı geçmiş satış/işlem kayıtları olduğu için silinemiyor. Bunun yerine miktarı 0 yaparak stoktan düşebilirsin.");
      }
      return showError(error);
    }
    await logAction("Parti ürün satırı silindi", "batch_items", `${productMap.get(item.product_id)?.name || item.product_id} / ${batchMap.get(item.batch_id)?.name || item.batch_id}`);
    loadAll();
  };

  const addSaleFromForm = async () => {
    if (saleLoading) return;
    setSaleLoading(true);
    try {
    const customer = customers.find((c) => c.id === saleForm.customerId);
    const product = products.find((p) => p.id === saleForm.productId);
    const qty = Number(saleForm.qty || 0);
    if (!customer || !product || qty <= 0) return setMessage("Cari, ürün ve adet zorunlu.");
    if ((saleForm.saleType === "Hibe" || saleForm.saleType === "Fire/Bozuk") && !saleForm.note.trim()) {
      return setMessage("Hibe / Fire-Bozuk satışlarda açıklama girmek zorunlusun.");
    }
    if ((saleForm.paid === "banka" || saleForm.paid === "nakit") && !saleForm.paraSahibi) {
      return setMessage("Para kimde? alanını seçmelisin.");
    }
    // Depo VE varyant (Asıl Ürün / Cep Boy) bazlı stok kontrolü
    const depoStock = batchItemsForProduct(product.id)
      .filter((i) => i.depo === saleForm.depo && (i.variant || "ana") === saleForm.variant)
      .reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
    const variantLabel = saleForm.variant === "cep_boy" ? " (Cep Boy)" : "";
    if (depoStock < qty) return setMessage(`Yetersiz stok. ${saleForm.depo} deposunda bu üründen${variantLabel} sadece ${depoStock} adet var.`);

    let remainingQty = qty;
    const rows: Record<string, unknown>[] = [];

    // Filter by depo, batch (varsa) ve varyant - strictly match
    const availableItems = batchItemsForProduct(product.id).filter((item) => {
      const matchDepo = saleForm.depo ? item.depo === saleForm.depo : true;
      const matchBatch = !saleForm.batchId || item.batch_id === saleForm.batchId;
      const matchVariant = (item.variant || "ana") === saleForm.variant;
      return matchDepo && matchBatch && matchVariant;
    });

    for (const item of availableItems) {
      if (remainingQty <= 0) break;
      const available = Math.max(item.bought - getBatchSoldQtyForItem(item), 0);
      const take = Math.min(available, remainingQty);
      if (take <= 0) continue;
      const isZeroPrice = saleForm.saleType === "Hibe" || saleForm.saleType === "Fire/Bozuk";
      const totalPrice = isZeroPrice ? 0 : Number(saleForm.customSalePrice || 0);
      const isPaid = saleForm.paid !== "false" || isZeroPrice;
      const sellerProfitTotal = isSellerRole && !isZeroPrice ? Number(saleForm.sellerProfit || 0) : 0;
      const rowSellerProfit = qty > 0 ? (take / qty) * sellerProfitTotal : 0;
      rows.push({
        customer_id: customer.id,
        product_id: product.id,
        batch_id: item.batch_id,
        batch_item_id: item.id,
        seller: isSellerRole ? null : saleForm.seller,
        sale_type: saleForm.saleType,
        qty: take,
        total: totalPrice,
        cost: item.buy_price * take + rowSellerProfit,
        paid: isPaid,
        paid_amount: isPaid ? totalPrice : 0,
        payment_method: (saleForm.paid === "banka" || saleForm.paid === "nakit") ? saleForm.paid : null,
        seller_account_id: currentSellerAccount?.id || null,
        seller_profit: isSellerRole ? rowSellerProfit : null,
        note: (saleForm.saleType === "Hibe" || saleForm.saleType === "Fire/Bozuk") ? saleForm.note.trim() : null,
        variant: saleForm.variant,
        cancelled: false,
      });
      remainingQty -= take;
    }

    if (remainingQty > 0) return setMessage("Parti stokları yetersiz.");
    const { error } = await supabase.from("sales").insert(rows);
    if (error) return showError(error);

    // Peşin satışsa payments + allocation ekle
    if (saleForm.paid !== "false" && saleForm.saleType === "Normal satış") {
      const totalAmount = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
      if (totalAmount > 0) {
        const { data: payData, error: payErr } = await supabase
          .from("payments")
          .insert({ customer_id: customer.id, amount: totalAmount, user_email: currentUserEmail, cancelled: false, payment_method: saleForm.paid === "nakit" ? "nakit" : "banka", kasa_tutari: totalAmount, para_sahibi: saleForm.paraSahibi, seller_account_id: currentSellerAccount?.id || null })
          .select()
          .single();
        if (payErr) {
          console.error("Payment insert error:", payErr);
        } else if (payData) {
          // En son eklenen satışların ID'lerini bul
          const { data: newSales, error: salesErr } = await supabase
            .from("sales")
            .select("id,total")
            .eq("customer_id", customer.id)
            .eq("cancelled", false)
            .eq("paid", true)
            .order("created_at", { ascending: false })
            .limit(rows.length);
          if (salesErr) {
            console.error("New sales fetch error:", salesErr);
          } else if (newSales && newSales.length > 0) {
            const { data: existing } = await supabase.from("payment_allocations").select("sale_id").eq("payment_id", payData.id);
            const existingIds = new Set((existing || []).map((e: {sale_id: string}) => e.sale_id));
            const allocations = newSales
              .filter((s: {id: string; total: number}) => !existingIds.has(s.id))
              .map((s: {id: string; total: number}) => ({ payment_id: payData.id, sale_id: s.id, amount: s.total, created_at: payData.created_at }));
            if (allocations.length > 0) {
              const { error: allocErr } = await supabase.from("payment_allocations").insert(allocations);
              if (allocErr) console.error("Allocation insert error:", allocErr);
            }
          }
        }
      }
    }

    await logAction("Satış eklendi", "sales", `${customer.name} - ${saleForm.variant === "cep_boy" ? "Cep-" : ""}${product.name}`, { adet: qty, toplam: rows.reduce((sum, row) => sum + Number(row.total || 0), 0), satir_sayisi: rows.length });
    setSaleForm((prev) => ({ customerId: "", productId: "", batchId: "", qty: "1", seller: prev.seller, saleType: "Normal satış", paid: "false", customSalePrice: "", depo: prev.depo, sellerProfit: "", note: "", paraSahibi: "", variant: "ana" }));
    setMessage("Satış kaydedildi.");
    loadAll();
    } finally {
      setSaleLoading(false);
    }
  };

  const deleteSale = async (saleId: string) => {
    if (deletingId) return;
    setDeletingId(saleId);
    const sale = sales.find((s) => s.id === saleId);
    const { error } = await supabase.from("sales").update({ cancelled: true }).eq("id", saleId);
    if (error) return showError(error);
    if (sale) {
      // Peşin satışsa ilgili payment'ı sil
      if (sale.paid && sale.sale_type === "Normal satış") {
        const { data: allocData } = await supabase.from("payment_allocations").select("payment_id").eq("sale_id", saleId);
        if (allocData && allocData.length > 0) {
          const paymentIds = allocData.map((a: {payment_id: string}) => a.payment_id);
          await supabase.from("payment_allocations").delete().eq("sale_id", saleId);
          await supabase.from("payments").delete().in("id", paymentIds);
        }
      }
      try {
        await allocatePaymentsForCustomer(sale.customer_id);
      } catch (err) {
        return showError(err);
      }
    }
    await logAction("Satış iptal edildi", "sales", sale ? `${customerMap.get(sale.customer_id)?.name || sale.customer_id} - ${saleProductName(sale)}` : saleId, { tutar: sale?.total || 0 });
    setMessage("Satış iptal edildi. Kayıt silinmez, iptal olarak saklanır.");
    loadAll();
    setDeletingId(null);
  };

  const updateSale = async (saleId: string, patch: Partial<Sale>) => {
    const dbPatch: Record<string, unknown> = {};
    const oldSale = sales.find((s) => s.id === saleId);
    if (patch.seller !== undefined) dbPatch.seller = patch.seller;
    if (patch.sale_type !== undefined) dbPatch.sale_type = patch.sale_type;
    if (patch.paid !== undefined) {
      dbPatch.paid = patch.paid;
      // paid=false yapılınca paid_amount sıfırla, paid=true yapılınca total'e eşitle
      const sale = sales.find((s) => s.id === saleId);
      const total = patch.total !== undefined ? Number(patch.total) : (sale?.total ?? 0);
      dbPatch.paid_amount = patch.paid ? total : 0;
    }
    if (patch.qty !== undefined) dbPatch.qty = patch.qty;
    if (patch.total !== undefined) dbPatch.total = patch.total;
    if (patch.cost !== undefined) dbPatch.cost = patch.cost;
    if (patch.note !== undefined) dbPatch.note = patch.note;
    const { error } = await supabase.from("sales").update(dbPatch).eq("id", saleId);
    if (error) return showError(error);
    const updatedSale = sales.find((sale) => sale.id === saleId);
    if (updatedSale && patch.paid !== undefined) {
      try {
        await allocatePaymentsForCustomer(updatedSale.customer_id);
      } catch (err) {
        return showError(err);
      }
    }
    const saleEntityName = oldSale ? `${customerMap.get(oldSale.customer_id)?.name || oldSale.customer_id} - ${saleProductName(oldSale)}` : saleId;
    await logAction("Satış değiştirildi", "sales", saleEntityName, diffOf(oldSale as unknown as Record<string, unknown>, dbPatch));
    loadAll();
  };

  const startSaleEdit = (sale: Sale) => {
    setSaleDrafts((prev) => ({
      ...prev,
      [sale.id]: { qty: String(sale.qty), total: String(sale.total), cost: String(sale.cost), seller: sale.seller || "Aslı", sale_type: sale.sale_type, paid: sale.paid, note: sale.note || "" },
    }));
    setEditingSaleId(sale.id);
  };

  const getAvailableStockForSaleEdit = (sale: Sale) => {
    if (sale.batch_item_id) {
      const item = batchItems.find((i) => i.id === sale.batch_item_id);
      if (!item) return Infinity;
      const soldExcludingThis = getBatchSoldQtyForItem(item) - sale.qty;
      return item.bought - soldExcludingThis;
    }
    const items = batchItems.filter((i) => i.product_id === sale.product_id && i.batch_id === sale.batch_id);
    const totalBought = items.reduce((s, i) => s + i.bought, 0);
    const totalSoldAll = activeSales
      .filter((s) => s.product_id === sale.product_id && s.batch_id === sale.batch_id)
      .reduce((s, x) => s + x.qty, 0);
    const soldExcludingThis = totalSoldAll - sale.qty;
    return totalBought - soldExcludingThis;
  };

  const saveSaleEdit = async (saleId: string) => {
    const draft = saleDrafts[saleId];
    if (!draft) return;
    const sale = sales.find((s) => s.id === saleId);
    const newQty = Number(draft.qty || 0);
    if (sale && newQty > sale.qty) {
      const available = getAvailableStockForSaleEdit(sale);
      if (newQty > available) {
        setMessage(`Yetersiz stok: bu partide en fazla ${Math.max(available, 0)} adete kadar çıkarabilirsin.`);
        return;
      }
    }
    if ((draft.sale_type === "Hibe" || draft.sale_type === "Fire/Bozuk") && !draft.note.trim()) {
      setMessage("Hibe / Fire-Bozuk satışlarda açıklama girmek zorunlusun.");
      return;
    }
    await updateSale(saleId, {
      qty: newQty,
      total: Number(draft.total || 0),
      cost: Number(draft.cost || 0),
      seller: draft.seller,
      sale_type: draft.sale_type,
      paid: draft.paid,
      note: draft.note.trim() || null,
    });
    setEditingSaleId(null);
    const next = { ...saleDrafts };
    delete next[saleId];
    setSaleDrafts(next);
  };

  const cancelSaleEdit = (saleId: string) => {
    setEditingSaleId(null);
    const next = { ...saleDrafts };
    delete next[saleId];
    setSaleDrafts(next);
  };

  const getSalePaidAmount = (sale: Sale) => {
    if (sale.paid) return toNum(sale.total);
    return Math.min(toNum(sale.total), Math.max(toNum(sale.paid_amount), 0));
  };

  const getSaleStatus = (sale: Sale) => {
    if (sale.paid) return "Peşin";
    const paidAmount = getSalePaidAmount(sale);
    if (paidAmount >= toNum(sale.total)) return "Ödendi";
    if (paidAmount > 0) return `Kısmi (${money(paidAmount)})`;
    return "Cari borç";
  };

  const allocatePaymentsForCustomer = async (customerId: string) => {
    const [salesRes, paymentsRes] = await Promise.all([
      supabase
        .from("sales")
        .select("id,total,paid,paid_amount,cancelled,created_at")
        .eq("customer_id", customerId)
        .eq("cancelled", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("payments")
        .select("id,amount,cancelled,created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true }),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const activePays = (paymentsRes.data || []).filter((p) => p.cancelled !== true);
    const salesToAlloc = (salesRes.data || []);
    // Peşin satışlara ait payment'ları hariç tut — onlar zaten direkt allocation'a eklenmiş
    const pesinSaleTotals = salesToAlloc
      .filter((s) => s.paid)
      .map((s) => ({ amount: toNum(s.total), created_at: s.created_at?.slice(0,16) }));
    const cariPays = activePays.filter((p) => {
      const key = `${toNum(p.amount)}-${p.created_at?.slice(0,16)}`;
      return !pesinSaleTotals.some((ps) => `${ps.amount}-${ps.created_at}` === key);
    });
    const salesToAlloc2 = salesToAlloc.filter((s) => !s.paid);

    // Her satış için paid_amount hesapla
    let remainingManualPayments = cariPays.reduce((sum, p) => sum + toNum(p.amount), 0);
    const saleUpdates = salesToAlloc2.map((sale) => {
      const total = toNum(sale.total);
      const paidAmount = Math.max(0, Math.min(total, remainingManualPayments));
      remainingManualPayments -= paidAmount;
      return { id: sale.id, total, paidAmount, paid: false };
    });

    // payment_allocations: sadece cari ödeme allocation'larını sil
    if (cariPays.length > 0) {
      await supabase.from("payment_allocations").delete().in(
        "payment_id",
        cariPays.map((p) => p.id)
      );
    }

    // Her ödemeyi satışlara dağıt
    const allocations: { payment_id: string; sale_id: string; amount: number; created_at: string }[] = [];
    let saleQueue = [...saleUpdates];
    for (const pay of cariPays) {
      let payRemaining = toNum(pay.amount);
      for (const sale of saleQueue) {
        if (payRemaining <= 0) break;
        const alreadyAllocated = allocations
          .filter((a) => a.sale_id === sale.id)
          .reduce((s, a) => s + a.amount, 0);
        const remaining = sale.paidAmount - alreadyAllocated;
        const thisAlloc = Math.min(payRemaining, Math.max(remaining, 0));
        if (thisAlloc > 0) {
          allocations.push({ payment_id: pay.id, sale_id: sale.id, amount: thisAlloc, created_at: pay.created_at });
          payRemaining -= thisAlloc;
        }
      }
    }

    // Toplu insert
    if (allocations.length > 0) {
      await supabase.from("payment_allocations").insert(allocations);
    }

    // sales tablosunu güncelle
    const results = await Promise.all(
      saleUpdates.map((s) => supabase.from("sales").update({ paid_amount: s.paidAmount }).eq("id", s.id))
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) throw firstError;
  };

  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const isLoading = (key: string) => loadingAction === key;
  const withLoading = async (key: string, fn: () => Promise<void>) => {
    if (loadingAction) return;
    setLoadingAction(key);
    try {
      await fn();
    } catch (err) {
      showError(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const addCustomerPayment = async (customerId: string) => {
    if (paymentLoading) return;
    setPaymentLoading(customerId);
    try {
    const amount = Number(paymentInputs[customerId] || 0);
    if (!amount || amount <= 0) return;
    const method = paymentMethodInputs[customerId] === "nakit" ? "nakit" : "banka";
    const paraSahibi = paymentParaSahibiInputs[customerId] || "";
    if (!paraSahibi) { setMessage("Para kimde? alanını seçmelisin."); return; }

    // Mükerrer kayıt kontrolü: son 3 dakika içinde bu müşteriye aynı tutarda başka bir ödeme girilmiş mi?
    const now = Date.now();
    const yakinZamandaAyniOdeme = payments.some((p) =>
      p.customer_id === customerId &&
      !p.cancelled &&
      Number(p.amount) === amount &&
      (now - new Date(p.created_at).getTime()) < 3 * 60 * 1000
    );
    if (yakinZamandaAyniOdeme) {
      const devamEt = window.confirm(`Bu müşteriye az önce (son 3 dakika içinde) aynı tutarda (${money(amount)}) bir ödeme zaten eklenmiş görünüyor. Yine de eklemek istediğine emin misin?`);
      if (!devamEt) return;
    }

    // Toplam satışı aşıyor mu kontrol et
    const totalSales = getCustomerSalesTotal(customerId);
    const totalPaid = getCustomerCollectedTotal(customerId);
    if (totalPaid + amount > totalSales) {
      const fazla = (totalPaid + amount - totalSales).toLocaleString("tr-TR");
      const confirmed = window.confirm(`Uyarı: Bu ödeme müşterinin toplam satışını ${fazla} TL aşıyor. Yine de eklemek istiyor musunuz?`);
      if (!confirmed) return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email || null;
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount, user_email: userEmail, payment_method: method, kasa_tutari: amount, para_sahibi: paraSahibi, seller_account_id: currentSellerAccount?.id || null });
    if (error) return showError(error);
    try {
      await allocatePaymentsForCustomer(customerId);
    } catch (err) {
      return showError(err);
    }
    await logAction("Ödeme eklendi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: amount, yontem: method === "nakit" ? "Nakit" : "Banka", kimde: paraSahibi });
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
    setPaymentParaSahibiInputs({ ...paymentParaSahibiInputs, [customerId]: "" });
    loadAll();
    } finally {
      setPaymentLoading(null);
    }
  };

  const savePaymentRow = async (paymentId: string) => {
    const oldPayment = payments.find((p) => p.id === paymentId);
    const note = paymentRowDraft.note.trim();
    const aciklama = paymentRowDraft.aciklama.trim();
    const kasaRaw = paymentRowDraft.kasa;
    const kasaValue = kasaRaw === "" ? null : Number(kasaRaw);
    if (kasaValue !== null && !Number.isFinite(kasaValue)) return setMessage("Geçerli bir kasa tutarı girin.");
    const paraSahibi = paymentRowDraft.paraSahibi || null;

    const { error } = await supabase.from("payments").update({
      note: note || null,
      aciklama: aciklama || null,
      kasa_tutari: kasaValue,
      para_sahibi: paraSahibi,
    }).eq("id", paymentId);
    if (error) return showError(error);

    setPayments((prev) => prev.map((p) => p.id === paymentId ? { ...p, note: note || null, aciklama: aciklama || null, kasa_tutari: kasaValue, para_sahibi: paraSahibi } : p));
    await logAction(
      "Tahsilat düzenlendi",
      "payments",
      oldPayment ? (customerMap.get(oldPayment.customer_id)?.name || paymentId) : paymentId,
      diffOf(
        { not: oldPayment?.note || "", kasa_tutari: oldPayment?.kasa_tutari ?? null, kimde: oldPayment?.para_sahibi || "", aciklama: oldPayment?.aciklama || "" },
        { not: note, kasa_tutari: kasaValue, kimde: paraSahibi || "", aciklama }
      )
    );
    setEditingPaymentRowId(null);
    setPaymentRowDraft({ note: "", kasa: "", paraSahibi: "", aciklama: "" });
  };

  const paraSahibiSecenekleri = useMemo(
    () => ["Veli", "Aslı", "Mihrimah", ...sellerAccounts.map((s) => s.name)],
    [sellerAccounts]
  );

  // Şahsi cüzdanlar: sadece 3 ortak için (Parti Maliyet Kaydı'nda karşılığı olan tek kişiler).
  // Kasa havuzlarından ayrı, bakiye sınırı yok - kişinin kendi cebinden çıkan, sınırsız bir kaynak.
  const SAHSI_CUZDAN_SAHIPLERI: { key: string; kisi: string; alan: "veli" | "asli" | "mihrimah" }[] = [
    { key: "__sahsi__Veli", kisi: "Veli", alan: "veli" },
    { key: "__sahsi__Aslı", kisi: "Aslı", alan: "asli" },
    { key: "__sahsi__Mihrimah", kisi: "Mihrimah", alan: "mihrimah" },
  ];
  const sahsiCuzdanByKey = new Map(SAHSI_CUZDAN_SAHIPLERI.map((s) => [s.key, s]));
  const isSahsiKaynak = (k: string) => sahsiCuzdanByKey.has(k);

  // Bir ödeme tipi + kişi alanına göre, batch_costs'ta yazılacak GERÇEK kolon adını döner.
  // Toptancı için düz "veli"/"asli"/"mihrimah" (Toptancı toplamına dahil olsun diye),
  // Kargo/Diğer için ayrı "kargo_veli"/"diger_asli" gibi kolonlar (Toptancı toplamıyla KARIŞMASIN diye).
  const getSahsiKolonAdi = (tip: "toptanci" | "kargo" | "diger", alan: "veli" | "asli" | "mihrimah"): keyof BatchCost => {
    if (tip === "toptanci") return alan;
    return `${tip}_${alan}` as keyof BatchCost;
  };

  const kasaHavuzlari = useMemo(() => {
    const map = new Map<string, { toplam: number; kayitlar: { id: string; tarih: string; createdAt: string; cari: string; kasa: number }[] }>();
    for (const p of payments) {
      if (p.cancelled) continue;
      if (!p.para_sahibi) continue;
      const kasa = Number(p.kasa_tutari || 0);
      if (kasa <= 0) continue;
      const entry = map.get(p.para_sahibi) || { toplam: 0, kayitlar: [] };
      entry.toplam += kasa;
      entry.kayitlar.push({ id: p.id, tarih: toTR(p.created_at, true), createdAt: p.created_at, cari: customerMap.get(p.customer_id)?.name || "-", kasa });
      map.set(p.para_sahibi, entry);
    }
    for (const entry of map.values()) {
      entry.kayitlar.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return map;
  }, [payments, customerMap]);

  // Her toptancının (supplier) tüm partilerindeki Toptancı tutarları toplamı
  const toptanciBorclari = useMemo(() => {
    const map = new Map<string, number>();
    for (const batch of batches) {
      if (!batch.supplier_id) continue;
      const cost = batchCosts.find((c) => c.batch_id === batch.id);
      if (!cost) continue;
      // Kargo ve Diğer artık ayrı, gerçek masraflar (Kasa'ya gömülmüyor) - Toptancı bunları içermez
      const toptanci = Number(cost.veli || 0) + Number(cost.asli || 0) + Number(cost.mihrimah || 0) + Number(cost.kasa || 0);
      map.set(batch.supplier_id, (map.get(batch.supplier_id) || 0) + toptanci);
    }
    return map;
  }, [batches, batchCosts]);

  // O toptancıya bugüne kadar Ödemeler ekranından yapılmış ödemeler toplamı
  const toptanciOdenenler = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of odemeler) {
      if (o.tip !== "toptanci" || !o.supplier_id) continue;
      map.set(o.supplier_id, (map.get(o.supplier_id) || 0) + Number(o.tutar || 0));
    }
    return map;
  }, [odemeler]);

  const getToptanciKalanBorc = (supplierId: string) =>
    (toptanciBorclari.get(supplierId) || 0) - (toptanciOdenenler.get(supplierId) || 0);

  const openPeriodForOdeme = useMemo(() => periods.find((p) => !p.closed), [periods]);

  // Üç ekranda da (Dönem Kapanışı "Kasadaki para", Dönem Tahsilatları "Kasa", Ödemeler "Kasa Havuzları - Toplam")
  // aynı rakamı göstermek için tek kaynak: kişi bazlı kasa havuzlarının (Veli/Aslı/Mihrimah/satıcılar) O ANKİ
  // CANLI toplamı. Devreden para artık ayrı/soyut bir rakam değil, fiilen bir kişinin havuzunun içinde
  // durduğu için ayrıca eklenmiyor (eklenirse çift sayım olur). Ödemeler yapıldıkça bu toplam otomatik düşer.
  const toplamKasaHavuzu = useMemo(
    () => paraSahibiSecenekleri.reduce((s, kisi) => s + (kasaHavuzlari.get(kisi)?.toplam || 0), 0),
    [paraSahibiSecenekleri, kasaHavuzlari]
  );

  // "Kimden" seçeneği için kullanılabilir bakiye (para_sahibi adı ya da "__devir__" sentinel'i)
  const getKaynakBakiye = (kaynak: string) => {
    if (kaynak === "__devir__") return openPeriodForOdeme?.devir_bakiyesi || 0;
    if (isSahsiKaynak(kaynak)) return Infinity;
    return kasaHavuzlari.get(kaynak)?.toplam || 0;
  };

  const odemeKimdenToplamKullanilabilir = odemeKimden.reduce((s, k) => s + getKaynakBakiye(k), 0);
  const odemeHedefTutar = Number(odemeTutar) || 0;
  const odemeEksik = Math.max(odemeHedefTutar - odemeKimdenToplamKullanilabilir, 0);

  // Şahsi cüzdandan yapılmış, henüz kasadan (kısmen dahi) karşılanmamış bakiyesi kalan ödemeler.
  const sahsiOdenmemisKalanlar = useMemo(() => {
    return odemeKaynaklari
      .filter((k) => k.kaynak_tipi === "sahsi" && Number(k.kullanilan_tutar || 0) > 0.5)
      .map((k) => {
        const odeme = odemeler.find((o) => o.id === k.odeme_id);
        return { kaynak: k, odeme };
      })
      .filter((row) => !!row.odeme)
      .sort((a, b) => new Date(b.odeme!.created_at).getTime() - new Date(a.odeme!.created_at).getTime());
  }, [odemeKaynaklari, odemeler]);

  const sahsiKarsilamaKimdenToplamKullanilabilir = sahsiKarsilamaKimden.reduce((s, k) => s + getKaynakBakiye(k), 0);
  const sahsiKarsilamaHedefTutar = Number(sahsiKarsilamaTutar) || 0;
  const sahsiKarsilamaEksik = Math.max(sahsiKarsilamaHedefTutar - sahsiKarsilamaKimdenToplamKullanilabilir, 0);

  const submitSahsiKarsilama = async () => {
    if (!sahsiKarsilamaSecili) return setMessage("Karşılanacak şahsi ödemeyi seç.");
    const row = sahsiOdenmemisKalanlar.find((r) => r.kaynak.id === sahsiKarsilamaSecili);
    if (!row || !row.odeme) return setMessage("Kayıt bulunamadı, sayfayı yenile.");
    const tutar = Number(sahsiKarsilamaTutar);
    if (!tutar || tutar <= 0) return setMessage("Geçerli bir tutar girin.");
    if (tutar > Number(row.kaynak.kullanilan_tutar) + 0.5) return setMessage(`En fazla ${money(row.kaynak.kullanilan_tutar)} karşılanabilir.`);
    if (sahsiKarsilamaKimden.length === 0) return setMessage("En az bir kasa kaynağı seçmelisin.");
    if (sahsiKarsilamaEksik > 0.5) return setMessage(`Seçilen kaynaklar yetmiyor, ${money(sahsiKarsilamaEksik)} eksik.`);

    const odeme = row.odeme;
    const sahibi = row.kaynak.para_sahibi as "Veli" | "Aslı" | "Mihrimah";
    const sahsiAlan: "veli" | "asli" | "mihrimah" | null = sahibi === "Veli" ? "veli" : sahibi === "Aslı" ? "asli" : sahibi === "Mihrimah" ? "mihrimah" : null;
    if (!sahsiAlan) return setMessage("Bu kaynağın sahibi tanınamadı.");

    const yeniKaynakIdleri: string[] = [];
    try {
      let kalan = tutar;

      try {
        for (const kaynak of sahsiKarsilamaKimden) {
          if (kalan <= 0.01) break;
          if (kaynak === "__devir__") {
            const mevcut = openPeriodForOdeme?.devir_bakiyesi || 0;
            const kullanilan = Math.min(mevcut, kalan);
            if (kullanilan <= 0) continue;
            const eskiNot = openPeriodForOdeme?.devir_bakiyesi_notu || "";
            const yeniNot = `${eskiNot ? eskiNot + ", " : ""}${odeme.sira_no}/${Math.round(kullanilan)} TL (şahsi karşılama)`;
            const { error } = await supabase.from("periods").update({ devir_bakiyesi: mevcut - kullanilan, devir_bakiyesi_notu: yeniNot }).eq("id", openPeriodForOdeme!.id);
            if (error) throw error;
            const { data: kInserted, error: kaynakErr } = await supabase.from("odeme_kaynaklari").insert({
              odeme_id: odeme.id, kaynak_tipi: "devir", para_sahibi: null, payment_id: null, period_id: openPeriodForOdeme!.id, kullanilan_tutar: kullanilan,
            }).select();
            if (kaynakErr) throw kaynakErr;
            yeniKaynakIdleri.push(kInserted![0].id as string);
            kalan -= kullanilan;
          } else {
            const havuz = kasaHavuzlari.get(kaynak);
            if (!havuz) continue;
            for (const kayit of havuz.kayitlar) {
              if (kalan <= 0.01) break;
              const kullanilan = Math.min(kayit.kasa, kalan);
              if (kullanilan <= 0) continue;
              const yeniKasa = kayit.kasa - kullanilan;
              const eskiAciklama = payments.find((p) => p.id === kayit.id)?.aciklama || "";
              const yeniAciklama = `${eskiAciklama ? eskiAciklama + ", " : ""}${odeme.sira_no}/${Math.round(kullanilan)} TL (şahsi karşılama)`;
              const { error } = await supabase.from("payments").update({ kasa_tutari: yeniKasa, aciklama: yeniAciklama }).eq("id", kayit.id);
              if (error) throw error;
              const { data: kInserted, error: kaynakErr } = await supabase.from("odeme_kaynaklari").insert({
                odeme_id: odeme.id, kaynak_tipi: "tahsilat", para_sahibi: kaynak, payment_id: kayit.id, period_id: null, kullanilan_tutar: kullanilan,
              }).select();
              if (kaynakErr) throw kaynakErr;
              yeniKaynakIdleri.push(kInserted![0].id as string);
              kalan -= kullanilan;
            }
          }
        }

        // Şahsi kaynak satırının kalan tutarını azalt (karşılanan kadar)
        const yeniSahsiKullanilan = Math.max(0, Number(row.kaynak.kullanilan_tutar) - tutar);
        const { error: sahsiErr } = await supabase.from("odeme_kaynaklari").update({ kullanilan_tutar: yeniSahsiKullanilan }).eq("id", row.kaynak.id);
        if (sahsiErr) throw sahsiErr;

        // Parti Maliyet Kaydı: doğru şahsi kolonundan düş, kasa/kargo/diger koluna ekle - TEK update.
        if (odeme.batch_id) {
          const tip = odeme.tip as "toptanci" | "kargo" | "diger"; // kar_payi'de batch_id hiç olmaz
          const kasaAlani: "kasa" | "kargo" | "diger" = tip === "toptanci" ? "kasa" : tip === "kargo" ? "kargo" : "diger";
          const sahsiKolon = getSahsiKolonAdi(tip, sahsiAlan);
          const existing = batchCosts.find((c) => c.batch_id === odeme.batch_id);
          if (existing) {
            const patch: Record<string, number> = {
              [sahsiKolon]: Math.max(0, Number(existing[sahsiKolon] || 0) - tutar),
              [kasaAlani]: Number(existing[kasaAlani] || 0) + tutar,
            };
            const { error } = await supabase.from("batch_costs").update(patch).eq("id", existing.id);
            if (error) throw error;
          }
        }
      } catch (innerErr) {
        // Yarıda kesildi: buraya kadar eklenen YENİ kaynak satırlarını geri al (kasa/devir'e iade et),
        // şahsi kaynak satırının kullanilan_tutar'ı henüz DEĞİŞTİRİLMEDİYSE dokunma; değiştirildiyse
        // (yani sadece batch_costts adımı patladıysa) onu da eski haline döndür.
        try {
          const { data: eklenenler } = await supabase.from("odeme_kaynaklari").select("*").in("id", yeniKaynakIdleri.length ? yeniKaynakIdleri : ["__none__"]);
          for (const k of eklenenler || []) {
            const fragment = `${odeme.sira_no}/${Math.round(Number(k.kullanilan_tutar || 0))} TL (şahsi karşılama)`;
            if (k.kaynak_tipi === "tahsilat" && k.payment_id) {
              const { data: payRow } = await supabase.from("payments").select("kasa_tutari,aciklama").eq("id", k.payment_id).single();
              const yeniKasa = Number(payRow?.kasa_tutari || 0) + Number(k.kullanilan_tutar || 0);
              const yeniAciklama = removeNoteFragment(payRow?.aciklama || "", fragment);
              await supabase.from("payments").update({ kasa_tutari: yeniKasa, aciklama: yeniAciklama || null }).eq("id", k.payment_id);
            } else if (k.kaynak_tipi === "devir" && k.period_id) {
              const { data: periodRow } = await supabase.from("periods").select("devir_bakiyesi,devir_bakiyesi_notu").eq("id", k.period_id).single();
              const yeniDevir = Number(periodRow?.devir_bakiyesi || 0) + Number(k.kullanilan_tutar || 0);
              const yeniNot = removeNoteFragment(periodRow?.devir_bakiyesi_notu || "", fragment);
              await supabase.from("periods").update({ devir_bakiyesi: yeniDevir, devir_bakiyesi_notu: yeniNot || null }).eq("id", k.period_id);
            }
            await supabase.from("odeme_kaynaklari").delete().eq("id", k.id);
          }
          // Şahsi kaynak satırını da garanti altına al: kullanilan_tutar orijinaline eşit mi kontrol et, değilse düzelt.
          const { data: sahsiRow } = await supabase.from("odeme_kaynaklari").select("kullanilan_tutar").eq("id", row.kaynak.id).single();
          if (sahsiRow && Number(sahsiRow.kullanilan_tutar) !== Number(row.kaynak.kullanilan_tutar)) {
            await supabase.from("odeme_kaynaklari").update({ kullanilan_tutar: row.kaynak.kullanilan_tutar }).eq("id", row.kaynak.id);
          }
        } catch (rollbackErr) {
          console.error("Şahsi karşılama geri alma da başarısız oldu", rollbackErr);
          window.alert("Şahsi karşılama işlemi başarısız oldu VE otomatik geri alma da başarısız oldu. Lütfen kayıtları manuel kontrol edin.");
        }
        window.alert("Şahsi karşılama işlemi tamamlanamadı, yapılan düşümler otomatik olarak geri alındı. Lütfen tekrar deneyin.");
        throw innerErr;
      }

      const kaynakOzet = sahsiKarsilamaKimden.map((k) => k === "__devir__" ? "Devir Bakiyesi" : k).join(" + ");
      await logAction(
        "Şahsi ödeme kasadan karşılandı",
        "odemeler",
        `${sahibi} (Şahsi) — ${batchMap.get(odeme.batch_id || "")?.name || odeme.recipient_name || ""}`,
        { tutar, kaynak: kaynakOzet, odeme_sira_no: odeme.sira_no }
      );

      setMessage("Şahsi ödeme, seçilen kasa kaynağından karşılandı.");
      setSahsiKarsilamaSecili(null);
      setSahsiKarsilamaTutar("");
      setSahsiKarsilamaKimden([]);
      loadAll();
    } catch (err) {
      showError(err);
      loadAll();
    }
  };

  // Bir açıklama/not metninden, ödeme eklerken otomatik eklenen "12/124 TL" gibi tek bir
  // fragmanı temizler; virgülle ayrılmış diğer notlara dokunmaz.
  const removeNoteFragment = (fullText: string, fragment: string) => {
    return fullText
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== fragment.trim())
      .join(", ");
  };

  const deleteOdeme = async (odemeId: string) => {
    const odeme = odemeler.find((o) => o.id === odemeId);
    if (!odeme) return;
    const entityName = odeme.tip === "toptanci"
      ? `${supplierMap.get(odeme.supplier_id || "")?.name || ""} — ${batchMap.get(odeme.batch_id || "")?.name || ""}`
      : odeme.tip === "kar_payi"
      ? (odeme.recipient_name || "-")
      : (batchMap.get(odeme.batch_id || "")?.name || "");
    if (!confirm(`${entityName} için ${money(odeme.tutar)} tutarındaki bu ödeme kaydı silinsin mi? Kullanılan kaynaklardaki (tahsilat kasası / devir bakiyesi / şahsi cüzdan) tutarlar otomatik olarak geri iade edilecek, oradaki "${odeme.sira_no}/..." notu da temizlenecek, Parti Maliyet Kaydı'ndaki ilgili alan(lar) da bu kadar azaltılacak.`)) return;

    try {
      const kaynaklar = odemeKaynaklari.filter((k) => k.odeme_id === odemeId);
      const sahsiIadeToplam: Record<"veli" | "asli" | "mihrimah", number> = { veli: 0, asli: 0, mihrimah: 0 };
      for (const k of kaynaklar) {
        const fragment = `${odeme.sira_no}/${Math.round(Number(k.kullanilan_tutar || 0))} TL`;
        if (k.kaynak_tipi === "tahsilat" && k.payment_id) {
          const payment = payments.find((p) => p.id === k.payment_id);
          const yeniKasa = Number(payment?.kasa_tutari || 0) + Number(k.kullanilan_tutar || 0);
          const yeniAciklama = removeNoteFragment(payment?.aciklama || "", fragment);
          const { error } = await supabase.from("payments").update({ kasa_tutari: yeniKasa, aciklama: yeniAciklama || null }).eq("id", k.payment_id);
          if (error) throw error;
        } else if (k.kaynak_tipi === "devir" && k.period_id) {
          const period = periods.find((p) => p.id === k.period_id);
          const yeniDevir = Number(period?.devir_bakiyesi || 0) + Number(k.kullanilan_tutar || 0);
          const yeniNot = removeNoteFragment(period?.devir_bakiyesi_notu || "", fragment);
          const { error } = await supabase.from("periods").update({ devir_bakiyesi: yeniDevir, devir_bakiyesi_notu: yeniNot || null }).eq("id", k.period_id);
          if (error) throw error;
        } else if (k.kaynak_tipi === "sahsi" && k.para_sahibi) {
          const alan = k.para_sahibi === "Veli" ? "veli" : k.para_sahibi === "Aslı" ? "asli" : k.para_sahibi === "Mihrimah" ? "mihrimah" : null;
          if (alan) sahsiIadeToplam[alan] += Number(k.kullanilan_tutar || 0);
        }
      }

      // Parti Maliyet Kaydı'ndaki ilgili alanları (kasa/kargo/diger VE varsa şahsi kolonları)
      // bu ödemenin GERÇEK kaynak dağılımına göre (tümü değil, sadece kasa'dan gelen kısım kadar
      // kasa/kargo/diger'den, şahsi'den gelen kısım kadar ilgili kişinin şahsi kolonundan) geri azalt.
      if (odeme.batch_id) {
        const tip = odeme.tip as "toptanci" | "kargo" | "diger"; // kar_payi'de batch_id hiç olmaz
        const kasaAlani: "kasa" | "kargo" | "diger" = tip === "toptanci" ? "kasa" : tip === "kargo" ? "kargo" : "diger";
        const sahsiToplam = sahsiIadeToplam.veli + sahsiIadeToplam.asli + sahsiIadeToplam.mihrimah;
        const kasaKismi = Number(odeme.tutar || 0) - sahsiToplam;
        const existing = batchCosts.find((c) => c.batch_id === odeme.batch_id);
        if (existing) {
          const patch: Record<string, number> = {};
          if (kasaKismi > 0.01) patch[kasaAlani] = Math.max(0, Number(existing[kasaAlani] || 0) - kasaKismi);
          (["veli", "asli", "mihrimah"] as const).forEach((alan) => {
            if (sahsiIadeToplam[alan] > 0.01) {
              const kolon = getSahsiKolonAdi(tip, alan);
              patch[kolon] = Math.max(0, Number(existing[kolon] || 0) - sahsiIadeToplam[alan]);
            }
          });
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase.from("batch_costs").update(patch).eq("id", existing.id);
            if (error) throw error;
          }
        }
      }

      // odeme_kaynaklari satırları "on delete cascade" ile otomatik silinir
      const { error } = await supabase.from("odemeler").delete().eq("id", odemeId);
      if (error) throw error;

      await logAction("Ödeme kaydı silindi", "odemeler", entityName, { tutar: odeme.tutar });
      setMessage("Ödeme kaydı silindi, kullanılan kaynaklar iade edildi.");
      loadAll();
    } catch (err) {
      showError(err);
    }
  };

  const submitOdeme = async () => {
    const tutar = Number(odemeTutar);
    if (!tutar || tutar <= 0) return setMessage("Geçerli bir tutar girin.");
    if (odemeTip === "toptanci" && !odemeSupplierId) return setMessage("Toptancı seçmelisin.");
    if ((odemeTip === "kargo" || odemeTip === "diger" || odemeTip === "toptanci") && !odemeBatchId) return setMessage("Hangi parti için olduğunu seçmelisin.");
    if (odemeTip === "kar_payi" && !odemeKarPayiAlici) return setMessage("Kâr payının kime ödendiğini seçmelisin.");
    if (odemeKimden.length === 0) return setMessage("En az bir kaynak seçmelisin.");
    if (odemeEksik > 0.5) return setMessage(`Seçilen kaynaklar yetmiyor, ${money(odemeEksik)} eksik.`);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData.user?.email || "";
      const batchName = batchMap.get(odemeBatchId)?.name || "";

      const { data: odemeInserted, error: odemeErr } = await supabase.from("odemeler").insert({
        tip: odemeTip,
        supplier_id: odemeTip === "toptanci" ? odemeSupplierId : null,
        batch_id: odemeTip === "kar_payi" ? null : odemeBatchId,
        recipient_name: odemeTip === "kar_payi" ? odemeKarPayiAlici : null,
        tutar,
        aciklama: odemeTip === "toptanci" ? `${supplierMap.get(odemeSupplierId)?.name || ""} — ${batchName}` : odemeTip === "kar_payi" ? odemeKarPayiAlici : batchName,
        created_by: createdBy,
      }).select();
      if (odemeErr) throw odemeErr;
      const odemeId = odemeInserted![0].id as string;
      const odemeSiraNo = odemeInserted![0].sira_no as number;

      try {
        let kalan = tutar;
        const sahsiKullanilan: Record<"veli" | "asli" | "mihrimah", number> = { veli: 0, asli: 0, mihrimah: 0 };

        for (const kaynak of odemeKimden) {
          if (kalan <= 0.01) break;
          if (kaynak === "__devir__") {
            const mevcut = openPeriodForOdeme?.devir_bakiyesi || 0;
            const kullanilan = Math.min(mevcut, kalan);
            if (kullanilan <= 0) continue;
            const eskiNot = openPeriodForOdeme?.devir_bakiyesi_notu || "";
            const yeniNot = `${eskiNot ? eskiNot + ", " : ""}${odemeSiraNo}/${Math.round(kullanilan)} TL`;
            const { error } = await supabase.from("periods").update({ devir_bakiyesi: mevcut - kullanilan, devir_bakiyesi_notu: yeniNot }).eq("id", openPeriodForOdeme!.id);
            if (error) throw error;
            // Kaynak kaydı ANINDA yazılır - döngü daha sonra bir yerde hata verip yarıda kesilse bile
            // buraya kadar yapılan düşümler izlenebilir ve silme/iade işlemi doğru çalışabilir.
            const { error: kaynakErr } = await supabase.from("odeme_kaynaklari").insert({
              odeme_id: odemeId, kaynak_tipi: "devir", para_sahibi: null, payment_id: null, period_id: openPeriodForOdeme!.id, kullanilan_tutar: kullanilan,
            });
            if (kaynakErr) throw kaynakErr;
            kalan -= kullanilan;
          } else if (isSahsiKaynak(kaynak)) {
            // Şahsi cüzdan: kasa havuzuna dokunmaz, bakiye sınırı yok - kalan ne varsa tamamını karşılar.
            const sahibi = sahsiCuzdanByKey.get(kaynak)!;
            const kullanilan = kalan;
            if (kullanilan <= 0) continue;
            const { error: kaynakErr } = await supabase.from("odeme_kaynaklari").insert({
              odeme_id: odemeId, kaynak_tipi: "sahsi", para_sahibi: sahibi.kisi, payment_id: null, period_id: null, kullanilan_tutar: kullanilan,
            });
            if (kaynakErr) throw kaynakErr;
            sahsiKullanilan[sahibi.alan] += kullanilan;
            kalan -= kullanilan;
          } else {
            const havuz = kasaHavuzlari.get(kaynak);
            if (!havuz) continue;
            for (const kayit of havuz.kayitlar) {
              if (kalan <= 0.01) break;
              const kullanilan = Math.min(kayit.kasa, kalan);
              if (kullanilan <= 0) continue;
              const yeniKasa = kayit.kasa - kullanilan;
              const eskiAciklama = payments.find((p) => p.id === kayit.id)?.aciklama || "";
              const yeniAciklama = `${eskiAciklama ? eskiAciklama + ", " : ""}${odemeSiraNo}/${Math.round(kullanilan)} TL`;
              const { error } = await supabase.from("payments").update({ kasa_tutari: yeniKasa, aciklama: yeniAciklama }).eq("id", kayit.id);
              if (error) throw error;
              // Kaynak kaydı ANINDA yazılır - bkz. yukarıdaki not.
              const { error: kaynakErr } = await supabase.from("odeme_kaynaklari").insert({
                odeme_id: odemeId, kaynak_tipi: "tahsilat", para_sahibi: kaynak, payment_id: kayit.id, period_id: null, kullanilan_tutar: kullanilan,
              });
              if (kaynakErr) throw kaynakErr;
              kalan -= kullanilan;
            }
          }
        }

        // Toptancı/Kargo/Diğer ödemesi, seçilen partinin Parti Maliyet Kaydı'ndaki ilgili alanına
        // BİRİKTİRİLEREK (üzerine eklenerek) yazılır - artık bu alanlar elle girilmiyor, sadece
        // Ödemeler ekranından besleniyor, o yüzden aynı partiye birden fazla ödeme yapılabilir.
        // Kasa havuzundan/devirden karşılanan kısım kasa/kargo/diger koluna gider. Şahsi cüzdandan
        // karşılanan kısım ise TİPE GÖRE DOĞRU kolona gider: Toptancı için düz veli/asli/mihrimah
        // (Toptancı toplamına dahil olsun diye), Kargo/Diğer için ayrı kargo_veli/diger_asli gibi
        // kolonlara (Toptancı toplamıyla karışmasın diye) - TEK bir update çağrısında.
        // Kâr Payı ödemesi hiçbir partiye bağlı değil, bu adım sadece diğer 3 tip için geçerli.
        if (odemeTip !== "kar_payi") {
          const kasaAlani: "kasa" | "kargo" | "diger" = odemeTip === "toptanci" ? "kasa" : odemeTip === "kargo" ? "kargo" : "diger";
          const kasaKullanilan = tutar - sahsiKullanilan.veli - sahsiKullanilan.asli - sahsiKullanilan.mihrimah;
          const existing = batchCosts.find((c) => c.batch_id === odemeBatchId);
          const patch: Record<string, number> = {};
          if (kasaKullanilan > 0.01) patch[kasaAlani] = (existing ? Number(existing[kasaAlani] || 0) : 0) + kasaKullanilan;
          (["veli", "asli", "mihrimah"] as const).forEach((alan) => {
            if (sahsiKullanilan[alan] > 0.01) {
              const kolon = getSahsiKolonAdi(odemeTip, alan);
              patch[kolon] = (existing ? Number(existing[kolon] || 0) : 0) + sahsiKullanilan[alan];
            }
          });
          if (existing) {
            const { error } = await supabase.from("batch_costs").update(patch).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("batch_costs").insert({ batch_id: odemeBatchId, veli: 0, asli: 0, mihrimah: 0, kasa: 0, kargo: 0, diger: 0, ...patch });
            if (error) throw error;
          }
        }
      } catch (innerErr) {
        // Kaynak düşme / maliyet yazma adımlarından biri başarısız oldu.
        // Buraya kadar yapılmış olan TÜM düşümleri (odeme_kaynaklari'na anında yazıldığı için)
        // geri alıp, yarım kalmış ödeme kaydını sil - dangling/izsiz bir düşüş kalmasın.
        try {
          const { data: kalanKaynaklar } = await supabase.from("odeme_kaynaklari").select("*").eq("odeme_id", odemeId);
          for (const k of kalanKaynaklar || []) {
            const fragment = `${odemeSiraNo}/${Math.round(Number(k.kullanilan_tutar || 0))} TL`;
            if (k.kaynak_tipi === "tahsilat" && k.payment_id) {
              const { data: payRow } = await supabase.from("payments").select("kasa_tutari,aciklama").eq("id", k.payment_id).single();
              const yeniKasa = Number(payRow?.kasa_tutari || 0) + Number(k.kullanilan_tutar || 0);
              const yeniAciklama = removeNoteFragment(payRow?.aciklama || "", fragment);
              await supabase.from("payments").update({ kasa_tutari: yeniKasa, aciklama: yeniAciklama || null }).eq("id", k.payment_id);
            } else if (k.kaynak_tipi === "devir" && k.period_id) {
              const { data: periodRow } = await supabase.from("periods").select("devir_bakiyesi,devir_bakiyesi_notu").eq("id", k.period_id).single();
              const yeniDevir = Number(periodRow?.devir_bakiyesi || 0) + Number(k.kullanilan_tutar || 0);
              const yeniNot = removeNoteFragment(periodRow?.devir_bakiyesi_notu || "", fragment);
              await supabase.from("periods").update({ devir_bakiyesi: yeniDevir, devir_bakiyesi_notu: yeniNot || null }).eq("id", k.period_id);
            }
          }
          await supabase.from("odemeler").delete().eq("id", odemeId);
        } catch (rollbackErr) {
          console.error("Otomatik geri alma da başarısız oldu", rollbackErr);
          window.alert("Ödeme işlemi başarısız oldu VE otomatik geri alma da başarısız oldu. Lütfen 'Kasa Havuzları' ve ilgili ödeme kayıtlarını manuel kontrol edin, gerekirse yönetici ile iletişime geçin.");
        }
        window.alert("Ödeme işlemi tamamlanamadı, yapılan düşümler otomatik olarak geri alındı. Lütfen tekrar deneyin.");
        throw innerErr;
      }

      const kaynakOzet = odemeKimden.map((k) => k === "__devir__" ? "Devir Bakiyesi" : isSahsiKaynak(k) ? `${sahsiCuzdanByKey.get(k)!.kisi} (Şahsi)` : k).join(" + ");
      const islemAdi = odemeTip === "toptanci" ? "Toptancıya ödeme yapıldı" : odemeTip === "kargo" ? "Kargo ödemesi yapıldı" : odemeTip === "kar_payi" ? "Kâr payı ödendi" : "Diğer masraf ödendi";
      await logAction(
        islemAdi,
        "odemeler",
        odemeTip === "toptanci" ? `${supplierMap.get(odemeSupplierId)?.name || ""} — ${batchName}` : odemeTip === "kar_payi" ? odemeKarPayiAlici : batchName,
        { tutar, kaynak: kaynakOzet }
      );

      setMessage("Ödeme kaydedildi.");
      setOdemeTutar("");
      setOdemeKimden([]);
      setOdemeSupplierId("");
      setOdemeBatchId("");
      setOdemeKarPayiAlici("");
      loadAll();
    } catch (err) {
      showError(err);
      loadAll();
    }
  };

  const saveOpeningBalance = async (periodId: string) => {
    const value = Number(openingBalanceDraft);
    if (!Number.isFinite(value)) return setMessage("Geçerli bir tutar girin.");
    const oldPeriod = periods.find((p) => p.id === periodId);
    const { error } = await supabase.from("periods").update({ devir_bakiyesi: value }).eq("id", periodId);
    if (error) return showError(error);
    setPeriods((prev) => prev.map((p) => p.id === periodId ? { ...p, devir_bakiyesi: value } : p));
    await logAction("Devir bakiyesi güncellendi", "periods", oldPeriod?.name || periodId, diffOf({ devir_bakiyesi: oldPeriod?.devir_bakiyesi ?? null }, { devir_bakiyesi: value }));
    setEditingOpeningBalance(false);
    setOpeningBalanceDraft("");
  };

  const saveOpeningBalanceNote = async (periodId: string) => {
    const noteText = openingBalanceNoteDraft.trim();
    const oldPeriod = periods.find((p) => p.id === periodId);
    const { error } = await supabase.from("periods").update({ devir_bakiyesi_notu: noteText || null }).eq("id", periodId);
    if (error) return showError(error);
    setPeriods((prev) => prev.map((p) => p.id === periodId ? { ...p, devir_bakiyesi_notu: noteText || null } : p));
    await logAction("Devir bakiyesi notu güncellendi", "periods", oldPeriod?.name || periodId, diffOf({ not: oldPeriod?.devir_bakiyesi_notu || "" }, { not: noteText }));
    setEditingOpeningBalanceNote(false);
    setOpeningBalanceNoteDraft("");
  };

  const updatePayment = async (paymentId: string, newAmount: number, customerId: string) => {
    if (!newAmount || newAmount <= 0) return setMessage("Tutar 0'dan büyük olmalı.");
    const oldPayment = payments.find((p) => p.id === paymentId);
    const { error } = await supabase.from("payments").update({ amount: newAmount }).eq("id", paymentId);
    if (error) return showError(error);
    try { await allocatePaymentsForCustomer(customerId); } catch (err) { return showError(err); }
    await logAction("Ödeme güncellendi", "payments", customerMap.get(customerId)?.name || customerId, diffOf({ tutar: oldPayment?.amount ?? null }, { tutar: newAmount }));
    setEditingPaymentId(null);
    setEditingPaymentAmount("");
    loadAll();
  };

  const deletePayment = async (paymentId: string, customerId: string, amount: number) => {
    if (!confirm(`${money(amount)} tutarındaki ödeme silinecek. Emin misiniz?`)) return;
    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) return showError(error);
    try { await allocatePaymentsForCustomer(customerId); } catch (err) { return showError(err); }
    await logAction("Ödeme silindi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: amount });
    loadAll();
  };

  const savePreorder = async () => {
    if (!preorderForm.customerId) return setMessage("Cari seçin.");
    const validItems = preorderForm.items.filter((i) => i.productId && Number(i.qty) > 0);
    if (!validItems.length) return setMessage("En az bir ürün ekleyin.");
    const customer = customers.find((c) => c.id === preorderForm.customerId);
    if (editingPreorderId) {
      const oldItems = preorderItems.filter((i) => i.preorder_id === editingPreorderId);
      const oldItemsDesc = oldItems.map((i) => `${productMap.get(i.product_id)?.name || i.product_id} (${i.qty} adet)`).join(", ") || "-";
      const newItemsDesc = validItems.map((i) => `${productMap.get(i.productId)?.name || i.productId} (${Number(i.qty)} adet)`).join(", ") || "-";
      const { error } = await supabase.from("preorders").update({ customer_id: preorderForm.customerId, note: preorderForm.note }).eq("id", editingPreorderId);
      if (error) return showError(error);
      await supabase.from("preorder_items").delete().eq("preorder_id", editingPreorderId);
      const { error: itemErr } = await supabase.from("preorder_items").insert(validItems.map((i) => ({ preorder_id: editingPreorderId, product_id: i.productId, qty: Number(i.qty) })));
      if (itemErr) return showError(itemErr);
      await logAction("Ön sipariş güncellendi", "preorders", customer?.name || "", diffOf({ urunler: oldItemsDesc }, { urunler: newItemsDesc }));
      setEditingPreorderId(null);
    } else {
      const { data: newPO, error } = await supabase.from("preorders").insert({ customer_id: preorderForm.customerId, note: preorderForm.note, created_by: currentUserEmail, status: "bekliyor", seller_account_id: currentSellerAccount?.id || null }).select().single();
      if (error || !newPO) return showError(error);
      const { error: itemErr } = await supabase.from("preorder_items").insert(validItems.map((i) => ({ preorder_id: newPO.id, product_id: i.productId, qty: Number(i.qty) })));
      if (itemErr) return showError(itemErr);
      await logAction("Ön sipariş oluşturuldu", "preorders", customer?.name || "", { items: validItems.length, oluşturan: currentUserEmail });
    }
    setPreorderForm({ customerId: "", note: "", items: [{ productId: "", qty: "1" }] });
    loadAll();
  };

  const deletePreorder = async (id: string) => {
    const po = preorders.find((p) => p.id === id);
    if (!confirm("Bu ön sipariş silinecek. Emin misiniz?")) return;
    await supabase.from("preorder_items").delete().eq("preorder_id", id);
    const { error } = await supabase.from("preorders").delete().eq("id", id);
    if (error) return showError(error);
    await logAction("Ön sipariş silindi", "preorders", customerMap.get(po?.customer_id || "")?.name || "");
    loadAll();
  };

  const startEditPreorder = (po: Preorder) => {
    const items = preorderItems.filter((i) => i.preorder_id === po.id);
    setPreorderForm({ customerId: po.customer_id, note: po.note || "", items: items.map((i) => ({ productId: i.product_id, qty: String(i.qty) })) });
    setEditingPreorderId(po.id);
    setActive("preorders");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openConvertModal = (po: Preorder, item: PreorderItem) => {
    setConvertPrices({ [item.id]: "" });
    setConvertPaid("false");
    setConvertSellerProfit("");
    setConvertParaSahibi("");
    setConvertModal({ preorder: po, item });
  };

  const addPreorderAdvancePayment = async () => {
    if (!advancePaymentModal) return;
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) return setMessage("Geçerli bir tutar girin.");
    const method = advanceMethod === "nakit" ? "nakit" : "banka";

    const now = Date.now();
    const yakinZamandaAyniOdeme = payments.some((p) =>
      p.customer_id === advancePaymentModal.customer_id &&
      !p.cancelled &&
      Number(p.amount) === amount &&
      (now - new Date(p.created_at).getTime()) < 3 * 60 * 1000
    );
    if (yakinZamandaAyniOdeme) {
      const devamEt = window.confirm(`Bu müşteriye az önce (son 3 dakika içinde) aynı tutarda (${money(amount)}) bir ödeme zaten eklenmiş görünüyor. Yine de eklemek istediğine emin misin?`);
      if (!devamEt) return;
    }

    const { error } = await supabase.from("payments").insert({
      customer_id: advancePaymentModal.customer_id,
      amount,
      payment_method: method,
      kasa_tutari: amount,
      preorder_id: advancePaymentModal.id,
      note: advanceNote || "Ön ödeme",
      user_email: currentUserEmail,
    });
    if (error) return showError(error);
    await logAction("Ön ödeme alındı", "preorders", customerMap.get(advancePaymentModal.customer_id)?.name || "", { tutar: amount, yontem: method });
    setMessage(`${money(amount)} ön ödeme kaydedildi.`);
    setAdvancePaymentModal(null);
    setAdvanceAmount("");
    setAdvanceNote("");
    loadAll();
  };

  const convertToSales = async () => {
    if (!convertModal) return;
    const { preorder: po, item } = convertModal;
    const price = Number(convertPrices[item.id] || 0);
    if (!price) return setMessage("Fiyat girin.");
    if ((convertPaid === "banka" || convertPaid === "nakit") && !convertParaSahibi) {
      return setMessage("Para kimde? alanını seçmelisin.");
    }
    const product = productMap.get(item.product_id);
    if (!product) return;
    const seller: Seller | null = isSellerRole ? null : (currentUserEmail.includes("mihrimah") ? "Mihrimah" : "Aslı");
    const depoBatchItems = batchItemsForProduct(product.id).filter((bi) => Math.max(bi.bought - getBatchSoldQtyForItem(bi), 0) > 0);
    const totalAvailable = depoBatchItems.reduce((s, bi) => s + Math.max(bi.bought - getBatchSoldQtyForItem(bi), 0), 0);
    if (totalAvailable < item.qty) return setMessage(`${product.name} için yeterli stok yok. Mevcut: ${totalAvailable}, gereken: ${item.qty}.`);

    // Bu ön siparişe daha önce ön ödeme alınmış mı kontrol et
    const advancePayments = payments.filter((p) => p.preorder_id === po.id && !p.cancelled);
    const advanceTotal = advancePayments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const saleTotalTarget = price * item.qty;
    const advanceApplied = Math.min(advanceTotal, saleTotalTarget);
    const remainder = Math.max(saleTotalTarget - advanceTotal, 0);
    const paymentMethod = convertPaid === "nakit" ? "nakit" : convertPaid === "banka" ? "banka" : null;

    // Gerekirse birden fazla partiden karşıla
    let remainingQty = item.qty;
    const rows: Record<string, unknown>[] = [];
    for (const bi of depoBatchItems) {
      if (remainingQty <= 0) break;
      const available = Math.max(bi.bought - getBatchSoldQtyForItem(bi), 0);
      const take = Math.min(available, remainingQty);
      if (take <= 0) continue;
      const rowTotal = price * take;
      const rowShareOfAdvance = saleTotalTarget > 0 ? (rowTotal / saleTotalTarget) * advanceApplied : 0;
      const rowShareOfNewPayment = remainder > 0 && convertPaid !== "false" ? (rowTotal / saleTotalTarget) * remainder : 0;
      const rowPaidAmount = Math.min(rowTotal, rowShareOfAdvance + rowShareOfNewPayment);
      const sellerProfitTotal = isSellerRole ? Number(convertSellerProfit || 0) : 0;
      const rowSellerProfit = item.qty > 0 ? (take / item.qty) * sellerProfitTotal : 0;
      rows.push({
        customer_id: po.customer_id,
        product_id: product.id,
        batch_id: bi.batch_id,
        batch_item_id: bi.id,
        qty: take,
        total: rowTotal,
        cost: bi.buy_price * take + rowSellerProfit,
        seller,
        sale_type: "Normal satış",
        paid: rowPaidAmount >= rowTotal,
        paid_amount: rowPaidAmount,
        payment_method: paymentMethod,
        seller_account_id: currentSellerAccount?.id || null,
        seller_profit: isSellerRole ? rowSellerProfit : null,
      });
      remainingQty -= take;
    }
    if (remainingQty > 0) return setMessage("Parti stokları yetersiz.");
    const { error } = await supabase.from("sales").insert(rows);
    if (error) return showError(error);
    // Bu item'ı sil
    await supabase.from("preorder_items").delete().eq("id", item.id);
    // Kalan item var mı kontrol et, yoksa ön siparişi tamamlandı yap
    const remaining = preorderItems.filter((i) => i.preorder_id === po.id && i.id !== item.id);
    if (remaining.length === 0) {
      await supabase.from("preorders").update({ status: "tamamlandı" }).eq("id", po.id);
    }

    const { data: newSales } = await supabase
      .from("sales")
      .select("id,total")
      .eq("customer_id", po.customer_id)
      .eq("cancelled", false)
      .order("created_at", { ascending: false })
      .limit(rows.length);

    // 1) Ön ödeme varsa: her ön ödeme için, o ödemeden SONRA kapanmış bir dönem var mı kontrol et
    if (advanceTotal > 0 && newSales && newSales.length > 0) {
      let remainingAdvanceToAllocate = advanceApplied;
      for (const payment of advancePayments) {
        if (remainingAdvanceToAllocate <= 0) break;
        const paymentPortion = Math.min(Number(payment.amount), remainingAdvanceToAllocate);
        const periodClosedAfter = periods.some((per) => per.closed && per.closed_at && new Date(per.closed_at) > new Date(payment.created_at));

        if (periodClosedAfter) {
          // Dönem kapanmış: eski ödeme kaydına dokunma, sadece bu döneme ait yeni bir allocation ekle
          const allocations = newSales.map((s: { id: string; total: number }) => ({
            payment_id: payment.id,
            sale_id: s.id,
            amount: (s.total / saleTotalTarget) * paymentPortion,
            created_at: new Date().toISOString(),
          }));
          await supabase.from("payment_allocations").insert(allocations);
        } else {
          // Dönem kapanmamış: ön ödeme kaydını silip tek, temiz bir peşin tahsilat kaydına dönüştür
          await supabase.from("payments").delete().eq("id", payment.id);
          const { data: cleanPay, error: cleanErr } = await supabase
            .from("payments")
            .insert({
              customer_id: po.customer_id,
              amount: paymentPortion,
              payment_method: payment.payment_method,
              kasa_tutari: paymentPortion,
              para_sahibi: payment.para_sahibi || null,
              user_email: payment.user_email,
              created_at: payment.created_at,
            })
            .select()
            .single();
          if (!cleanErr && cleanPay) {
            const allocations = newSales.map((s: { id: string; total: number }) => ({
              payment_id: cleanPay.id,
              sale_id: s.id,
              amount: (s.total / saleTotalTarget) * paymentPortion,
              created_at: cleanPay.created_at,
            }));
            await supabase.from("payment_allocations").insert(allocations);
          }
        }
        remainingAdvanceToAllocate -= paymentPortion;
      }
    }

    // 2) Ön ödemenin karşılamadığı kalan tutar için (varsa), seçilen ödeme türüne göre yeni tahsilat ekle
    if (remainder > 0 && convertPaid !== "false" && newSales && newSales.length > 0) {
      const { data: payData, error: payErr } = await supabase
        .from("payments")
        .insert({ customer_id: po.customer_id, amount: remainder, user_email: currentUserEmail, payment_method: paymentMethod, kasa_tutari: remainder, para_sahibi: convertParaSahibi, seller_account_id: currentSellerAccount?.id || null })
        .select()
        .single();
      if (!payErr && payData) {
        const allocations = newSales.map((s: { id: string; total: number }) => ({
          payment_id: payData.id,
          sale_id: s.id,
          amount: (s.total / saleTotalTarget) * remainder,
          created_at: payData.created_at,
        }));
        await supabase.from("payment_allocations").insert(allocations);
      }
    }

    // 3) Hiç ön ödeme yoksa ve cari borç seçiliyse, cari bakiyesindeki fazla ödemeleri otomatik eşleştir
    if (advanceTotal === 0 && convertPaid === "false") {
      try { await allocatePaymentsForCustomer(po.customer_id); } catch (err) { console.warn("allocate error", err); }
    }

    await logAction("Ön sipariş satır satışa dönüştürüldü", "preorders", customerMap.get(po.customer_id)?.name || "", { ürün: product.name, adet: item.qty, odeme_yontemi: paymentMethod, on_odeme_kullanildi: advanceApplied });
    setConvertModal(null);
    setMessage("");
    loadAll();
  };

  const markPayment = async (customerId: string) => {
    const balance = getCustomerBalance(customerId);
    if (balance <= 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email || null;
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount: balance, user_email: userEmail });
    if (error) return showError(error);
    try {
      await allocatePaymentsForCustomer(customerId);
    } catch (err) {
      return showError(err);
    }
    await logAction("Tamamı ödendi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: balance });
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
    loadAll();
  };

  const updatePartner = async (id: string, field: keyof PartnerRow, value: number | string) => {
    const partner = partners.find((p) => p.id === id);
    const { error } = await supabase.from("partner_ledger").update({ [field]: value }).eq("id", id);
    if (error) return showError(error);
    await logAction("Ortaklık kaydı değiştirildi", "partner_ledger", partner?.partner_name || id, diffOf(partner as unknown as Record<string, unknown>, { [field]: value }));
    loadAll();
  };

  const applyPeriodOpening = async () => {
    const productCost = Number(periodForm.productCost || 0);
    const shippingCost = Number(periodForm.shippingCost || 0);
    const sponsor = Number(periodForm.sponsor || 0);
    const asliContribution = Number(periodForm.asli || 0);
    const mihrimahContribution = Number(periodForm.mihrimah || 0);
    const eachResponsibility = productCost / 2 + shippingCost / 2;

    const { error: periodError } = await supabase.from("periods").insert({
      name: periodForm.name || `Dönem ${today()}`,
      sponsor_contribution: sponsor,
      asli_contribution: asliContribution,
      mihrimah_contribution: mihrimahContribution,
      product_cost: productCost,
      shipping_cost: shippingCost,
      closed: false,
    });
    if (periodError) return showError(periodError);

    const veli = partners.find((p) => p.partner_name === "Veli");
    const asli = partners.find((p) => p.partner_name === "Aslı");
    const mihrimah = partners.find((p) => p.partner_name === "Mihrimah");

    const updates = [];
    if (veli) updates.push(supabase.from("partner_ledger").update({ contribution: veli.contribution + sponsor, receivable: veli.receivable + sponsor }).eq("id", veli.id));
    if (asli) updates.push(supabase.from("partner_ledger").update({ contribution: asli.contribution + asliContribution, debt: Math.max(asli.debt + eachResponsibility - asliContribution, 0) }).eq("id", asli.id));
    if (mihrimah) updates.push(supabase.from("partner_ledger").update({ contribution: mihrimah.contribution + mihrimahContribution, debt: Math.max(mihrimah.debt + eachResponsibility - mihrimahContribution, 0) }).eq("id", mihrimah.id));
    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return showError(firstError);
    await logAction("Dönem açıldı", "periods", periodForm.name || `Dönem ${today()}`, { sponsor, asliContribution, mihrimahContribution, productCost, shippingCost });
    setMessage("Yeni dönem açılışı ve katkılar işlendi.");
    loadAll();
  };

  const exportTahsilatToExcel = () => {
    const rows: (string | number)[][] = [];
    const headers = ["Tarih", "Cari", "Ekleyen", "Yöntem", "Tutar", "Kasa", "Para Kimde"];
    if (!isSellerRole) headers.push("Açıklama");
    rows.push(headers);

    if (!isSellerRole && totals.openingBalance !== 0) {
      rows.push([
        "Dönem Başlangıç Kasa Bakiyesi (önceki dönemden devir)", "", "", "",
        "",
        Number(totals.openingBalance),
        "",
        totals.openingBalanceNote || "",
      ]);
    }

    [...totals.recentPayments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((pay) => {
        const row: (string | number)[] = [
          toTR(pay.created_at, true),
          customerMap.get(pay.customer_id)?.name || "-",
          pay.user_email?.split("@")[0] || "-",
          pay.payment_method === "nakit" ? "Nakit" : pay.payment_method === "banka" ? "Banka" : "-",
          Number(pay.amount),
          pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? Number(pay.kasa_tutari) : "",
          pay.para_sahibi || "",
        ];
        if (!isSellerRole) row.push(pay.aciklama || "");
        rows.push(row);
      });

    const kasaToplam = toplamKasaHavuzu;
    rows.push(["Toplam", "", "", "", Number(totals.grossCash), kasaToplam, ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 17 }, { wch: 26 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 34 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tahsilatlar");
    XLSX.writeFile(wb, `Donem_Tahsilatlari_${today()}.xlsx`);
  };

  const exportKarDetayToExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["Tarih", "Cari", "Ürün", "Adet", "Satış", "Tahsilat", "Maliyet", "Ek Maliyet", "Kar"]);

    [...karDetay]
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
      .forEach((row) => {
        rows.push([
          toTR(row.tarih, true),
          row.cari,
          row.urun + (row.saleType === "Hibe" ? " (Hibe)" : "") + (row.fromPreviousPeriod ? " (önceki dönem ön ödemesi)" : ""),
          row.adet,
          Number(row.satisFiyati),
          Number(row.tahsilat),
          Number(row.maliyet),
          Number(row.ekMaliyet),
          Number(row.kar),
        ]);
      });

    rows.push([
      "Toplam Tahsilat", "", "", "", "",
      karDetay.reduce((s, r) => s + r.tahsilat, 0),
      karDetay.reduce((s, r) => s + r.maliyet, 0),
      karDetay.reduce((s, r) => s + r.ekMaliyet, 0),
      "",
    ]);
    const eskiDonemTahsilatExport = karDetay.filter((r) => r.fromPreviousPeriod).reduce((s, r) => s + r.tahsilat, 0);
    if (eskiDonemTahsilatExport > 0) {
      const buDonemTahsilatExport = karDetay.reduce((s, r) => s + r.tahsilat, 0) - eskiDonemTahsilatExport;
      rows.push([`  - Bu dönemin gerçek tahsilatı: ${buDonemTahsilatExport}`, "", "", "", "", "", "", "", ""]);
      rows.push([`  - Önceki dönem ön ödemelerinden: ${eskiDonemTahsilatExport}`, "", "", "", "", "", "", "", ""]);
    }
    rows.push(["Toplam Net Kar", "", "", "", "", "", "", "", Number(anlıkKar)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 17 }, { wch: 22 }, { wch: 26 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 11 }, { wch: 11 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Net Kar Detayi");
    XLSX.writeFile(wb, `Net_Kar_Detayi_${today()}.xlsx`);
  };

  const exportPreorderToExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["Tarih", "Müşteri", "Satıcı", "Ürün", "Adet", "Not", "Ön Ödeme"]);

    const list = (isSellerRole ? myPreorders : preorders).filter((po) => po.status === "bekliyor");
    [...list]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((po) => {
        const items = preorderItems.filter((i) => i.preorder_id === po.id);
        const customer = customerMap.get(po.customer_id);
        const advanceTotal = payments
          .filter((p) => p.preorder_id === po.id && !p.cancelled)
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        items.forEach((item) => {
          rows.push([
            toTR(po.created_at, true),
            customer?.name || "-",
            shortUserName(po.created_by),
            productMap.get(item.product_id)?.name || "-",
            item.qty,
            po.note || "",
            advanceTotal,
          ]);
        });
      });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 17 }, { wch: 22 }, { wch: 12 }, { wch: 26 }, { wch: 6 }, { wch: 24 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bekleyen Ön Siparişler");
    XLSX.writeFile(wb, `Bekleyen_On_Siparisler_${today()}.xlsx`);
  };

  const closePeriod = async () => {
   try {
    const distributableProfit = Math.round(donemKapanisKari * 100) / 100;
    // Aslı/Mihrimah arasında bölüşülecek pay SADECE şirket kârından (satıcıların kendi kâr payı hariç)
    const companyProfit = Math.round(anlıkKar * 100) / 100;
    if (!Number.isFinite(distributableProfit) || !Number.isFinite(companyProfit)) {
      window.alert("Kar hesabında geçersiz bir değer var (NaN), dönem kapatılamadı. Lütfen ek maliyet ve satış kayıtlarını kontrol edin.");
      setMessage("Kar hesabında geçersiz bir değer var (NaN), dönem kapatılamadı. Lütfen ek maliyet ve satış kayıtlarını kontrol edin.");
      return;
    }
    if (distributableProfit <= 0) {
      window.alert(`Kar tablosuna göre dağıtılacak kar yok. (Hesaplanan: ${money(distributableProfit)})`);
      setMessage("Kar tablosuna göre dağıtılacak kar yok.");
      return;
    }

    const half = Math.max(companyProfit, 0) / 2;
    const closedAt = new Date().toISOString();
    const asli = partners.find((p) => p.partner_name === "Aslı");
    const mihrimah = partners.find((p) => p.partner_name === "Mihrimah");
    const updates = [];

    if (asli) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(asli.debt - half, 0), profit_share: asli.profit_share + half }).eq("id", asli.id));
    if (mihrimah) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(mihrimah.debt - half, 0), profit_share: mihrimah.profit_share + half }).eq("id", mihrimah.id));

    // Kasada fiilen olan para (Kasa Havuzları Toplamı) ile dağıtılan kar arasındaki fark (dağıtılmayan/devreden kasa)
    const devirBakiyesi = Math.round((toplamKasaHavuzu - distributableProfit) * 100) / 100;

    // Bu dönemde satıcıların ne kadar kâr payı gerçekleştirdiğinin anlık görüntüsü (Dönem Geçmişi'nde "Satıcılar" kolonu için)
    const sellerDistributions = sellerAccounts
      .map((s) => ({ seller_id: s.id, name: s.name, amount: Math.round((sellerRealizedProfitSinceClose.get(s.id) || 0) * 100) / 100 }))
      .filter((s) => s.amount > 0);

    const openPeriod = periods.find((p) => !p.closed);
    const periodPayload = {
      closed: true,
      closed_at: closedAt,
      closing_cash: Number(totals.cash || 0),
      asli_distribution: half,
      mihrimah_distribution: half,
      donem_kari: distributableProfit,
      devir_bakiyesi: devirBakiyesi,
      seller_distributions: sellerDistributions,
    };

    if (openPeriod) {
      updates.push(supabase.from("periods").update(periodPayload).eq("id", openPeriod.id));
    } else {
      updates.push(
        supabase.from("periods").insert({
          name: `Kapanış ${today()}`,
          sponsor_contribution: 0,
          asli_contribution: 0,
          mihrimah_contribution: 0,
          product_cost: 0,
          shipping_cost: 0,
          ...periodPayload,
        })
      );
    }

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      window.alert(`Dönem kapatma başarısız oldu:\n${firstError.message || firstError}`);
      return showError(firstError);
    }
    await logAction("Dönem kapatıldı", "periods", openPeriod?.name || `Kapanış ${today()}`, { dagitilan_kar: distributableProfit, asli_payi: half, mihrimah_payi: half, devir_bakiyesi: devirBakiyesi, satici_dagilimi: sellerDistributions });
    window.alert(`Dönem kapatıldı.\nToplam tanınan kâr: ${money(distributableProfit)} (şirket: ${money(companyProfit)}, satıcılar: ${money(distributableProfit - companyProfit)}).\nŞirket kârı Aslı ve Mihrimah arasında %50/%50 dağıtıldı.\nAslı payı: ${money(half)}\nMihrimah payı: ${money(half)}${devirBakiyesi !== 0 ? `\n\nKasada dağıtılmayan ${money(devirBakiyesi)} bir sonraki döneme devir bakiyesi olarak taşınacak.` : ""}`);
    setMessage(`Dönem kapatıldı; şirket kârı (${money(companyProfit)}) Aslı ve Mihrimah arasında %50/%50 dağıtıldı.`);
    loadAll();
   } catch (err: unknown) {
     const msg = err instanceof Error ? err.message : String(err);
     window.alert(`Dönem kapatma sırasında beklenmeyen bir hata oluştu:\n${msg}`);
     showError(err);
   }
  };

  const openProductDetail = (product: Product) => {
    const nextId = expandedProductId === product.id ? null : product.id;
    setExpandedProductId(nextId);
    setEditingProductId(null);
  };

  const startProductEdit = (product: Product) => {
    setProductDrafts({
      ...productDrafts,
      [product.id]: {
        name: product.name,
        gender_category: product.gender_category,
        image_url: product.image_url,
      },
    });
    setEditingProductId(product.id);
  };

  const cancelProductEdit = (productId: string) => {
    const next = { ...productDrafts };
    delete next[productId];
    setProductDrafts(next);
    setEditingProductId(null);
  };

  const saveProductEdit = async (productId: string) => {
    const draft = productDrafts[productId] || {};
    const product = products.find((p) => p.id === productId);

    // Read image from ref (most reliable) or fall back to draft/existing
    let imageUrl: string | null = pendingImageRef.current[productId] || (draft.image_url as string | undefined) || product?.image_url || null;

    if (imageUrl && imageUrl.startsWith("data:")) {
      setMessage("Resim yükleniyor...");
      imageUrl = await uploadImageToStorage(imageUrl, product?.code || productId);
      delete pendingImageRef.current[productId];
    }

    const newManualPrice = draft.manual_price !== undefined ? (draft.manual_price as number | null) : (product?.manual_price ?? null);

    await updateProduct(productId, {
      name: String(draft.name || product?.name || "").trim(),
      gender_category: (draft.gender_category || product?.gender_category) as GenderCategory,
      image_url: imageUrl,
      manual_price: newManualPrice,
    });

    // Fiyat sadece bir tavsiye - satış anında elle girilen fiyat asıl geçerli olan.
    // Yine de tüm parti kayıtlarındaki tavsiye fiyatı güncel tutalım.
    if (newManualPrice !== undefined && newManualPrice !== null && Number(newManualPrice) !== Number(product?.manual_price ?? NaN)) {
      await supabase.from("batch_items").update({ sale_price: newManualPrice }).eq("product_id", productId);
    }

    cancelProductEdit(productId);
  };

  const openCustomerDetail = (customer: Customer) => {
    const nextId = expandedCustomerId === customer.id ? null : customer.id;
    setExpandedCustomerId(nextId);
    setEditingCustomerId(null);
  };

  const startCustomerEdit = (customer: Customer) => {
    setCustomerDrafts({
      ...customerDrafts,
      [customer.id]: {
        name: customer.name,
        passive: customer.passive,
      },
    });
    setEditingCustomerId(customer.id);
  };

  const cancelCustomerEdit = (customerId: string) => {
    const next = { ...customerDrafts };
    delete next[customerId];
    setCustomerDrafts(next);
    setEditingCustomerId(null);
  };

  const saveCustomerEdit = async (customerId: string) => {
    const draft = customerDrafts[customerId] || {};
    const name = String(draft.name || "").trim();
    if (!name || name.length > 50) {
      setMessage("Cari adı zorunlu ve en fazla 50 karakter olmalı.");
      return;
    }
    const oldCustomer = customers.find((c) => c.id === customerId);
    const { error } = await supabase
      .from("customers")
      .update({ name, passive: Boolean(draft.passive) })
      .eq("id", customerId);
    if (error) return showError(error);
    await logAction("Cari değiştirildi", "customers", oldCustomer?.name || customerId, diffOf(
      { ad: oldCustomer?.name || "", pasif: Boolean(oldCustomer?.passive) },
      { ad: name, pasif: Boolean(draft.passive) }
    ));
    cancelCustomerEdit(customerId);
    loadAll();
  };

  const fullMenu = [
    ["dashboard", "Özet Tablo"],
    ["preorders", "Ön Siparişler"],
    ["products", "Ürünler"],
    ["gallery", "Toplu Ürün Resimleri"],
    ["partiIslemleri", "Parti İşlemleri"],
    ["returns", "Toptancı İadeleri"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
    ["payments", "Ödemeler"],
    ["sellers", "Satıcılar"],
    ["period", "Dönem Kapanışı"],
    ["audit", "İşlem Geçmişi"],
  ];
  const sellerMenu = [
    ["dashboard", "Özet Tablo"],
    ["preorders", "Ön Siparişler"],
    ["products", "Stok"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
  ];
  const menu = isSellerRole ? sellerMenu : fullMenu;

  useEffect(() => {
    if (isSellerRole && !sellerMenu.some(([key]) => key === active)) {
      setActive("dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSellerRole, active]);

  const filteredProducts = sortedProducts.filter((p) => `${p.name} ${p.code} ${p.gender_category}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (active !== "products") {
      setProductSort({ mode: "az" });
    }
  }, [active]);

  const displayedProducts = useMemo(() => {
    if (productSort.mode === "az") {
      return [...filteredProducts].sort((a, b) => a.name.localeCompare(b.name, "tr"));
    }
    if (productSort.mode === "gender") {
      const order = genderSortOrders[productSort.orderIndex % genderSortOrders.length];
      return [...filteredProducts].sort((a, b) => {
        const ai = order.indexOf(a.gender_category);
        const bi = order.indexOf(b.gender_category);
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name, "tr");
      });
    }
    const getVal = (p: Product) => {
      if (productSort.col === "fiyat") return getProductLatestPrice(p.id);
      if (productSort.col === "alinan") return getProductTotalBought(p.id);
      if (productSort.col === "satilan") return getProductSoldQty(p.id);
      return getProductStock(p.id);
    };
    if (productSort.mode === "gender-column") {
      const order = genderSortOrders[productSort.orderIndex % genderSortOrders.length];
      return [...filteredProducts].sort((a, b) => {
        const ai = order.indexOf(a.gender_category);
        const bi = order.indexOf(b.gender_category);
        if (ai !== bi) return ai - bi;
        return (getVal(a) - getVal(b)) * (productSort.dir === "asc" ? 1 : -1);
      });
    }
    return [...filteredProducts].sort((a, b) => (getVal(a) - getVal(b)) * (productSort.dir === "asc" ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, productSort, batchItems, sales]);


  const handleSalesSort = (col: string) => setSalesSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
  const salesSortArr = (col: string) => salesSort.col === col ? (salesSort.dir === "asc" ? " ▲" : " ▼") : " ↕";
  const sortedSales = [...(isSellerRole ? myActiveSales : activeSales)].filter((sale) => {
    if (saleStatusFilter === "Tümü") return true;
    const status = getSaleStatus(sale);
    if (typeof status === "string") return status === saleStatusFilter;
    return false;
  }).sort((a, b) => {
    let av: string|number = "", bv: string|number = "";
    if (salesSort.col === "created_at") { av = a.created_at||""; bv = b.created_at||""; }
    else if (salesSort.col === "customer") { av = customerMap.get(a.customer_id)?.name||""; bv = customerMap.get(b.customer_id)?.name||""; }
    else if (salesSort.col === "product") { av = productMap.get(a.product_id)?.name||""; bv = productMap.get(b.product_id)?.name||""; }
    else if (salesSort.col === "batch") { av = batchMap.get(a.batch_id)?.name||""; bv = batchMap.get(b.batch_id)?.name||""; }
    else if (salesSort.col === "seller") { av = a.seller||""; bv = b.seller||""; }
    else if (salesSort.col === "sale_type") { av = a.sale_type||""; bv = b.sale_type||""; }
    else if (salesSort.col === "qty") { av = a.qty; bv = b.qty; }
    else if (salesSort.col === "total") { av = a.total; bv = b.total; }
    else if (salesSort.col === "cost") { av = a.cost; bv = b.cost; }
    else if (salesSort.col === "profit") { av = a.total-a.cost; bv = b.total-b.cost; }
    else if (salesSort.col === "status") { av = getSaleStatus(a) as string||""; bv = getSaleStatus(b) as string||""; }
    const cmp = typeof av === "number" ? av-(bv as number) : String(av).localeCompare(String(bv),"tr",{numeric:true});
    return salesSort.dir === "asc" ? cmp : -cmp;
  });
  const salesTh = (col: string, label: string) => (
    <button type="button" onClick={() => handleSalesSort(col)} style={{fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0,whiteSpace:"nowrap"}}>{label}{salesSortArr(col)}</button>
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{position:"fixed",inset:0,zIndex:999999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}
        >
          <img src={lightboxImg} alt="Tam ekran" style={{maxWidth:"95vw",maxHeight:"92vh",borderRadius:12,objectFit:"contain",boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightboxImg(null)} style={{position:"absolute",top:16,right:16,background:"white",border:"none",borderRadius:"50%",width:36,height:36,fontSize:20,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>✕</button>
        </div>
      )}

      {/* Split Depo Modal */}
      {splitModal && (() => {
        const { item, newDepo } = splitModal;
        const kalan = item.bought - getBatchSoldQtyForItem(item);
        const mevcutDepo = item.depo || "Belirsiz";
        const qty = Math.min(Math.max(Number(splitQty)||1, 1), kalan);
        const kalanDiger = kalan - qty;
        const handleSplit = async () => {
          if (qty >= kalan) {
            // Tümü yeni depoya — sadece depo güncelle
            await updateBatchItem(item.id, { depo: newDepo });
          } else {
            // Mevcut satırın bought'unu kalan - qty kadar azalt (satılanlar korunur)
            const yeniBought = item.bought - qty;
            await updateBatchItem(item.id, { bought: yeniBought });
            // Yeni satır: sadece taşınan kadar, satış yok
            await supabase.from("batch_items").insert({
              product_id: item.product_id,
              batch_id: item.batch_id,
              bought: qty,
              buy_price: item.buy_price,
              sale_price: item.sale_price,
              depo: newDepo,
            });
            loadAll();
          }
          setSplitModal(null);
          setSplitQty("");
        };
        return (
          <div onClick={() => setSplitModal(null)} style={{position:"fixed",inset:0,zIndex:999998,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div onClick={(e) => e.stopPropagation()} style={{background:"white",borderRadius:18,width:"100%",maxWidth:400,padding:24,boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
              <div style={{fontWeight:700,fontSize:"1rem",marginBottom:8}}>{productMap.get(item.product_id)?.name} — {batchMap.get(item.batch_id)?.name}</div>
              <div style={{fontSize:"0.875rem",color:"#64748b",marginBottom:16}}>
                Stokta <b>{kalan}</b> adet var. Kaçını <b>{newDepo}</b>'ya taşımak istiyorsunuz?
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <input className="input" type="number" min="1" max={kalan} value={splitQty} onChange={(e) => setSplitQty(e.target.value)} style={{width:100,textAlign:"center",fontSize:"1.25rem",fontWeight:700}} />
                <div style={{fontSize:"0.8rem",color:"#64748b"}}>
                  <div>{newDepo}: <b>{qty}</b> adet</div>
                  {kalanDiger > 0 && <div>{mevcutDepo}: <b>{kalanDiger}</b> adet kalır</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button type="button" className="btn" onClick={handleSplit}>Taşı</button>
                <button type="button" className="btn-secondary" onClick={() => setSplitModal(null)}>İptal</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sales Detail Modal */}
      {salesModalProductId && (() => {
        const product = products.find((p) => p.id === salesModalProductId);
        const productSales = activeSales.filter((s) => s.product_id === salesModalProductId);
        return (
          <div onClick={() => setSalesModalProductId(null)} style={{position:"fixed",inset:0,zIndex:999998,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div onClick={(e) => e.stopPropagation()} style={{background:"white",borderRadius:18,width:"100%",maxWidth:560,maxHeight:"80vh",overflow:"auto",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
              <div style={{padding:"18px 20px 12px",borderBottom:"1.5px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:"1rem",color:"#0f172a"}}>{product?.name}</div>
                  <div style={{fontSize:"0.75rem",color:"#94a3b8",marginTop:2}}>Satış Detayları</div>
                </div>
                <button onClick={() => setSalesModalProductId(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#64748b",lineHeight:1}}>✕</button>
              </div>
              <div style={{padding:"0 0 8px"}}>
                {productSales.length === 0 ? (
                  <div style={{padding:24,textAlign:"center",color:"#94a3b8",fontSize:"0.875rem"}}>Satış kaydı yok.</div>
                ) : (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8125rem"}}>
                    <thead>
                      <tr style={{background:"#f8fafc"}}>
                        <th style={{padding:"10px 16px",textAlign:"left",fontWeight:700,color:"#64748b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Parti</th>
                        <th style={{padding:"10px 16px",textAlign:"left",fontWeight:700,color:"#64748b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Cari</th>
                        <th style={{padding:"10px 16px",textAlign:"center",fontWeight:700,color:"#64748b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Adet</th>
                        <th style={{padding:"10px 16px",textAlign:"right",fontWeight:700,color:"#64748b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Tutar</th>
                        <th style={{padding:"10px 16px",textAlign:"left",fontWeight:700,color:"#64748b",fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSales.map((sale) => (
                        <tr key={sale.id} style={{borderTop:"1px solid #f1f5f9"}}>
                          <td style={{padding:"10px 16px",color:"#334155",fontWeight:600}}>{batchMap.get(sale.batch_id)?.name || "-"}</td>
                          <td style={{padding:"10px 16px",color:"#0f172a"}}>{customerMap.get(sale.customer_id)?.name || "-"}</td>
                          <td style={{padding:"10px 16px",textAlign:"center",color:"#334155"}}>{sale.qty}</td>
                          <td style={{padding:"10px 16px",textAlign:"right",color:"#334155"}}>{money(sale.total)}</td>
                          <td style={{padding:"10px 16px",color:"#94a3b8",fontSize:"0.75rem"}}>{toTR(sale.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r bg-white p-5 lg:block">
        <div className="mb-8">
          <h1 className="text-lg font-bold">Ticari Takip</h1>
          <p className="text-xs text-slate-500">Supabase bağlı sürüm</p>
          {currentUserEmail && (
            <div className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              👤 {currentUserEmail.includes("mihrimah") ? "Mihrimah" : currentUserEmail.includes("asli") ? "Aslı" : currentUserEmail.includes("veli") ? "Veli" : currentUserEmail.split("@")[0]}
            </div>
          )}
        </div>
        <nav className="space-y-2">
          {menu.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActive(key)} className={`w-full rounded-xl px-4 py-3 text-left ${active === key ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={onLogout} className="w-full rounded-xl px-4 py-3 text-left text-red-600 hover:bg-red-50 font-semibold">
            Çıkış
          </button>
        </nav>
      </aside>

      <section className="p-3 lg:ml-72 lg:p-8">
        {/* Scroll to top button - top right */}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{position:"fixed", right:"16px", top:"16px", zIndex:99999}} className="rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-bold text-black shadow-2xl">
          ↑ En Üste
        </button>

        {loadingData && (
          <div style={{position:"fixed",top:0,left:0,right:0,height:3,zIndex:99998,background:"linear-gradient(90deg,#0f172a 0%,#64748b 50%,#0f172a 100%)",backgroundSize:"200% 100%",animation:"loadbar 1.2s linear infinite"}} />
        )}

        {message && getMessageTone(message) === "error" ? (
          <div
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100000,
              maxWidth: "92vw",
              minWidth: 300,
            }}
            className="flex items-center gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-2xl"
          >
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <span className="flex-1">{message}</span>
            <button type="button" onClick={() => { setMessage(""); setForcedErrorMessage(false); }} style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1, opacity: 0.6 }}>
              ✕
            </button>
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pr-28">
          <div>
            <h2 className="text-3xl font-bold">{menu.find((m) => m[0] === active)?.[1]}</h2>
            <p className="text-slate-500">Ürün satış, cari, stok ve dönem bazlı ortaklık takibi</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 lg:hidden">
          {currentUserEmail && (
            <div className="col-span-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 text-center">
              👤 {currentUserEmail.includes("mihrimah") ? "Mihrimah" : currentUserEmail.includes("asli") ? "Aslı" : currentUserEmail.includes("veli") ? "Veli" : currentUserEmail.split("@")[0]}
            </div>
          )}
          {menu.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActive(key)} className={`rounded-xl px-3 py-2 ${active === key ? "bg-slate-900 text-white" : "bg-white"}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={onLogout} className="rounded-xl px-3 py-2 bg-white text-red-600 font-semibold col-span-2">
            Çıkış
          </button>
        </div>

        {active === "dashboard" && isSellerRole && (
          <div className="space-y-4">
            <div className="stat-grid">
              <StatCard title="Toplam Satış" value={money(myActiveSales.reduce((s,sale) => s + toNum(sale.total), 0))} note="Kendi satış toplamın" />
              <div onClick={() => setShowTahsilatDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Tahsilatlarım" value={money(totals.grossCash)} note="Detay için tıklayın ↗" />
              </div>
              <div onClick={() => setShowMusteriDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Cari Borçlarım" value={money(totals.customerDebt)} note="Detay için tıklayın ↗" />
              </div>
              <StatCard title="Kendi Karım" value={money(myActiveSales.reduce((s,sale) => s + Number(sale.seller_profit || 0), 0))} note="Bu döneme ait toplam payın" />
              <StatCard title="Mevcut Stok" value={totals.totalStock} note="Toplam ürün adedi" />
            </div>
            <Card title="Son Hareketlerim">
              <Table
                headers={["Tarih", "Tür", "Cari", "Detay", "Tutar", "Kim"]}
                rows={recentMovements.map((movement) => [
                  toTR(movement.date, true),
                  movement.type,
                  movement.customer,
                  movement.detail,
                  money(movement.amount),
                  movement.user,
                ])}
              />
            </Card>
          </div>
        )}

        {active === "dashboard" && !isSellerRole && (
          <div className="space-y-4">
            <div className="stat-grid">
              <StatCard title="Toplam Satış" value={money(activeSales.reduce((s,sale) => s + toNum(sale.total), 0))} note="Aktif satış toplamı" />
              <div onClick={() => setShowTahsilatDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Dönem Tahsilatları" value={money(totals.grossCash)} note="Detay için tıklayın ↗" />
              </div>
              {totals.refundIncome > 0 && (
                <StatCard title="Bekleyen İade Geliri" value={money(totals.refundIncome)} note="Toptancıdan gelen para iadesi, dönem kapanışında paylaşılır" />
              )}
              <div onClick={() => setShowMusteriDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Müşteri Borcu" value={money(totals.customerDebt)} note="Detay için tıklayın ↗" />
              </div>
              <div onClick={() => setShowKarDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Dönem Net Karı" value={money(anlıkKar)} note="Detay için tıklayın ↗" />
              </div>
              <div onClick={() => setShowStokDetay(true)} style={{cursor:"pointer"}}>
                <StatCard title="Mevcut Stok" value={totals.totalStock} note="Detay için tıklayın ↗" />
              </div>
            </div>
            <Card title="Son Hareketler">
              <Table
                headers={["Tarih", "Tür", "Cari", "Detay", "Tutar", "Kim"]}
                rows={recentMovements.map((movement) => [
                  toTR(movement.date, true),
                  movement.type,
                  movement.customer,
                  movement.detail,
                  money(movement.amount),
                  movement.user,
                ])}
              />
            </Card>
          </div>
        )}


        {active === "recent" && (
          <div className="space-y-4">
            <Card title="Son Hareketler">
              <Table
                headers={["Tarih", "Tür", "Cari", "Detay", "Tutar", "Kim"]}
                rows={recentMovements.map((movement) => [
                  toTR(movement.date, true),
                  movement.type,
                  movement.customer,
                  movement.detail,
                  money(movement.amount),
                  movement.user,
                ])}
              />
            </Card>
          </div>
        )}

        {active === "audit" && (
          <AuditSection supabase={supabase} />
        )}

        {active === "products" && (
          <div className="space-y-0">
            {/* Mobile-first product page */}
            <div className="product-page">
              <div className="product-page-header">
                <h2 className="product-page-title">{isSellerRole ? "Ürünler" : "Ürün Listesi ve Stok Özeti"}</h2>
                {!isSellerRole && (
                  <div style={{display:"flex", gap:8}}>
                    <button type="button" className="btn-secondary" style={{fontSize:"0.8rem", padding:"6px 12px"}} onClick={() => setActive("gallery")}>🖼 Toplu Resimler</button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{fontSize:"0.8rem", padding:"6px 12px"}}
                      onClick={async () => {
                        const shareUrl = `${window.location.origin}/galeri`;
                        if (navigator.share) {
                          try {
                            await navigator.share({ title: "Ürün Kataloğu", url: shareUrl });
                          } catch (err) {
                            if ((err as Error)?.name !== "AbortError") {
                              console.warn("Paylaşım başarısız", err);
                            }
                          }
                        } else {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            setMessage("Paylaşım linki panoya kopyalandı.");
                          } catch {
                            setMessage(shareUrl);
                          }
                        }
                      }}
                    >
                      🔗 Paylaşım Linki
                    </button>
                  </div>
                )}
              </div>
              {!isSellerRole && (
              <div className="product-add-wrap product-add-wrap--top">
                <details className="w-full">
                  <summary className="product-add-btn" style={{listStyle:"none", cursor:"pointer"}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Ürün Ekle
                  </summary>
                  <div className="product-add-form-panel">
                    <div className="grid gap-3 md:grid-cols-4">
                      <input className="input" maxLength={50} placeholder="Ürün adı (max 50)" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                      <select className="input" value={newProduct.genderCategory} onChange={(e) => setNewProduct({ ...newProduct, genderCategory: e.target.value as GenderCategory })}><option>Kadın</option><option>Erkek</option><option>Unisex</option></select>
                      <label className="input cursor-pointer text-center">Resim Seç<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setNewProduct((prev) => ({ ...prev, image: String(reader.result || "") })); reader.readAsDataURL(file); }} /></label>
                      <button type="button" className="btn" onClick={addProductDefinition}>Kaynak Ürün Ekle</button>
                    </div>
                    {newProduct.image ? <img src={newProduct.image} alt="Önizleme" className="mt-4 h-24 w-24 rounded-xl border object-cover" /> : null}
                  </div>
                </details>
              </div>
              )}
              <div className="product-search-wrap">
                <div className="product-search-inner">
                  <svg className="product-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="product-search-input" placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="product-sort-row">
                <div className="product-sort-buttons">
                  <button type="button" className={`product-sort-btn ${productSort.mode === "az" ? "product-sort-btn--active" : ""}`} onClick={() => setProductSort({ mode: "az" })}>A-Z</button>
                  <button
                    type="button"
                    className={`product-sort-btn ${productSort.mode === "gender" || productSort.mode === "gender-column" ? "product-sort-btn--active" : ""}`}
                    onClick={() => setProductSort((prev) => {
                      if (prev.mode === "gender") return { mode: "gender", orderIndex: prev.orderIndex + 1 };
                      if (prev.mode === "gender-column") return { ...prev, orderIndex: prev.orderIndex + 1 };
                      return { mode: "gender", orderIndex: 0 };
                    })}
                  >
                    K-E-U
                  </button>
                </div>
                {(isSellerRole ? (["fiyat", "stok"] as const) : (["fiyat", "alinan", "satilan", "stok"] as const)).map((col) => (
                  <button
                    key={col}
                    type="button"
                    className="product-sort-col"
                    onClick={() => setProductSort((prev) => {
                      if (prev.mode === "gender" || prev.mode === "gender-column") {
                        const orderIndex = prev.orderIndex;
                        if (prev.mode === "gender-column" && prev.col === col) {
                          return { mode: "gender-column", orderIndex, col, dir: prev.dir === "asc" ? "desc" : "asc" };
                        }
                        return { mode: "gender-column", orderIndex, col, dir: "desc" };
                      }
                      if (prev.mode === "column" && prev.col === col) {
                        return { mode: "column", col, dir: prev.dir === "asc" ? "desc" : "asc" };
                      }
                      return { mode: "column", col, dir: "desc" };
                    })}
                  >
                    <span>{col === "fiyat" ? "Fiyat" : col === "alinan" ? "Alınan" : col === "satilan" ? "Satılan" : "Stok"}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 7h13M3 12h9M3 17h5"/><path d="m17 4 3 3-3 3M20 7H7"/></svg>
                  </button>
                ))}
                <span></span>
              </div>
              <div className="product-list">
                {displayedProducts.length ? displayedProducts.map((p) => {
                  const isOpen = expandedProductId === p.id;
                  const isEditing = editingProductId === p.id;
                  const draft = productDrafts[p.id] || {};
                  const totalBought = getProductTotalBought(p.id);
                  const totalSold = getProductSoldQty(p.id);
                  const stock = getProductStock(p.id);
                  const isLowStock = stock === 0;
                  const latestPrice = getProductLatestPrice(p.id);
                  return (
                    <div key={p.id} className={`product-card ${isOpen ? "product-card--open" : ""}`}>
                      <button type="button" className="product-row" onClick={() => openProductDetail(p)}>
                        <div className="product-row-left">
                          <div className={`product-name product-name--${p.gender_category === "Erkek" ? "erkek" : p.gender_category === "Kadın" ? "kadin" : "unisex"}`}>{p.name}</div>
                        </div>
                        <div className="product-row-stats">
                          <div className="product-stat-chip">
                            <span className="product-stat-label">Fiyat</span>
                            <b className="product-stat-val">{latestPrice > 0 ? money(latestPrice) : "—"}</b>
                          </div>
                          {!isSellerRole && (
                            <>
                              <div className="product-stat-chip">
                                <span className="product-stat-label">Alınan</span>
                                <b className="product-stat-val">{totalBought}</b>
                              </div>
                              <div className="product-stat-chip">
                                <span className="product-stat-label">Satılan</span>
                                <b className="product-stat-val">{totalSold}</b>
                              </div>
                            </>
                          )}
                          <div className={`product-stat-chip ${isLowStock ? "product-stat-chip--low" : ""}`}>
                            <span className={`product-stat-label ${isLowStock ? "product-stat-label--stock" : ""}`}>Stok</span>
                            <b className={`product-stat-val ${isLowStock ? "product-stat-val--stock" : ""}`}>{stock}</b>
                          </div>
                        </div>
                        <span className="product-chevron">
                          {isOpen
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="m18 15-6-6-6 6"/></svg>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="m9 18 6-6-6-6"/></svg>}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="product-detail">
                          {isEditing ? (
                            <div className="product-edit-form">
                              <div className="product-edit-image-row">
                                <div className="product-img-box">
                                  {draft.image_url ? <img src={String(draft.image_url)} alt={p.name} className="product-img" /> : (
                                    <div className="product-img-placeholder">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                                      <span>Resim yok</span>
                                    </div>
                                  )}
                                </div>
                                <label className="product-img-change-btn">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                                  Resim Değiştir
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const b64 = String(reader.result || "");
                                      pendingImageRef.current[p.id] = b64;
                                      setProductDrafts((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] || {}), image_url: b64 } }));
                                    };
                                    reader.readAsDataURL(file);
                                  }} />
                                </label>
                              </div>
                              <div className="product-edit-fields">
                                <label className="field-label"><span>Ürün adı</span><input className="input" maxLength={50} value={String(draft.name ?? p.name)} onChange={(e) => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), name: e.target.value } })} /></label>
                                <label className="field-label"><span>Kategori</span><select className="input" value={String(draft.gender_category ?? p.gender_category)} onChange={(e) => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), gender_category: e.target.value as GenderCategory } })}><option>Kadın</option><option>Erkek</option><option>Unisex</option></select></label>
                                <label className="field-label">
                                  <span>Fiyat (₺) {batchItemsForProduct(p.id).some((i) => Number(i.sale_price) > 0) ? "— parti kaydı yoksa yedek olarak kullanılır" : ""}</span>
                                  <input
                                    className="input"
                                    type="number"
                                    min="0"
                                    placeholder="Örn: 1500"
                                    value={String(draft.manual_price ?? p.manual_price ?? "")}
                                    onChange={(e) => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), manual_price: e.target.value === "" ? null : Number(e.target.value) } })}
                                  />
                                </label>
                              </div>
                              {/* Parti satırları düzenleme */}
                              {batchItemsForProduct(p.id).length > 0 && (
                                <div>
                                  <div className="product-batch-title" style={{marginBottom:8}}>Parti / Stok Düzenleme</div>
                                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                    {batchItemsForProduct(p.id).map((item) => (
                                      <div key={item.id} style={{background:"#f8fafc",borderRadius:12,padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                                        <span style={{fontWeight:600,fontSize:"0.8rem",color:"#0f172a",minWidth:60}}>{batchMap.get(item.batch_id)?.name || "-"}</span>
                                        <label style={{display:"flex",flexDirection:"column",gap:2,fontSize:"0.7rem",color:"#64748b"}}>
                                          Adet
                                          <input className="input" style={{width:70}} type="number" min="0" defaultValue={item.bought} onBlur={(e) => { const v = Number(e.target.value); if (v !== item.bought) updateBatchItem(item.id, { bought: v }); }} />
                                        </label>
                                        <label style={{display:"flex",flexDirection:"column",gap:2,fontSize:"0.7rem",color:"#64748b"}}>
                                          Alış
                                          <input className="input" style={{width:80}} type="number" min="0" defaultValue={item.buy_price} onBlur={(e) => { const v = Number(e.target.value); if (v !== item.buy_price) updateBatchItem(item.id, { buy_price: v }); }} />
                                        </label>
                                        <label style={{display:"flex",flexDirection:"column",gap:2,fontSize:"0.7rem",color:"#64748b"}}>
                                          Satış
                                          <input className="input" style={{width:80}} type="number" min="0" defaultValue={item.sale_price} onBlur={(e) => { const v = Number(e.target.value); if (v !== item.sale_price) updateBatchItem(item.id, { sale_price: v }); }} />
                                        </label>
                                        <label style={{display:"flex",flexDirection:"column",gap:2,fontSize:"0.7rem",color:"#64748b"}}>
                                          Depo
                                          <select className="input" style={{width:110}} value={item.depo || "Belirsiz"} onChange={(e) => {
                                            const newDepo = e.target.value;
                                            const kalan = item.bought - getBatchSoldQtyForItem(item);
                                            if (kalan > 1) {
                                              setSplitModal({ item, newDepo });
                                              setSplitQty(String(kalan));
                                            } else {
                                              updateBatchItem(item.id, { depo: newDepo });
                                            }
                                          }}>
                                            <option value="Stok">Stok</option>
                                            <option value="Stok">Stok</option>
                                            <option value="Belirsiz">Belirsiz</option>
                                          </select>
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="product-action-row">
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => saveProductEdit(p.id)}>Kaydet</button>
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => cancelProductEdit(p.id)}>Vazgeç</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="product-info-row">
                                <div className="product-img-box">
                                  {p.image_url ? (
                                    <img
                                      src={p.image_url}
                                      alt={p.name}
                                      className="product-img"
                                      style={{cursor:"zoom-in"}}
                                      onClick={() => setLightboxImg(p.image_url)}
                                    />
                                  ) : (
                                    <div className="product-img-placeholder">
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                                      <span>Resim yok</span>
                                    </div>
                                  )}
                                </div>
                                {!isSellerRole && (
                                <div className="product-info-chips product-info-chips--sm">
                                  <div className="product-info-chip product-info-chip--sm">
                                    <div className="product-info-chip-label">T-Yüksel</div>
                                    <input
                                      className="input"
                                      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: "0.85rem", padding: "3px 6px" }}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={p.usd_fiyat_tyuksel ?? ""}
                                      placeholder="—"
                                      onBlur={async (e) => {
                                        const value = e.target.value === "" ? null : Number(e.target.value);
                                        if (value === (p.usd_fiyat_tyuksel ?? null)) return;
                                        const { error } = await supabase.from("products").update({ usd_fiyat_tyuksel: value }).eq("id", p.id);
                                        if (error) return showError(error);
                                        setProducts((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, usd_fiyat_tyuksel: value } : pr));
                                        await logAction("Ürün T-Yüksel USD fiyatı güncellendi", "products", p.name, diffOf({ usd_fiyat: p.usd_fiyat_tyuksel ?? null }, { usd_fiyat: value }));
                                      }}
                                    />
                                  </div>
                                  <div className="product-info-chip product-info-chip--sm">
                                    <div className="product-info-chip-label">T-Hasan</div>
                                    <input
                                      className="input"
                                      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: "0.85rem", padding: "3px 6px" }}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={p.usd_fiyat_thasan ?? ""}
                                      placeholder="—"
                                      onBlur={async (e) => {
                                        const value = e.target.value === "" ? null : Number(e.target.value);
                                        if (value === (p.usd_fiyat_thasan ?? null)) return;
                                        const { error } = await supabase.from("products").update({ usd_fiyat_thasan: value }).eq("id", p.id);
                                        if (error) return showError(error);
                                        setProducts((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, usd_fiyat_thasan: value } : pr));
                                        await logAction("Ürün T-Hasan USD fiyatı güncellendi", "products", p.name, diffOf({ usd_fiyat: p.usd_fiyat_thasan ?? null }, { usd_fiyat: value }));
                                      }}
                                    />
                                  </div>
                                  <div className="product-info-chip product-info-chip--sm">
                                    <div className="product-info-chip-label">T-Amir</div>
                                    <input
                                      className="input"
                                      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: "0.85rem", padding: "3px 6px" }}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={p.usd_fiyat_tamir ?? ""}
                                      placeholder="—"
                                      onBlur={async (e) => {
                                        const value = e.target.value === "" ? null : Number(e.target.value);
                                        if (value === (p.usd_fiyat_tamir ?? null)) return;
                                        const { error } = await supabase.from("products").update({ usd_fiyat_tamir: value }).eq("id", p.id);
                                        if (error) return showError(error);
                                        setProducts((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, usd_fiyat_tamir: value } : pr));
                                        await logAction("Ürün T-Amir USD fiyatı güncellendi", "products", p.name, diffOf({ usd_fiyat: p.usd_fiyat_tamir ?? null }, { usd_fiyat: value }));
                                      }}
                                    />
                                  </div>
                                </div>
                                )}
                              </div>
                              {!isSellerRole && (
                              <div className="product-batch-section">
                                <h4 className="product-batch-title">Parti Detayları</h4>
                                <div className="product-batch-table">
                                  <div className="product-batch-thead"><div>Parti</div><div>Alındı</div><div>Satıldı</div><div>Kalan</div><div>Alış</div><div>Satış</div><div>İşlem</div></div>
                                  {batchItemsForProduct(p.id).length ? batchItemsForProduct(p.id).map((item) => {
                                    const sold = getBatchSoldQtyForItem(item);
                                    const kalan = item.bought - sold;
                                    return (
                                      <div key={item.id}>
                                        <div className="product-batch-row">
                                          <div className="product-batch-cell product-batch-cell--name">{batchMap.get(item.batch_id)?.name || "-"}</div>
                                          <div className="product-batch-cell">{item.bought}</div>
                                          <div className="product-batch-cell">{sold}</div>
                                          <div className="product-batch-cell">{kalan}</div>
                                          <div className="product-batch-cell">{money(item.buy_price)}</div>
                                          <div className="product-batch-cell">{money(item.sale_price)}</div>
                                          <div className="product-batch-cell">
                                            {kalan > 0 && (
                                              <button
                                                type="button"
                                                style={{ fontSize: "0.65rem", padding: "3px 8px", borderRadius: 8, border: "1px solid #fca5a5", color: "#b91c1c", background: "#fef2f2" }}
                                                onClick={() => {
                                                  if (returnFormItemId === item.id) {
                                                    setReturnFormItemId(null);
                                                  } else {
                                                    setReturnFormItemId(item.id);
                                                    setReturnFormQty("");
                                                    setReturnFormSupplierId(batchMap.get(item.batch_id)?.supplier_id || "");
                                                    setReturnFormNote("");
                                                  }
                                                }}
                                              >
                                                İade Gönder
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        {returnFormItemId === item.id && (
                                          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 10, margin: "0 0 8px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                                            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.7rem", color: "#7f1d1d" }}>
                                              Adet (kalan: {kalan})
                                              <input className="input" style={{ width: 80 }} type="number" min="1" max={kalan} value={returnFormQty} onChange={(e) => setReturnFormQty(e.target.value)} />
                                            </label>
                                            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.7rem", color: "#7f1d1d" }}>
                                              Toptancı
                                              <select className="input" style={{ width: 160 }} value={returnFormSupplierId} onChange={(e) => setReturnFormSupplierId(e.target.value)}>
                                                <option value="">Belirtilmedi</option>
                                                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                              </select>
                                            </label>
                                            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.7rem", color: "#7f1d1d", flex: 1, minWidth: 140 }}>
                                              Not (opsiyonel)
                                              <input className="input" type="text" placeholder="Örn: kutu hasarlı" value={returnFormNote} onChange={(e) => setReturnFormNote(e.target.value)} />
                                            </label>
                                            <button type="button" className="btn-danger" style={{ fontSize: "0.75rem" }} onClick={() => submitSupplierReturn(item)}>Gönder</button>
                                            <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => setReturnFormItemId(null)}>Vazgeç</button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }) : <div className="product-batch-empty">Kayıt yok.</div>}
                                </div>
                              </div>
                              )}
                              {isSellerRole && (
                                <div className="product-batch-section">
                                  <h4 className="product-batch-title">Satışlarım</h4>
                                  <div className="product-batch-table">
                                    <div className="product-batch-thead" style={{gridTemplateColumns: "1fr 0.6fr 0.9fr 0.9fr"}}><div>Tarih / Cari</div><div>Adet</div><div>Tutar</div><div>Durum</div></div>
                                    {myActiveSales.filter((s) => s.product_id === p.id).length ? myActiveSales.filter((s) => s.product_id === p.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((sale) => (
                                      <div key={sale.id} className="product-batch-row" style={{gridTemplateColumns: "1fr 0.6fr 0.9fr 0.9fr"}}>
                                        <div className="product-batch-cell product-batch-cell--name" style={{lineHeight:1.3}}>
                                          {toTR(sale.created_at)}<br /><span style={{fontWeight:400, color:"#64748b"}}>{customerMap.get(sale.customer_id)?.name || "-"}</span>
                                        </div>
                                        <div className="product-batch-cell">{sale.qty}</div>
                                        <div className="product-batch-cell">{money(sale.total)}</div>
                                        <div className="product-batch-cell">{getSaleStatus(sale)}</div>
                                      </div>
                                    )) : <div className="product-batch-empty">Henüz bu üründen satışın yok.</div>}
                                  </div>
                                </div>
                              )}
                              {!isSellerRole && (
                              <div className="product-action-row">
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => startProductEdit(p)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  Düzenle
                                </button>
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => setSalesModalProductId(p.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                  Satış Detayı
                                </button>
                              </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }) : <p className="px-4 py-8 text-center text-sm text-slate-500">Kayıt yok.</p>}
              </div>
            </div>
          </div>
        )}

        {active === "gallery" && (() => {
          const groups: { label: string; gender: GenderCategory }[] = [
            { label: "Erkek", gender: "Erkek" },
            { label: "Kadın", gender: "Kadın" },
            { label: "Unisex", gender: "Unisex" },
          ];
          return (
            <div>
              <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:20}}>
                <button type="button" className="btn-secondary" style={{fontSize:"0.8rem", padding:"6px 12px"}} onClick={() => setActive("products")}>← Ürünlere Dön</button>
                <h2 style={{fontSize:"1.1rem", fontWeight:600}}>Toplu Ürün Resimleri</h2>
              </div>
              {groups.map((g) => {
                const groupProducts = sortedProducts
                  .filter((p) => !p.passive && p.gender_category === g.gender && p.image_url)
                  .map((p) => ({ product: p, stock: getProductStock(p.id), price: getProductLatestPrice(p.id) }))
                  .sort((a, b) => {
                    const aInStock = a.stock > 0 ? 1 : 0;
                    const bInStock = b.stock > 0 ? 1 : 0;
                    if (aInStock !== bInStock) return bInStock - aInStock;
                    return 0;
                  });
                if (!groupProducts.length) return null;
                return (
                  <div key={g.gender} style={{marginBottom: 32}}>
                    <div style={{fontSize:"0.75rem", fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, paddingBottom:6, borderBottom:"1.5px solid var(--color-border-tertiary)"}}>
                      {g.label} — {groupProducts.length} ürün
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
                      {groupProducts.map(({ product: p, stock, price }) => (
                        <div key={p.id} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                          <div style={{position:"relative", width:"100%", aspectRatio:"1/1", borderRadius:10, overflow:"hidden", background:"#f8fafc", border:"1px solid #e2e8f0", cursor:"pointer"}}
                            onClick={() => setLightboxImg(p.image_url)}>
                            <img src={p.image_url!} alt={p.name} style={{width:"100%", height:"100%", objectFit:"cover"}} />
                            <div style={{position:"absolute", top:6, left:6, background: stock > 0 ? "#dcfce7" : "#fee2e2", color: stock > 0 ? "#166534" : "#991b1b", fontSize:"0.6rem", fontWeight:700, padding:"2px 7px", borderRadius:6}}>
                              {stock > 0 ? "Stokta" : "Tükendi"}
                            </div>
                            <div style={{position:"absolute", top:6, right:6, background:"rgba(15,23,42,0.75)", color:"#ffffff", fontSize:"0.6rem", fontWeight:700, padding:"2px 7px", borderRadius:6}}>
                              {price ? Math.round(price).toLocaleString("tr-TR") : "-"}
                            </div>
                          </div>
                          <div style={{fontSize:"0.65rem", textAlign:"center", color:"var(--color-text-secondary)", lineHeight:1.2, wordBreak:"break-word", maxWidth:"100%"}}>
                            {p.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {active === "partiIslemleri" && (
          <div className="space-y-4">
            <div style={{ display: "flex", gap: 4, marginBottom: 4, borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#f8fafc", zIndex: 10, paddingTop: 4 }}>
              {([["giris","Yeni Parti / Ürün Girişi"],["maliyet","Maliyet Kaydı"],["rapor","Stok Raporu"]] as const).map(([key,label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPartiTab(key)}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "8px 14px",
                    fontSize: "0.85rem",
                    color: partiTab === key ? "#0f172a" : "#64748b",
                    fontWeight: partiTab === key ? 600 : 400,
                    borderBottom: partiTab === key ? "2px solid #2563eb" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {partiTab === "giris" && (
            <Card title="Parti Bazlı Ürün Girişi">
              <div style={{position: "relative"}}>
                {batchForm.productId && productMap.get(batchForm.productId)?.image_url && (
                  <img
                    src={productMap.get(batchForm.productId)!.image_url!}
                    alt={productMap.get(batchForm.productId)?.name || ""}
                    style={{position: "absolute", top: 0, right: 0, width: 200, height: 200, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0", zIndex: 5, background: "#fff"}}
                  />
                )}
              <p className="mb-5 text-slate-500">Önce kaynak ürün ve parti adı oluşturulur. Sonra partiye ürün, adet, alış fiyatı ve hedef satış fiyatı girilir.</p>
              <div className="mb-5 flex flex-wrap gap-3">
                <input className="input max-w-sm" placeholder="Yeni parti adı" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} />
                <select className="input max-w-xs" value={newBatchSupplierId} onChange={(e) => setNewBatchSupplierId(e.target.value)}>
                  <option value="">Toptancı seçin (opsiyonel)</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" className="btn-secondary" onClick={addBatchName}>Parti Adı Ekle</button>
              </div>

              <button type="button" className="btn-secondary" style={{width: "100%", marginBottom: 20, display:"flex", alignItems:"center", justifyContent:"center", gap:6}} onClick={() => setShowPartiDetayModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                Parti Detayları ({sortedBatches.length} parti)
              </button>

              <div className="grid gap-3 md:grid-cols-4">
                <select className="input" value={batchForm.batchId} onChange={(e) => setBatchForm({ ...batchForm, batchId: e.target.value })}>
                  <option value="">Parti seçin</option>
                  {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </select>
                <SearchableSelect
                  placeholder="Kaynak ürün ara..."
                  value={batchForm.productId}
                  onChange={(v) => setBatchForm({ ...batchForm, productId: v })}
                  options={sortedActiveProducts.map((p) => ({ value: p.id, label: p.name }))}
                />
                <select className="input" value={batchForm.variant} onChange={(e) => setBatchForm({ ...batchForm, variant: e.target.value as "ana" | "cep_boy" })}>
                  <option value="ana">Asıl Ürün</option>
                  <option value="cep_boy">Cep Boy</option>
                </select>
                <input className="input" type="number" placeholder="Toplam sipariş/adet" value={batchForm.bought} onChange={(e) => setBatchForm({ ...batchForm, bought: e.target.value })} />
                <input className="input" type="number" placeholder="Alış fiyatı (otomatik hesaplanır, isterseniz değiştirin)" value={batchForm.buyPrice} onChange={(e) => setBatchForm({ ...batchForm, buyPrice: e.target.value })} />
                <input className="input" type="number" placeholder="Hedef satış fiyatı" value={batchForm.salePrice} onChange={(e) => setBatchForm({ ...batchForm, salePrice: e.target.value })} />
                <button type="button" className="btn" onClick={addBatchProduct}>Partiye Ürün Ekle</button>
              </div>
              {batchForm.batchId && batchForm.productId && (() => {
                const batch = batchMap.get(batchForm.batchId);
                const product = productMap.get(batchForm.productId);
                const supplier = batch?.supplier_id ? supplierMap.get(batch.supplier_id) : null;
                if (!batch?.supplier_id) return <p className="mt-2 text-sm text-red-600">⚠️ Bu partiye henüz toptancı atanmamış. Önce "Maliyet Kaydı" sekmesinden bu partinin toptancısını ve USD kurunu girin.</p>;
                if (!batch?.usd_kuru) return <p className="mt-2 text-sm text-red-600">⚠️ Bu partiye henüz USD kuru girilmemiş. Önce "Maliyet Kaydı" sekmesinden USD kurunu girin.</p>;
                if (batchForm.variant === "cep_boy") {
                  return <p className="mt-2 text-sm text-emerald-600">✓ Cep Boy: ${CEP_BOY_USD_FIYAT} × {batch.usd_kuru} kur = {money(Math.round(CEP_BOY_USD_FIYAT * batch.usd_kuru * 100) / 100)} alış, {money(CEP_BOY_SATIS_FIYATI)} satış olarak varsayılan dolduruldu (istersen değiştirebilirsin).</p>;
                }
                const usdPrice = product ? getUsdPriceForBatch(product, batch) : null;
                if (usdPrice === null) return <p className="mt-2 text-sm text-red-600">⚠️ "{product?.name}" ürününde "{supplier?.name}" için USD fiyatı girilmemiş. Önce ürün kartından bu alanı doldurun.</p>;
                return <p className="mt-2 text-sm text-emerald-600">✓ {supplier?.name}: ${usdPrice} × {batch.usd_kuru} kur = {money(Math.round(usdPrice * batch.usd_kuru * 100) / 100)} olarak hesaplandı.</p>;
              })()}

              {!isSellerRole && (
                <div className="product-add-wrap" style={{marginTop: 16}}>
                  <details className="w-full">
                    <summary className="product-add-btn" style={{listStyle:"none", cursor:"pointer"}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Listede yok mu? Yeni Ürün Ekle
                    </summary>
                    <div className="product-add-form-panel">
                      <div className="grid gap-3 md:grid-cols-4">
                        <input className="input" maxLength={50} placeholder="Ürün adı (max 50)" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                        <select className="input" value={newProduct.genderCategory} onChange={(e) => setNewProduct({ ...newProduct, genderCategory: e.target.value as GenderCategory })}><option>Kadın</option><option>Erkek</option><option>Unisex</option></select>
                        <label className="input cursor-pointer text-center">Resim Seç<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setNewProduct((prev) => ({ ...prev, image: String(reader.result || "") })); reader.readAsDataURL(file); }} /></label>
                        <button type="button" className="btn" onClick={addProductDefinition}>Kaynak Ürün Ekle</button>
                      </div>
                      <p className="mt-3 mb-1 text-xs text-slate-500">Toptancı $ fiyatları (opsiyonel - şimdi girersen sonra ürün kartına gitmene gerek kalmaz):</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <input className="input" type="number" min="0" step="0.01" placeholder="T-Yüksel ($)" value={newProduct.usdTyuksel} onChange={(e) => setNewProduct({ ...newProduct, usdTyuksel: e.target.value })} />
                        <input className="input" type="number" min="0" step="0.01" placeholder="T-Hasan ($)" value={newProduct.usdThasan} onChange={(e) => setNewProduct({ ...newProduct, usdThasan: e.target.value })} />
                        <input className="input" type="number" min="0" step="0.01" placeholder="T-Amir ($)" value={newProduct.usdTamir} onChange={(e) => setNewProduct({ ...newProduct, usdTamir: e.target.value })} />
                      </div>
                      {newProduct.image ? <img src={newProduct.image} alt="Önizleme" className="mt-4 h-24 w-24 rounded-xl border object-cover" /> : null}
                    </div>
                  </details>
                </div>
              )}
              </div>
            </Card>
            )}

            {partiTab === "maliyet" && (
            <Card title="Parti Maliyet Kaydı">
              <p className="mb-4 text-sm text-slate-500">Her parti satırındaki değerleri doldurun ve "Kaydet" butonuna basın. Yeni parti eklendiğinde otomatik alt satıra eklenir.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left font-semibold border border-slate-200">Parti</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">İlk Parti Açılışı</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">İlk Mal Girişi</th>
                      <th className="p-3 text-right font-semibold border border-slate-200" style={{minWidth: 120}}>USD Kuru</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Birim Ek Maliyet</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Veli (şahsi)</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Aslı (şahsi)</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Mihri (şahsi)</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Kasa'dan</th>
                      <th className="p-3 text-right font-semibold border border-slate-200 bg-slate-200">Toptancı</th>
                      <th className="p-3 text-right font-semibold border border-slate-200" title="Kasa + şahsi cüzdan katkısı dahil toplam">Kargo</th>
                      <th className="p-3 text-right font-semibold border border-slate-200" title="Kasa + şahsi cüzdan katkısı dahil toplam">Diğer</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">Açıklama</th>
                      <th className="p-3 text-right font-semibold border border-slate-200 bg-slate-200">Toplam Maliyet</th>
                      <th className="p-3 border border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBatches.map((batch) => {
                      const row = costInputs[batch.id] || { veli: "0", asli: "0", mihrimah: "0", kasa: "0", kargo: "0", diger: "0", aciklama: "" };
                      const setRow = (field: string, val: string) => setCostInputs((prev) => ({ ...prev, [batch.id]: { ...(prev[batch.id] || { veli:"0", asli:"0", mihrimah:"0", kasa:"0", kargo:"0", diger:"0", aciklama:"" }), [field]: val } }));
                      const existing = batchCosts.find((c) => c.batch_id === batch.id);
                      // Kargo/Diğer TOPLAM = kasa'dan ödenen (row.kargo/row.diger) + şahsi cüzdandan ödenen
                      // (existing.kargo_veli vb, costInputs'ta yok çünkü elle girilmiyor, sadece Ödemeler'den gelir).
                      const kargoToplam = getKargoToplam({ ...existing, kargo: Number(row.kargo) || 0 } as BatchCost);
                      const digerToplam = getDigerToplam({ ...existing, diger: Number(row.diger) || 0 } as BatchCost);
                      // Toptancı = Veli(şahsi) + Aslı(şahsi) + Mihri(şahsi) + Kasa payı (Ödemeler'den gelir)
                      const toptanci = (Number(row.veli)||0) + (Number(row.asli)||0) + (Number(row.mihrimah)||0) + (Number(row.kasa)||0);
                      // Kasa'dan = ortak kasadan çıkan HER ŞEY (şahsi katkılar hariç): Kasa payı + Kargo + Diğer (sadece kasa kısmı)
                      const kasaDan = (Number(row.kasa)||0) + (Number(row.kargo)||0) + (Number(row.diger)||0);
                      // Toplam Maliyet = Toptancı + Kargo TOPLAM + Diğer TOPLAM (yani partiye harcanan her şey, kaynağı ne olursa olsun)
                      const total = toptanci + kargoToplam + digerToplam;
                      const isDirty = !existing
                        ? (Number(row.veli)||0) !== 0 || (Number(row.asli)||0) !== 0 || (Number(row.mihrimah)||0) !== 0 || (row.aciklama || "") !== ""
                        : (Number(row.veli)||0) !== Number(existing.veli||0) || (Number(row.asli)||0) !== Number(existing.asli||0) || (Number(row.mihrimah)||0) !== Number(existing.mihrimah||0) || (row.aciklama || "") !== (existing.aciklama || "");
                      const ilkMalGirisiTarihi = batchItems
                        .filter((i) => i.batch_id === batch.id)
                        .reduce((min: string | null, i) => (!min || new Date(i.created_at) < new Date(min) ? i.created_at : min), null as string | null);
                      const saveCost = async () => {
                        const data = { batch_id: batch.id, veli: Number(row.veli)||0, asli: Number(row.asli)||0, mihrimah: Number(row.mihrimah)||0, kasa: Number(row.kasa)||0, kargo: Number(row.kargo)||0, diger: Number(row.diger)||0, aciklama: row.aciklama || "" };
                        let saveError = null;
                        if (existing) {
                          const { error } = await supabase.from("batch_costs").update(data).eq("id", existing.id);
                          saveError = error;
                          if (!error) setBatchCosts((prev) => prev.map((c) => c.batch_id === batch.id ? { ...c, ...data, id: existing.id } : c));
                        } else {
                          const { data: inserted, error } = await supabase.from("batch_costs").insert(data).select();
                          saveError = error;
                          if (!error && inserted && inserted[0]) setBatchCosts((prev) => [...prev, inserted[0] as BatchCost]);
                        }
                        if (saveError) { showError(saveError); return; }
                        setMessage(`${batch.name} maliyeti kaydedildi.`);
                      };
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold border border-slate-200">{batch.name}</td>
                          <td className="p-3 border border-slate-200 text-slate-600">{batch.created_at ? new Date(batch.created_at).toLocaleDateString("tr-TR") : "-"}</td>
                          <td className="p-3 border border-slate-200 text-slate-600">{ilkMalGirisiTarihi ? new Date(ilkMalGirisiTarihi).toLocaleDateString("tr-TR") : "-"}</td>
                          <td className="p-1 border border-slate-200" style={{minWidth: 120}}>
                            <input
                              className="w-full text-right p-2 bg-transparent hover:bg-blue-50 focus:bg-white focus:outline-none rounded"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={batch.usd_kuru ?? ""}
                              placeholder="—"
                              onBlur={async (e) => {
                                const value = e.target.value === "" ? null : Number(e.target.value);
                                const { error } = await supabase.from("batches").update({ usd_kuru: value }).eq("id", batch.id);
                                if (error) return showError(error);
                                setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, usd_kuru: value } : b));
                                await logAction("Parti USD kuru güncellendi", "batches", batch.name, diffOf({ usd_kuru: batch.usd_kuru ?? null }, { usd_kuru: value }));
                              }}
                            />
                          </td>
                          <td className="p-2 border border-slate-200 text-right text-slate-600">
                            {getEkMaliyet(batch.id) > 0 ? `${getEkMaliyet(batch.id).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : "-"}
                          </td>
                          {(["veli","asli","mihrimah"] as const).map((f) => (
                            <td key={f} className="p-1 border border-slate-200">
                              <input
                                className="w-full text-right p-2 bg-transparent hover:bg-blue-50 focus:bg-white focus:outline-none rounded"
                                type="number"
                                min="0"
                                value={row[f] === "0" ? "" : row[f]}
                                placeholder="0"
                                onChange={(e) => setRow(f, e.target.value || "0")}
                              />
                            </td>
                          ))}
                          <td className="p-3 text-right border border-slate-200 text-slate-600" title="Ödemeler ekranından otomatik dolar">
                            {kasaDan > 0 ? kasaDan.toLocaleString("tr-TR") : "-"}
                          </td>
                          <td className="p-3 text-right font-semibold border border-slate-200 bg-slate-50">
                            {total !== 0 ? toptanci.toLocaleString("tr-TR") : "-"}
                          </td>
                          <td className="p-3 text-right border border-slate-200 text-slate-600" title="Kasa ve şahsi cüzdan katkısı dahil toplam - Ödemeler ekranından otomatik dolar">
                            {kargoToplam > 0 ? kargoToplam.toLocaleString("tr-TR") : "-"}
                          </td>
                          <td className="p-3 text-right border border-slate-200 text-slate-600" title="Kasa ve şahsi cüzdan katkısı dahil toplam - Ödemeler ekranından otomatik dolar">
                            {digerToplam > 0 ? digerToplam.toLocaleString("tr-TR") : "-"}
                          </td>
                          <td className="p-1 border border-slate-200">
                            <input
                              className="w-full p-2 bg-transparent hover:bg-blue-50 focus:bg-white focus:outline-none rounded text-sm"
                              type="text"
                              value={row.aciklama || ""}
                              placeholder="—"
                              onChange={(e) => setRow("aciklama", e.target.value)}
                            />
                          </td>
                          <td className="p-3 text-right font-bold border border-slate-200 bg-slate-50">{total > 0 ? total.toLocaleString("tr-TR") : "-"}</td>
                          <td className="p-2 border border-slate-200">
                            {isDirty ? (
                              <button type="button" className="btn text-xs px-3 py-1" onClick={saveCost}>Kaydet</button>
                            ) : (
                              <span
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "#94a3b8" }}
                                title="Kaydedildi, değişiklik yok"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><path d="M20 6 9 17l-5-5"/></svg>
                                Kayıtlı
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    {sortedBatches.length > 0 && (
                      <tr className="bg-slate-200 font-bold">
                        <td className="p-3 border border-slate-300">Toplam</td>
                        <td className="p-3 border border-slate-300"></td>
                        <td className="p-3 border border-slate-300"></td>
                        <td className="p-3 border border-slate-300"></td>
                        <td className="p-3 border border-slate-300"></td>
                        {(["veli","asli","mihrimah"] as const).map((f) => (
                          <td key={f} className="p-3 text-right border border-slate-300">
                            {batchCosts.reduce((s,c) => s + Number(c[f]||0), 0).toLocaleString("tr-TR")}
                          </td>
                        ))}
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + Number(c.kasa||0) + Number(c.kargo||0) + Number(c.diger||0), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + Number(c.veli||0) + Number(c.asli||0) + Number(c.mihrimah||0) + Number(c.kasa||0), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + getKargoToplam(c), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + getDigerToplam(c), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="p-3 border border-slate-300"></td>
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + Number(c.veli||0) + Number(c.asli||0) + Number(c.mihrimah||0) + Number(c.kasa||0) + getKargoToplam(c) + getDigerToplam(c), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="border border-slate-300"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            )}

            {partiTab === "rapor" && (
            <Card title="Parti Bazlı Ürün / Stok Raporu">
              <div className="mb-5 flex items-center gap-2">
                <select className="input flex-1" value={batchReportFilter} onChange={(e) => setBatchReportFilter(e.target.value)}>
                  <option value="">Seçim yapın</option>
                  <option value="Tümü">Tüm Partiler</option>
                  {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </select>

              {batchReportFilter && (() => {
                const filtered = batchItems.filter((item) => batchReportFilter === "Tümü" || item.batch_id === batchReportFilter);
                const totalAlinan = filtered.reduce((s, item) => s + item.bought, 0);
                const totalSatilan = filtered.reduce((s, item) => s + getBatchSoldQtyForItem(item), 0);
                const totalKalan = totalAlinan - totalSatilan;
                return (
                  <div className="rounded-xl bg-slate-100 flex divide-x divide-slate-300 flex-shrink-0">
                    <div className="px-3 py-2 text-center">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Toplam<br/>Alınan</div>
                      <div className="text-lg font-bold text-slate-900">{totalAlinan}</div>
                    </div>
                    <div className="px-3 py-2 text-center">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Toplam<br/>Satılan</div>
                      <div className="text-lg font-bold text-slate-900">{totalSatilan}</div>
                    </div>
                    <div className="px-3 py-2 text-center">
                      <div className="text-xs text-slate-500 font-semibold mb-1">Toplam<br/>Kalan</div>
                      <div className="text-lg font-bold text-slate-900">{totalKalan}</div>
                    </div>
                  </div>
                );
              })()}
              </div>

              {!batchReportFilter && (
                <p className="text-sm text-slate-500" style={{padding: "24px 0", textAlign: "center"}}>Görüntülemek için yukarıdan bir parti seçin.</p>
              )}

              {batchReportFilter && (() => {
                const handleBRSort = (col: string) => setBatchReportSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
                const brArr = (col: string) => batchReportSort.col === col ? (batchReportSort.dir === "asc" ? " ▲" : " ▼") : " ↕";
                const brTh = (col: string, label: string) => (
                  <button type="button" onClick={() => handleBRSort(col)} style={{fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0,whiteSpace:"nowrap"}}>{label}{brArr(col)}</button>
                );
                const soldOf = (item?: BatchItem) => item ? getBatchSoldQtyForItem(item) : 0;
                const kalanOf = (item?: BatchItem) => item ? item.bought - getBatchSoldQtyForItem(item) : 0;

                const filteredItems = batchItems.filter((item) => batchReportFilter === "Tümü" || item.batch_id === batchReportFilter);

                // Asıl Ürün ve Cep Boy satırları, aynı parti+ürün için TEK satırda, ayrı kolon
                // gruplarında gösterilsin diye (batch_id, product_id) bazında gruplanır.
                type BRGroup = { batch_id: string; product_id: string; ana?: BatchItem; cep?: BatchItem };
                const groupsMap = new Map<string, BRGroup>();
                for (const item of filteredItems) {
                  const key = `${item.batch_id}::${item.product_id}`;
                  const g = groupsMap.get(key) || { batch_id: item.batch_id, product_id: item.product_id };
                  if ((item.variant || "ana") === "cep_boy") g.cep = item; else g.ana = item;
                  groupsMap.set(key, g);
                }
                const sortedGroups = [...groupsMap.values()].sort((a, b) => {
                  let av: string|number = "", bv: string|number = "";
                  if (batchReportSort.col === "batch") { av = batchMap.get(a.batch_id)?.name||""; bv = batchMap.get(b.batch_id)?.name||""; }
                  else if (batchReportSort.col === "product") { av = productMap.get(a.product_id)?.name||""; bv = productMap.get(b.product_id)?.name||""; }
                  else if (batchReportSort.col === "asil_bought") { av = a.ana?.bought||0; bv = b.ana?.bought||0; }
                  else if (batchReportSort.col === "asil_sold") { av = soldOf(a.ana); bv = soldOf(b.ana); }
                  else if (batchReportSort.col === "asil_kalan") { av = kalanOf(a.ana); bv = kalanOf(b.ana); }
                  else if (batchReportSort.col === "asil_buy") { av = a.ana?.buy_price||0; bv = b.ana?.buy_price||0; }
                  else if (batchReportSort.col === "asil_sale") { av = a.ana?.sale_price||0; bv = b.ana?.sale_price||0; }
                  else if (batchReportSort.col === "cep_bought") { av = a.cep?.bought||0; bv = b.cep?.bought||0; }
                  else if (batchReportSort.col === "cep_sold") { av = soldOf(a.cep); bv = soldOf(b.cep); }
                  else if (batchReportSort.col === "cep_kalan") { av = kalanOf(a.cep); bv = kalanOf(b.cep); }
                  else if (batchReportSort.col === "cep_buy") { av = a.cep?.buy_price||0; bv = b.cep?.buy_price||0; }
                  else if (batchReportSort.col === "cep_sale") { av = a.cep?.sale_price||0; bv = b.cep?.sale_price||0; }
                  const cmp = typeof av === "number" ? av-(bv as number) : String(av).localeCompare(String(bv),"tr",{numeric:true});
                  return batchReportSort.dir === "asc" ? cmp : -cmp;
                });

                const renderVariantCells = (item: BatchItem | undefined) => {
                  if (!item) return [<span key="none" className="text-slate-400">-</span>, "-", "-", "-", "-", ""];
                  const key = item.id;
                  return [
                    editingBatchItemId === key ? <input className="input w-20" type="number" value={item.bought} onChange={(e) => updateBatchItem(item.id, { bought: Number(e.target.value || 0) })} /> : item.bought,
                    soldOf(item),
                    kalanOf(item),
                    editingBatchItemId === key ? <input className="input w-20" type="number" value={item.buy_price} onChange={(e) => updateBatchItem(item.id, { buy_price: Number(e.target.value || 0) })} /> : money(item.buy_price),
                    editingBatchItemId === key ? <input className="input w-20" type="number" value={item.sale_price} onChange={(e) => updateBatchItem(item.id, { sale_price: Number(e.target.value || 0) })} /> : money(item.sale_price),
                    <div key={key} className="flex gap-1">
                      <button type="button" className="btn-secondary" style={{padding:"3px 8px", fontSize:"0.75rem"}} onClick={() => setEditingBatchItemId(editingBatchItemId === key ? null : key)}>Değiştir</button>
                      <button type="button" className="btn-danger" style={{padding:"3px 8px", fontSize:"0.75rem"}} onClick={() => deleteBatchItem(item)}>Sil</button>
                    </div>,
                  ];
                };

                return (
                  <Table
                    headers={[
                      brTh("batch","Parti"), brTh("product","Ürün"),
                      brTh("asil_bought","Asıl Alınan"), brTh("asil_sold","Asıl Satılan"), brTh("asil_kalan","Asıl Kalan"), brTh("asil_buy","Asıl Alış"), brTh("asil_sale","Asıl Satış"), "Asıl İşlem",
                      brTh("cep_bought","Cep Alınan"), brTh("cep_sold","Cep Satılan"), brTh("cep_kalan","Cep Kalan"), brTh("cep_buy","Cep Alış"), brTh("cep_sale","Cep Satış"), "Cep İşlem",
                    ]}
                    rows={[
                      ...sortedGroups.map((g) => {
                        const p = productMap.get(g.product_id);
                        return [
                          batchMap.get(g.batch_id)?.name || "-",
                          p?.name || "-",
                          ...renderVariantCells(g.ana),
                          ...renderVariantCells(g.cep),
                        ];
                      }),
                      [
                        <strong key="toplam-label">Toplam</strong>, "",
                        <strong key="t-ana-bought">{sortedGroups.reduce((s, g) => s + (g.ana?.bought||0), 0)}</strong>,
                        <strong key="t-ana-sold">{sortedGroups.reduce((s, g) => s + soldOf(g.ana), 0)}</strong>,
                        <strong key="t-ana-kalan">{sortedGroups.reduce((s, g) => s + kalanOf(g.ana), 0)}</strong>,
                        "", "", "",
                        <strong key="t-cep-bought">{sortedGroups.reduce((s, g) => s + (g.cep?.bought||0), 0)}</strong>,
                        <strong key="t-cep-sold">{sortedGroups.reduce((s, g) => s + soldOf(g.cep), 0)}</strong>,
                        <strong key="t-cep-kalan">{sortedGroups.reduce((s, g) => s + kalanOf(g.cep), 0)}</strong>,
                        "", "",
                      ],
                    ]}
                  />
                );
              })()}
            </Card>
            )}

            {showPartiDetayModal && (
              <div
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                onClick={() => setShowPartiDetayModal(false)}
              >
                <div
                  style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 640, maxHeight: "80vh", overflowY: "auto" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Parti Detayları</h2>
                    <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setShowPartiDetayModal(false)}>Kapat</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sortedBatches.map((batch) => (
                      <div key={batch.id} className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                        <span>{batch.name}</span>
                        <select
                          className="input"
                          style={{ fontSize: "0.75rem", padding: "3px 6px", width: 140 }}
                          value={batch.supplier_id || ""}
                          onChange={(e) => updateBatchSupplier(batch.id, e.target.value)}
                        >
                          <option value="">Toptancı yok</option>
                          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button type="button" className="text-red-600" onClick={() => deleteBatchName(batch.id)}>Sil</button>
                        <button type="button" className="underline" onClick={() => {
                          const next = prompt("Yeni parti adı", batch.name);
                          if (next) renameBatchName(batch.id, next);
                        }}>Değiştir</button>
                      </div>
                    ))}
                    {sortedBatches.length === 0 && <span className="text-sm text-slate-500">Henüz parti yok.</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {active === "returns" && (
          <div className="space-y-4">
            <Card title="Toptancılar">
              <div className="mb-4 flex flex-wrap gap-3">
                <input className="input max-w-sm" placeholder="Toptancı adı" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
                <button type="button" className="btn-secondary" onClick={addSupplier}>Toptancı Ekle</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suppliers.length ? suppliers.map((s) => (
                  <span key={s.id} className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">{s.name}</span>
                )) : <span className="text-sm text-slate-500">Henüz toptancı eklenmedi.</span>}
              </div>
            </Card>

            <Card title="Bekleyen İadeler">
              <p className="mb-4 text-sm text-slate-500">Toptancıya gönderilmiş, henüz "ürünle" ya da "parayla" kapatılmamış iadeler. Gönderildiği anda ilgili adet stoktan zaten düşülmüştür.</p>
              {(() => {
                const pending = supplierReturns.filter((r) => r.resolution_type === "bekliyor");
                if (!pending.length) return <p className="text-sm text-slate-500">Bekleyen iade yok.</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left font-semibold border border-slate-200">Tarih</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Ürün</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Parti</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Toptancı</th>
                          <th className="p-2 text-right font-semibold border border-slate-200">Adet</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Not</th>
                          <th className="p-2 border border-slate-200">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pending.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2 border border-slate-200">{new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
                            <td className="p-2 border border-slate-200 font-semibold">{productMap.get(r.product_id)?.name || "-"}</td>
                            <td className="p-2 border border-slate-200">{batchMap.get(r.batch_id)?.name || "-"}</td>
                            <td className="p-2 border border-slate-200">{r.supplier_id ? (supplierMap.get(r.supplier_id)?.name || "-") : "Belirtilmedi"}</td>
                            <td className="p-2 text-right border border-slate-200">{r.qty}</td>
                            <td className="p-2 border border-slate-200 text-xs text-slate-500">{r.note || "—"}</td>
                            <td className="p-2 border border-slate-200">
                              {resolvingReturnId === r.id ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <input className="input" style={{ width: 100 }} type="number" placeholder="Tutar ₺" value={resolveMoneyAmount} onChange={(e) => setResolveMoneyAmount(e.target.value)} />
                                  <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={() => resolveReturnAsMoney(r.id)}>Kaydet</button>
                                  <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => { setResolvingReturnId(null); setResolveMoneyAmount(""); }}>Vazgeç</button>
                                </div>
                              ) : resolvingDifferentId === r.id ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <input className="input" style={{ width: 220 }} type="text" placeholder="Yerine ne geldi? (örn: 9.parti X ürünü, manuel eklendi)" value={resolveDifferentProductNote} onChange={(e) => setResolveDifferentProductNote(e.target.value)} />
                                  <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={() => resolveReturnAsDifferentProduct(r.id)}>Kaydet</button>
                                  <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => { setResolvingDifferentId(null); setResolveDifferentProductNote(""); }}>Vazgeç</button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => resolveReturnAsProduct(r)}>Ürünle Kapat (Aynı Ürün)</button>
                                  <button type="button" className="btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => { setResolvingDifferentId(r.id); setResolveDifferentProductNote(""); }}>Farklı Ürün Geldi</button>
                                  <button type="button" className="btn" style={{ fontSize: "0.75rem" }} onClick={() => { setResolvingReturnId(r.id); setResolveMoneyAmount(""); }}>Parayla Kapat</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>

            <Card title="Geçmiş İadeler">
              {(() => {
                const resolved = supplierReturns.filter((r) => r.resolution_type !== "bekliyor");
                if (!resolved.length) return <p className="text-sm text-slate-500">Henüz kapatılmış iade yok.</p>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-2 text-left font-semibold border border-slate-200">Gönderim</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Kapanış</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Ürün</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Parti</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Toptancı</th>
                          <th className="p-2 text-right font-semibold border border-slate-200">Adet</th>
                          <th className="p-2 text-left font-semibold border border-slate-200">Sonuç</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolved.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2 border border-slate-200">{new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
                            <td className="p-2 border border-slate-200">{r.resolved_at ? new Date(r.resolved_at).toLocaleDateString("tr-TR") : "-"}</td>
                            <td className="p-2 border border-slate-200 font-semibold">{productMap.get(r.product_id)?.name || "-"}</td>
                            <td className="p-2 border border-slate-200">{batchMap.get(r.batch_id)?.name || "-"}</td>
                            <td className="p-2 border border-slate-200">{r.supplier_id ? (supplierMap.get(r.supplier_id)?.name || "-") : "Belirtilmedi"}</td>
                            <td className="p-2 text-right border border-slate-200">{r.qty}</td>
                            <td className="p-2 border border-slate-200">
                              {r.resolution_type === "urun" ? (
                                <span className="text-emerald-700 font-semibold">Ürünle kapatıldı (eski maliyetiyle geri eklendi)</span>
                              ) : r.resolution_type === "farkli_urun" ? (
                                <span className="text-amber-700 font-semibold">Yerine farklı ürün geldi: {r.note || "—"}</span>
                              ) : (
                                <span className="text-blue-700 font-semibold">Parayla kapatıldı: {money(r.refund_amount || 0)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {active === "payments" && !isSellerRole && (
          <div className="space-y-4">
            <Card title="Kasa Havuzları">
              <div className="grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-5">
                {paraSahibiSecenekleri.map((kisi) => (
                  <div key={kisi} className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">{kisi}</div>
                    <b>{money(kasaHavuzlari.get(kisi)?.toplam || 0)}</b>
                  </div>
                ))}
                <div className="rounded-lg bg-amber-50 p-3">
                  <div className="text-xs text-slate-500">Devir Bakiyesi</div>
                  <b>{money(openPeriodForOdeme?.devir_bakiyesi || 0)}</b>
                </div>
              </div>
              <div className="mt-3 pt-3" style={{borderTop:"1px solid #e2e8f0"}}>
                <span className="text-sm font-semibold text-slate-700">
                  Kasa Havuzları - Toplam = {money(toplamKasaHavuzu)}
                </span>
              </div>
            </Card>

            <Card title="Yeni Ödeme">
              <div className="grid gap-3 md:grid-cols-2 mb-3">
                <div className="field-label">
                  Ne için
                  <select
                    className="input"
                    value={odemeTip}
                    onChange={(e) => { const v = e.target.value as "toptanci" | "kargo" | "diger" | "kar_payi"; setOdemeTip(v); setOdemeSupplierId(""); setOdemeBatchId(""); setOdemeKarPayiAlici(""); setOdemeTutar(""); if (v === "kar_payi") setOdemeKimden(odemeKimden.filter((k) => !isSahsiKaynak(k))); }}
                  >
                    <option value="toptanci">Toptancıya öde (parti bazlı)</option>
                    <option value="kargo">Kargo öde (parti bazlı)</option>
                    <option value="diger">Diğer masraf öde (parti bazlı)</option>
                    <option value="kar_payi">Kâr payı öde (ortak / satıcı)</option>
                  </select>
                </div>
                {odemeTip === "toptanci" && (
                  <div className="field-label">
                    Toptancı
                    <select
                      className="input"
                      value={odemeSupplierId}
                      onChange={(e) => { setOdemeSupplierId(e.target.value); setOdemeBatchId(""); }}
                    >
                      <option value="">Seç...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — kalan borç {money(getToptanciKalanBorc(s.id))}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {odemeTip === "kar_payi" && (
                  <div className="field-label">
                    Kime
                    <select
                      className="input"
                      value={odemeKarPayiAlici}
                      onChange={(e) => setOdemeKarPayiAlici(e.target.value)}
                    >
                      <option value="">Seç...</option>
                      <option value="Aslı">Aslı (ortak)</option>
                      <option value="Mihrimah">Mihrimah (ortak)</option>
                      {sellerAccounts.map((s) => (
                        <option key={s.id} value={s.name}>{s.name} (satıcı)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {odemeTip !== "kar_payi" && (odemeTip !== "toptanci" || odemeSupplierId) && (
                <div className="field-label mb-3" style={{maxWidth: 300}}>
                  Hangi parti için
                  <select
                    className="input"
                    value={odemeBatchId}
                    onChange={(e) => setOdemeBatchId(e.target.value)}
                  >
                    <option value="">Seç...</option>
                    {(odemeTip === "toptanci" ? sortedBatches.filter((b) => b.supplier_id === odemeSupplierId) : sortedBatches).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {odemeTip === "toptanci" && sortedBatches.filter((b) => b.supplier_id === odemeSupplierId).length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">Bu toptancıya bağlı parti bulunamadı.</p>
                  )}
                </div>
              )}

              <div className="field-label mb-3" style={{maxWidth: 200}}>
                Tutar
                <input className="input" type="number" min="0" value={odemeTutar} onChange={(e) => setOdemeTutar(e.target.value)} placeholder="0" />
              </div>

              <div className="flex flex-wrap items-end gap-2 mb-2">
                <div className="field-label" style={{minWidth: 220}}>
                  Kaynak ekle
                  <select className="input" value={odemeKimdenSecim} onChange={(e) => setOdemeKimdenSecim(e.target.value)}>
                    <option value="">Seç...</option>
                    {paraSahibiSecenekleri.filter((k) => !odemeKimden.includes(k)).map((k) => (
                      <option key={k} value={k}>{k} — kullanılabilir {money(getKaynakBakiye(k))}</option>
                    ))}
                    {odemeTip !== "kar_payi" && SAHSI_CUZDAN_SAHIPLERI.filter((s) => !odemeKimden.includes(s.key)).map((s) => (
                      <option key={s.key} value={s.key}>{s.kisi} (Şahsi) — sınırsız</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { if (odemeKimdenSecim) { setOdemeKimden([...odemeKimden, odemeKimdenSecim]); setOdemeKimdenSecim(""); } }}
                >
                  Kaynak Ekle
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {odemeKimden.map((k) => (
                  <span key={k} className="rounded px-3 py-1 text-sm" style={{background: isSahsiKaynak(k) ? "#fef3c7" : "#e0eafc", color: isSahsiKaynak(k) ? "#92400e" : "#1e40af", display:"inline-flex", alignItems:"center", gap:6}}>
                    {k === "__devir__" ? "Devir Bakiyesi" : isSahsiKaynak(k) ? `${sahsiCuzdanByKey.get(k)!.kisi} (Şahsi)` : k}
                    <button type="button" onClick={() => setOdemeKimden(odemeKimden.filter((x) => x !== k))} style={{border:"none", background:"none", cursor:"pointer", color: isSahsiKaynak(k) ? "#92400e" : "#1e40af"}}>✕</button>
                  </span>
                ))}
                {odemeKimden.length === 0 && <span className="text-sm text-slate-400">Henüz kaynak eklenmedi</span>}
              </div>

              {odemeKimden.length > 0 && odemeHedefTutar > 0 && (
                <p className="text-sm mb-3" style={{color: odemeEksik > 0.5 ? "#dc2626" : "#16a34a"}}>
                  {odemeEksik > 0.5
                    ? `Seçilen kaynaklar yetmiyor: ${money(odemeEksik)} eksik, başka kaynak ekle.`
                    : "Tüm tutar karşılandı."}
                </p>
              )}

              <button type="button" className="btn" disabled={odemeEksik > 0.5 || odemeHedefTutar <= 0 || isLoading("submitOdeme")} onClick={() => withLoading("submitOdeme", submitOdeme)}>
                {isLoading("submitOdeme") ? "Kaydediliyor..." : "Onayla ve Kaydet"}
              </button>
            </Card>

            <Card title="Şahsi Ödemeyi Kasadan Karşıla">
              <p className="text-sm text-slate-500 mb-3">
                Daha önce bir ortağın kendi cebinden (şahsi) yaptığı ödemeleri, kasa havuzunda yeterli bakiye oluşunca buradan
                (kısmen ya da tamamen) kasa kaynağına devredebilirsin.
              </p>
              <Table
                headers={["#", "Tarih", "Kime / Ne için", "Kişi", "Kalan Şahsi Tutar", ""]}
                rows={sahsiOdenmemisKalanlar.map(({ kaynak, odeme }) => {
                  const entityName = odeme!.tip === "toptanci"
                    ? `${supplierMap.get(odeme!.supplier_id || "")?.name || ""} — ${batchMap.get(odeme!.batch_id || "")?.name || ""}`
                    : (batchMap.get(odeme!.batch_id || "")?.name || "-");
                  return [
                    odeme!.sira_no,
                    toTR(odeme!.created_at, true),
                    entityName,
                    kaynak.para_sahibi,
                    money(kaynak.kullanilan_tutar),
                    <button
                      key="btn"
                      type="button"
                      className="btn-secondary"
                      style={{fontSize:"0.75rem", padding:"3px 10px"}}
                      onClick={() => {
                        setSahsiKarsilamaSecili(kaynak.id);
                        setSahsiKarsilamaTutar(String(Math.round(Number(kaynak.kullanilan_tutar))));
                        setSahsiKarsilamaKimden([]);
                      }}
                    >
                      Karşıla
                    </button>,
                  ];
                })}
              />
              {sahsiOdenmemisKalanlar.length === 0 && <p className="mt-2 text-sm text-slate-500">Karşılanmayı bekleyen şahsi ödeme yok.</p>}

              {sahsiKarsilamaSecili && (() => {
                const row = sahsiOdenmemisKalanlar.find((r) => r.kaynak.id === sahsiKarsilamaSecili);
                if (!row || !row.odeme) return null;
                return (
                  <div className="mt-4 pt-4" style={{borderTop: "1px solid #e2e8f0"}}>
                    <p className="text-sm font-medium mb-2">
                      #{row.odeme.sira_no} — {row.kaynak.para_sahibi} (Şahsi) — en fazla {money(row.kaynak.kullanilan_tutar)} karşılanabilir
                    </p>
                    <div className="field-label mb-3" style={{maxWidth: 200}}>
                      Karşılanacak Tutar
                      <input className="input" type="number" min="0" value={sahsiKarsilamaTutar} onChange={(e) => setSahsiKarsilamaTutar(e.target.value)} placeholder="0" />
                    </div>

                    <div className="flex flex-wrap items-end gap-2 mb-2">
                      <div className="field-label" style={{minWidth: 220}}>
                        Kaynak ekle
                        <select className="input" value={sahsiKarsilamaKimdenSecim} onChange={(e) => setSahsiKarsilamaKimdenSecim(e.target.value)}>
                          <option value="">Seç...</option>
                          {paraSahibiSecenekleri.filter((k) => !sahsiKarsilamaKimden.includes(k)).map((k) => (
                            <option key={k} value={k}>{k} — kullanılabilir {money(getKaynakBakiye(k))}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { if (sahsiKarsilamaKimdenSecim) { setSahsiKarsilamaKimden([...sahsiKarsilamaKimden, sahsiKarsilamaKimdenSecim]); setSahsiKarsilamaKimdenSecim(""); } }}
                      >
                        Kaynak Ekle
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {sahsiKarsilamaKimden.map((k) => (
                        <span key={k} className="rounded px-3 py-1 text-sm" style={{background:"#e0eafc", color:"#1e40af", display:"inline-flex", alignItems:"center", gap:6}}>
                          {k === "__devir__" ? "Devir Bakiyesi" : k}
                          <button type="button" onClick={() => setSahsiKarsilamaKimden(sahsiKarsilamaKimden.filter((x) => x !== k))} style={{border:"none", background:"none", cursor:"pointer", color:"#1e40af"}}>✕</button>
                        </span>
                      ))}
                      {sahsiKarsilamaKimden.length === 0 && <span className="text-sm text-slate-400">Henüz kaynak eklenmedi</span>}
                    </div>

                    {sahsiKarsilamaKimden.length > 0 && sahsiKarsilamaHedefTutar > 0 && (
                      <p className="text-sm mb-3" style={{color: sahsiKarsilamaEksik > 0.5 ? "#dc2626" : "#16a34a"}}>
                        {sahsiKarsilamaEksik > 0.5
                          ? `Seçilen kaynaklar yetmiyor: ${money(sahsiKarsilamaEksik)} eksik, başka kaynak ekle.`
                          : "Tüm tutar karşılandı."}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn"
                        disabled={sahsiKarsilamaEksik > 0.5 || sahsiKarsilamaHedefTutar <= 0 || isLoading("submitSahsiKarsilama")}
                        onClick={() => withLoading("submitSahsiKarsilama", submitSahsiKarsilama)}
                      >
                        {isLoading("submitSahsiKarsilama") ? "Kaydediliyor..." : "Karşıla ve Kaydet"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => { setSahsiKarsilamaSecili(null); setSahsiKarsilamaTutar(""); setSahsiKarsilamaKimden([]); }}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card title="Ödeme Geçmişi">
              <Table
                headers={["#", "Tarih", "Tip", "Kime / Ne için", "Tutar", "Kaynaklar", ""]}
                rows={[...odemeler].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((o) => {
                  const kaynaklar = odemeKaynaklari.filter((k) => k.odeme_id === o.id);
                  const kaynakOzet = kaynaklar.map((k) => k.kaynak_tipi === "devir" ? `Devir (${money(k.kullanilan_tutar)})` : k.kaynak_tipi === "sahsi" ? `${k.para_sahibi} (Şahsi) (${money(k.kullanilan_tutar)})` : `${k.para_sahibi} (${money(k.kullanilan_tutar)})`).join(", ");
                  return [
                    o.sira_no,
                    toTR(o.created_at, true),
                    o.tip === "toptanci" ? "Toptancı" : o.tip === "kargo" ? "Kargo" : o.tip === "kar_payi" ? "Kâr Payı" : "Diğer",
                    o.tip === "toptanci"
                      ? `${o.supplier_id ? supplierMap.get(o.supplier_id)?.name || "-" : "-"} — ${o.batch_id ? batchMap.get(o.batch_id)?.name || "-" : "-"}`
                      : o.tip === "kar_payi"
                      ? (o.recipient_name || "-")
                      : (o.batch_id ? batchMap.get(o.batch_id)?.name || "-" : "-"),
                    money(o.tutar),
                    kaynakOzet || "-",
                    <button
                      key="sil"
                      type="button"
                      className="btn-danger"
                      style={{fontSize:"0.7rem", padding:"3px 10px"}}
                      onClick={() => deleteOdeme(o.id)}
                    >
                      Sil
                    </button>,
                  ];
                })}
              />
              {odemeler.length === 0 && <p className="mt-2 text-sm text-slate-500">Henüz ödeme kaydı yok.</p>}
            </Card>
          </div>
        )}

        {active === "sellers" && (
          <div className="space-y-4">
            <Card title="Satıcılar">
              {sellerAccounts.length === 0 ? (
                <p className="text-sm text-slate-500">Henüz satıcı eklenmedi.</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {sellerAccounts.map((seller) => {
                      const isOpen = openSellerId === seller.id;
                      return (
                        <button
                          type="button"
                          key={seller.id}
                          onClick={() => setOpenSellerId(isOpen ? null : seller.id)}
                          className={isOpen ? "btn" : "btn-secondary"}
                          style={{ fontSize: "0.85rem", padding: "8px 14px", position: "relative" }}
                        >
                          {seller.name}
                          {!seller.active && <span style={{ marginLeft: 6, fontSize: "0.65rem", opacity: 0.8 }}>(Pasif)</span>}
                        </button>
                      );
                    })}
                  </div>

                  {openSellerId && (() => {
                    const seller = sellerAccountMap.get(openSellerId);
                    if (!seller) return null;
                    const summary = getSellerSummary(seller.id);
                    return (
                      <div className="border rounded-xl p-4 bg-white">
                        <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              {seller.name}
                              {!seller.active && <span className="text-xs font-normal text-red-600 border border-red-300 rounded px-2 py-0.5">Pasif</span>}
                            </div>
                            <div className="text-xs text-slate-500">{seller.email}</div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className="btn-secondary" style={{fontSize:"0.75rem"}} onClick={() => toggleSellerActive(seller)}>
                              {seller.active ? "Pasif Et" : "Aktif Et"}
                            </button>
                            <button type="button" className="btn-danger" style={{fontSize:"0.75rem"}} onClick={() => deleteSellerAccount(seller)}>
                              Sil
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Satış</div><b>{money(summary.totalSatis)}</b></div>
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Tahsilat</div><b>{money(summary.totalTahsilat)}</b></div>
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Cari Borcu</div><b>{money(summary.cariBorcu)}</b></div>
                          <div className="rounded-lg bg-emerald-50 p-2"><div className="text-xs text-slate-500">Kâr Payı (Toplam)</div><b>{money(summary.totalKarPayi)}</b></div>
                          <div className="rounded-lg bg-emerald-50 p-2"><div className="text-xs text-slate-500">Gerçekleşen Kâr</div><b>{money(summary.gerceklesenKarPayi)}</b></div>
                          <div className="rounded-lg p-2" style={{background: summary.kalanBorc < 0 ? "#eff6ff" : "#fffbeb"}}>
                            <div className="text-xs text-slate-500">Size Kalan Borç</div>
                            <b style={{color: summary.kalanBorc > 0 ? "#b45309" : summary.kalanBorc < 0 ? "#2563eb" : "#16a34a"}}>
                              {summary.kalanBorc < 0 ? `Siz ona borçlusunuz: ${money(Math.abs(summary.kalanBorc))}` : money(summary.kalanBorc)}
                            </b>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem"}} onClick={() => setSellerSalesDetailId(seller.id)}>
                            Satış Detayları
                          </button>
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem"}} onClick={() => setSellerPaymentsDetailId(seller.id)}>
                            Tahsilat Detayları
                          </button>
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem"}} onClick={() => setSellerTransferDetailId(seller.id)}>
                            Transfer Detayları
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </Card>

            <Card title="Satıcı Ekle">
              <p className="mb-4 text-sm text-slate-500">
                Buraya eklediğin satıcı, uygulamaya kendi ekranını görebilir (Stok, Ön Sipariş, Satış, Cari, Tahsilat — kendi verisi). Ekledikten sonra Supabase → Authentication'dan aynı e-posta ile bir kullanıcı hesabı oluşturup şifresini satıcıya iletmen gerekiyor.
              </p>
              <div className="flex flex-wrap gap-3">
                <input className="input max-w-xs" placeholder="Satıcı adı" value={newSellerName} onChange={(e) => setNewSellerName(e.target.value)} />
                <input className="input max-w-xs" placeholder="E-posta (giriş için)" value={newSellerEmail} onChange={(e) => setNewSellerEmail(e.target.value)} />
                <button type="button" className="btn" onClick={addSellerAccount}>Satıcı Ekle</button>
              </div>
            </Card>

            {sellerSalesDetailId && (() => {
              const seller = sellerAccountMap.get(sellerSalesDetailId);
              if (!seller) return null;
              const sellerSales = [...activeSales]
                .filter((s) => s.seller_account_id === sellerSalesDetailId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return (
                <div
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  onClick={() => setSellerSalesDetailId(null)}
                >
                  <div
                    style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 900, maxHeight: "85vh", overflowY: "auto" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{seller.name} — Satış Detayları</h2>
                      <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setSellerSalesDetailId(null)}>Kapat</button>
                    </div>
                    <Table
                      headers={["Tarih", "Müşteri", "Ürün", "Adet", "Toplam", "Kâr Payı", "Tahsilat Durumu"]}
                      rows={sellerSales.map((s) => {
                        const allocated = paymentAllocations
                          .filter((a) => a.sale_id === s.id)
                          .reduce((sum, a) => sum + Number(a.amount || 0), 0);
                        const total = toNum(s.total);
                        let durum: string;
                        if (s.paid || total <= 0 || allocated >= total - 0.01) {
                          durum = "Ödendi";
                        } else if (allocated > 0.01) {
                          durum = `Kısmi (${money(allocated)} / ${money(total)})`;
                        } else {
                          durum = "Ödenmedi";
                        }
                        return [
                          toTR(s.created_at, true),
                          customerMap.get(s.customer_id)?.name || "-",
                          saleProductName(s),
                          s.qty,
                          money(s.total),
                          money(Number(s.seller_profit || 0)),
                          durum,
                        ];
                      })}
                    />
                    {sellerSales.length === 0 && <p className="mt-2 text-sm text-slate-500">Bu satıcıya ait satış bulunamadı.</p>}
                  </div>
                </div>
              );
            })()}

            {sellerPaymentsDetailId && (() => {
              const seller = sellerAccountMap.get(sellerPaymentsDetailId);
              if (!seller) return null;
              const sellerPayments = [...activePayments]
                .filter((p) => p.seller_account_id === sellerPaymentsDetailId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return (
                <div
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  onClick={() => setSellerPaymentsDetailId(null)}
                >
                  <div
                    style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 900, maxHeight: "85vh", overflowY: "auto" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{seller.name} — Tahsilat Detayları</h2>
                      <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setSellerPaymentsDetailId(null)}>Kapat</button>
                    </div>
                    <Table
                      headers={["Tarih", "Müşteri", "Yöntem", "Tutar", "Kasa", "Para Kimde", "Açıklama"]}
                      rows={sellerPayments.map((p) => [
                        toTR(p.created_at, true),
                        p.customer_id ? (customerMap.get(p.customer_id)?.name || "-") : "-",
                        p.payment_method === "nakit" ? "Nakit" : p.payment_method === "banka" ? "Banka" : "-",
                        money(p.amount),
                        p.kasa_tutari !== null && p.kasa_tutari !== undefined ? money(p.kasa_tutari) : "-",
                        p.para_sahibi || "-",
                        p.aciklama || "-",
                      ])}
                    />
                    {sellerPayments.length === 0 && <p className="mt-2 text-sm text-slate-500">Bu satıcıya ait tahsilat bulunamadı.</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {sellerTransferDetailId && (() => {
          const seller = sellerAccountMap.get(sellerTransferDetailId);
          if (!seller) return null;
          const summary = getSellerSummary(sellerTransferDetailId);
          const transfers = [...sellerTransfers]
            .filter((t) => t.seller_account_id === sellerTransferDetailId)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return (
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
              onClick={() => setSellerTransferDetailId(null)}
            >
              <div
                style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 700, maxHeight: "85vh", overflowY: "auto" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{seller.name} — Transfer Detayları</h2>
                  <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setSellerTransferDetailId(null)}>Kapat</button>
                </div>
                <p className="mb-4 text-sm text-slate-500">
                  Bu satıcı topladığı parayı size ya da diğer ortağa fiilen teslim ettiğinde burada kaydet.
                  Bu bir müşteri tahsilatı değil, iç bir transferdir — Ödemeler/Tahsilat ekranlarındaki listelere karışmaz.
                </p>
                <div className="grid gap-3 md:grid-cols-3 mb-4">
                  <div className="field-label">
                    Tutar
                    <input className="input" type="number" min="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div className="field-label">
                    Kime teslim etti
                    <select className="input" value={transferAlici} onChange={(e) => setTransferAlici(e.target.value)}>
                      <option value="">Seç...</option>
                      <option value="Veli">Veli</option>
                      <option value="Aslı">Aslı</option>
                      <option value="Mihrimah">Mihrimah</option>
                    </select>
                  </div>
                  <div className="field-label" style={{justifyContent:"flex-end"}}>
                    <span style={{opacity:0}}>.</span>
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        await recordSellerTransfer(sellerTransferDetailId, Number(transferAmount || 0), transferAlici, "");
                        setTransferAmount("");
                        setTransferAlici("");
                      }}
                    >
                      Transferi Kaydet
                    </button>
                  </div>
                </div>
                <p className="mb-3 text-sm" style={{color: summary.kalanBorc < 0 ? "#2563eb" : "#64748b"}}>
                  {summary.kalanBorc < 0
                    ? `Şu an siz bu satıcıya ${money(Math.abs(summary.kalanBorc))} borçlusunuz.`
                    : `Şu an bu satıcı size ${money(summary.kalanBorc)} borçlu.`}
                </p>
                <Table
                  headers={["Tarih", "Kime", "Tutar", ""]}
                  rows={transfers.map((t) => [
                    toTR(t.created_at, true),
                    t.alici,
                    money(t.amount),
                    <button
                      key="sil"
                      type="button"
                      className="btn-danger"
                      style={{fontSize:"0.7rem", padding:"3px 10px"}}
                      onClick={async () => {
                        if (!confirm(`${money(t.amount)} tutarındaki bu transfer kaydı silinsin mi?`)) return;
                        const { error } = await supabase.from("seller_transfers").delete().eq("id", t.id);
                        if (error) return showError(error);
                        await logAction("Satıcı → Ortak transferi silindi", "seller_transfers", seller.name, { tutar: t.amount, alici: t.alici });
                        setMessage("Transfer kaydı silindi.");
                        loadAll();
                      }}
                    >
                      Sil
                    </button>,
                  ])}
                />
                {transfers.length === 0 && <p className="mt-2 text-sm text-slate-500">Henüz transfer kaydı yok.</p>}
              </div>
            </div>
          );
        })()}

        {active === "customers" && (
          <div className="space-y-0">
            <div className="product-page">
              <div className="product-page-header">
                <h2 className="product-page-title">Cari Listesi</h2>
              </div>

              {/* Add Customer */}
              <div className="product-add-wrap product-add-wrap--top">
                <details className="w-full">
                  <summary className="product-add-btn" style={{listStyle:"none", cursor:"pointer"}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Yeni Cari Ekle
                  </summary>
                  <div className="product-add-form-panel">
                    <div className="flex flex-wrap gap-3">
                      <input className="input max-w-md" maxLength={50} placeholder="Cari adı (max 50 karakter)" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                      <button type="button" className="btn" onClick={addCustomer}>Cari Ekle</button>
                    </div>
                  </div>
                </details>
              </div>

              {/* Search */}
              <div className="product-search-wrap">
                <div className="product-search-inner">
                  <svg className="product-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="product-search-input" placeholder="Cari adı yazın; yazdıkça liste filtrelenir" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                </div>
              </div>

              {/* Customer List */}
              <div className="product-list">
                {filteredCustomers.length ? filteredCustomers.map((c) => {
                  const isOpen = expandedCustomerId === c.id;
                  const isEditing = editingCustomerId === c.id;
                  const draft = customerDrafts[c.id] || {};
                  const balance = getCustomerBalance(c.id);
                  const customerSales = activeSales.filter((sale) => sale.customer_id === c.id);
                  const customerPayments = activePayments.filter((p) => p.customer_id === c.id);
                  const totalSales = getCustomerSalesTotal(c.id);
                  const collected = getCustomerCollectedTotal(c.id);
                  const status = c.passive ? "Pasif" : balance <= 0 ? "Ödendi" : "Borç Açık";
                  const statusColor = c.passive ? "#64748b" : balance <= 0 ? "#16a34a" : "#dc2626";

                  return (
                    <div key={c.id} id={`cari-card-${c.id}`} className={`product-card ${isOpen ? "product-card--open" : ""}`}>
                      {/* Row */}
                      <button
                        type="button"
                        className="product-row"
                        onClick={() => {
                          const nextId = expandedCustomerId === c.id ? null : c.id;
                          setExpandedCustomerId(nextId);
                          setEditingCustomerId(null);
                          if (nextId) {
                            setTimeout(() => {
                              const el = document.getElementById(`cari-card-${nextId}`);
                              if (el) {
                                const y = el.getBoundingClientRect().top + window.scrollY - 16;
                                window.scrollTo({ top: y, behavior: "smooth" });
                              }
                            }, 80);
                          }
                        }}
                      >
                        <div className="product-row-left">
                          <div className="product-name">{c.name}</div>
                          <div className="product-meta" style={{color: statusColor, fontWeight: 600}}>{status}</div>
                          <div className="product-meta">Oluşturan: {c.seller_account_id ? (sellerAccountMap.get(c.seller_account_id)?.name || "Satıcı") : shortUserName(c.created_by)}</div>
                        </div>
                        <div className="product-row-stats">
                          <div className="product-stat-chip">
                            <span className="product-stat-label">Satış</span>
                            <b className="product-stat-val" style={{fontSize:"0.7rem"}}>{money(totalSales)}</b>
                          </div>
                          <div className="product-stat-chip">
                            <span className="product-stat-label">Ödeme</span>
                            <b className="product-stat-val" style={{fontSize:"0.7rem"}}>{money(collected)}</b>
                          </div>
                          <div className={`product-stat-chip ${balance > 0 ? "product-stat-chip--low" : ""}`}>
                            <span className={`product-stat-label ${balance > 0 ? "product-stat-label--stock" : ""}`}>Kalan</span>
                            <b className={`product-stat-val ${balance > 0 ? "product-stat-val--stock" : ""}`} style={{fontSize:"0.7rem"}}>{money(balance)}</b>
                          </div>
                        </div>
                        <span className="product-chevron">
                          {isOpen
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="m18 15-6-6-6 6"/></svg>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18"><path d="m9 18 6-6-6-6"/></svg>}
                        </span>
                      </button>

                      {/* Expanded */}
                      {isOpen && (
                        <div className="product-detail">
                          {isEditing ? (
                            <div className="product-edit-fields" style={{marginBottom: 14}}>
                              <label className="field-label">
                                <span>Cari adı</span>
                                <input className="input" maxLength={50} value={String(draft.name ?? c.name)} onChange={(e) => setCustomerDrafts({ ...customerDrafts, [c.id]: { ...(customerDrafts[c.id] || {}), name: e.target.value } })} />
                              </label>
                              <label className="field-label">
                                <span>Durum</span>
                                <select className="input" value={String(draft.passive ?? c.passive)} onChange={(e) => setCustomerDrafts({ ...customerDrafts, [c.id]: { ...(customerDrafts[c.id] || {}), passive: e.target.value === "true" } })}>
                                  <option value="false">Aktif</option>
                                  <option value="true">Pasif</option>
                                </select>
                              </label>
                              <div className="product-action-row">
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => saveCustomerEdit(c.id)}>Kaydet</button>
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => cancelCustomerEdit(c.id)}>Vazgeç</button>
                              </div>
                            </div>
                          ) : (
                            <div className="product-action-row" style={{marginBottom: 14}}>
                              <div className="cari-payment-row">
                                <input className="input" style={{maxWidth: 160}} type="number" min="0" placeholder="Ödeme tutarı" value={paymentInputs[c.id] || ""} onChange={(e) => setPaymentInputs({ ...paymentInputs, [c.id]: e.target.value })} />
                                <select className="input" style={{maxWidth: 160}} value={paymentMethodInputs[c.id] || "banka"} onChange={(e) => setPaymentMethodInputs({ ...paymentMethodInputs, [c.id]: e.target.value })}>
                                  <option value="banka">Tahsilat banka alındı</option>
                                  <option value="nakit">Tahsilat nakit alındı</option>
                                </select>
                                <select className="input" style={{maxWidth: 160}} value={paymentParaSahibiInputs[c.id] || ""} onChange={(e) => setPaymentParaSahibiInputs({ ...paymentParaSahibiInputs, [c.id]: e.target.value })}>
                                  <option value="">Para kimde? *</option>
                                  {paraSahibiSecenekleri.map((kisi) => <option key={kisi} value={kisi}>{kisi}</option>)}
                                </select>
                                <button type="button" className="product-btn product-btn--secondary" disabled={paymentLoading === c.id} onClick={() => addCustomerPayment(c.id)}>{paymentLoading === c.id ? "..." : "Ödeme Ekle"}</button>
                              </div>
                              <button type="button" className="product-btn product-btn--secondary" onClick={() => startCustomerEdit(c)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Düzenle
                              </button>
                              {c.passive ? (
                                <button
                                  type="button"
                                  className="product-btn product-btn--secondary"
                                  onClick={async () => {
                                    const { error } = await supabase.from("customers").update({ passive: false }).eq("id", c.id);
                                    if (error) return showError(error);
                                    await logAction("Cari aktif edildi", "customers", c.name, diffOf({ pasif: true }, { pasif: false }));
                                    setMessage("Cari tekrar aktif edildi.");
                                    loadAll();
                                  }}
                                >
                                  Aktif Et
                                </button>
                              ) : (
                                <button type="button" className="product-btn product-btn--danger" onClick={() => deleteCustomer(c.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                  Sil / Pasife Al
                                </button>
                              )}
                            </div>
                          )}

                          {/* Sales movements */}
                          <div className="product-batch-section">
                            <h4 className="product-batch-title">Satış Hareketleri</h4>
                            <div className="product-batch-table">
                              <div className="cari-sales-thead">
                                <div>Tarih</div><div>Ürün</div><div>Parti</div><div>Ad</div><div>Tutar</div><div>Durum</div>
                              </div>
                              {customerSales.length ? customerSales.map((sale) => {
                                return (
                                  <div key={sale.id} className="cari-sales-row">
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{toTR(sale.created_at)}</div>
                                    <div className="product-batch-cell product-batch-cell--name" style={{fontSize:"0.68rem"}}>{saleProductName(sale)}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{batchMap.get(sale.batch_id)?.name || "-"}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{sale.qty}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{money(sale.total)}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{getSaleStatus(sale)}</div>
                                  </div>
                                );
                              }) : <div className="product-batch-empty">Satış yok.</div>}
                            </div>
                          </div>

                          {/* Payment movements */}
                          <div className="product-batch-section">
                            <h4 className="product-batch-title">Ödeme Hareketleri</h4>
                            <div className="product-batch-table">
                              <div className="cari-pay-thead">
                                <div>Tarih</div><div>Tutar</div><div></div>
                              </div>
                              {customerPayments.length ? customerPayments.map((pay) => {
                                const isEditingPay = editingPaymentId === pay.id;
                                return (
                                  <div key={pay.id} className="cari-pay-row">
                                    <div className="product-batch-cell" style={{fontSize:"0.8rem"}}>{toTR(pay.created_at)}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.8rem"}}>
                                      {isEditingPay
                                        ? <input className="input" style={{width:90, padding:"2px 6px", fontSize:"0.8rem"}} type="number" min="1" value={editingPaymentAmount} onChange={(e) => setEditingPaymentAmount(e.target.value)} />
                                        : money(pay.amount)}
                                    </div>
                                    <div className="product-batch-cell" style={{display:"flex", gap:4}}>
                                      {isEditingPay ? (<>
                                        <button type="button" className="btn" style={{fontSize:"0.7rem", padding:"2px 8px"}} disabled={isLoading(`pay-update-${pay.id}`)} onClick={() => withLoading(`pay-update-${pay.id}`, () => updatePayment(pay.id, Number(editingPaymentAmount), c.id))}>{isLoading(`pay-update-${pay.id}`) ? "..." : "Kaydet"}</button>
                                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => { setEditingPaymentId(null); setEditingPaymentAmount(""); }}>Vazgeç</button>
                                      </>) : (<>
                                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => { setEditingPaymentId(pay.id); setEditingPaymentAmount(String(pay.amount)); }}>Düzenle</button>
                                        <button type="button" className="btn-danger" style={{fontSize:"0.7rem", padding:"2px 8px"}} disabled={isLoading(`pay-del-${pay.id}`)} onClick={() => withLoading(`pay-del-${pay.id}`, () => deletePayment(pay.id, c.id, pay.amount))}>{isLoading(`pay-del-${pay.id}`) ? "..." : "Sil"}</button>
                                      </>)}
                                    </div>
                                  </div>
                                );
                              }) : <div className="product-batch-empty">Ödeme yok.</div>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }) : <p className="px-4 py-8 text-center text-sm text-slate-500">Kayıt yok.</p>}
              </div>
            </div>
          </div>
        )}

        {active === "preorders" && (
          <div className="space-y-6">
            {/* Form */}
            <Card title={editingPreorderId ? "Ön Sipariş Düzenle" : "Yeni Ön Sipariş"}>
              <div className="space-y-3">
                <div>
                  <label className="label">Cari</label>
                  <SearchableSelect
                    placeholder="Cari ara..."
                    value={preorderForm.customerId}
                    onChange={(v) => setPreorderForm({ ...preorderForm, customerId: v })}
                    options={sortedActiveCustomers.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>
                <div>
                  <label className="label">Not (opsiyonel)</label>
                  <input className="input" value={preorderForm.note} onChange={(e) => setPreorderForm({ ...preorderForm, note: e.target.value })} placeholder="Sipariş notu..." />
                </div>
                <div>
                  <label className="label">Ürünler</label>
                  <div className="space-y-2">
                    {preorderForm.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div style={{ flex: 3 }}>
                          <SearchableSelect
                            placeholder="Ürün ara..."
                            value={item.productId}
                            onChange={(v) => { const items = [...preorderForm.items]; items[idx].productId = v; setPreorderForm({ ...preorderForm, items }); }}
                            options={sortedActiveProducts.map((p) => ({ value: p.id, label: p.name }))}
                          />
                        </div>
                        <input className="input" style={{flex:1, minWidth:60}} type="number" min="1" value={item.qty} onChange={(e) => { const items = [...preorderForm.items]; items[idx].qty = e.target.value; setPreorderForm({ ...preorderForm, items }); }} placeholder="Adet" />
                        {preorderForm.items.length > 1 && (
                          <button type="button" className="btn-danger" style={{padding:"6px 10px", flexShrink:0}} onClick={() => { const items = preorderForm.items.filter((_, i) => i !== idx); setPreorderForm({ ...preorderForm, items }); }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn-secondary text-sm" onClick={() => setPreorderForm({ ...preorderForm, items: [...preorderForm.items, { productId: "", qty: "1" }] })}>+ Ürün Ekle</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn" disabled={isLoading("savePreorder")} onClick={() => withLoading("savePreorder", savePreorder)}>{isLoading("savePreorder") ? "..." : editingPreorderId ? "Güncelle" : "Kaydet"}</button>
                  {editingPreorderId && <button type="button" className="btn-secondary" onClick={() => { setEditingPreorderId(null); setPreorderForm({ customerId: "", note: "", items: [{ productId: "", qty: "1" }] }); }}>Vazgeç</button>}
                </div>
                {message && <p className="text-sm text-red-600">{message}</p>}
              </div>
            </Card>

            {/* Bekleyen Ön Siparişler */}
            <Card
              title="Bekleyen Ön Siparişler"
              actions={
                <button type="button" className="btn-secondary" style={{fontSize:"0.8rem", padding:"4px 12px"}} onClick={exportPreorderToExcel}>Excel'e Aktar</button>
              }
            >
              {(isSellerRole ? myPreorders : preorders).filter((po) => po.status === "bekliyor").length === 0
                ? <p className="text-sm text-slate-500">Bekleyen ön sipariş yok.</p>
                : (isSellerRole ? myPreorders : preorders).filter((po) => po.status === "bekliyor").map((po) => {
                  const items = preorderItems.filter((i) => i.preorder_id === po.id);
                  const customer = customerMap.get(po.customer_id);
                  const advancePayments = payments.filter((p) => p.preorder_id === po.id && !p.cancelled);
                  const advanceTotal = advancePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
                  return (
                    <div key={po.id} className="border rounded-xl p-4 mb-3 bg-white">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="font-semibold text-slate-800">{customer?.name || "—"}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{toTR(po.created_at, true)} · {shortUserName(po.created_by)} {po.note ? `· ${po.note}` : ""}</div>
                          {advanceTotal > 0 && (
                            <div className="text-xs font-semibold mt-1" style={{color:"#92400e"}}>
                              💰 Ön ödeme alınmış: {money(advanceTotal)}
                            </div>
                          )}
                          <ul className="mt-2 space-y-1">
                            {items.map((item) => (
                              <li key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                                <span>• {productMap.get(item.product_id)?.name || "—"} — {item.qty} adet</span>
                                <button type="button" className="btn" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => openConvertModal(po, item)}>Satışa Dönüştür</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem", padding:"6px 12px"}} onClick={() => { setAdvancePaymentModal(po); setAdvanceAmount(""); setAdvanceMethod("banka"); setAdvanceNote(""); }}>Ön Ödeme Ekle</button>
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem", padding:"6px 12px"}} onClick={() => startEditPreorder(po)}>Düzenle</button>
                          <button type="button" className="btn-danger" style={{fontSize:"0.8rem", padding:"6px 12px"}} onClick={() => deletePreorder(po.id)}>Sil</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </Card>

            {/* Tamamlanan Ön Siparişler */}
            <Card title="Tamamlanan Ön Siparişler">
              {(isSellerRole ? myPreorders : preorders).filter((po) => po.status === "tamamlandı").length === 0
                ? <p className="text-sm text-slate-500">Tamamlanan ön sipariş yok.</p>
                : (isSellerRole ? myPreorders : preorders).filter((po) => po.status === "tamamlandı").map((po) => {
                  const items = preorderItems.filter((i) => i.preorder_id === po.id);
                  const customer = customerMap.get(po.customer_id);
                  return (
                    <div key={po.id} className="border rounded-xl p-4 mb-3 bg-slate-50">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="font-semibold text-slate-500">{customer?.name || "—"} <span className="text-xs text-green-600 font-semibold ml-1">✓ Tamamlandı</span></div>
                          <div className="text-xs text-slate-400 mt-0.5">{toTR(po.created_at, true)} · {shortUserName(po.created_by)}</div>
                          <ul className="mt-1 space-y-0.5">
                            {items.map((item) => (
                              <li key={item.id} className="text-xs text-slate-500">• {productMap.get(item.product_id)?.name || "—"} — {item.qty} adet</li>
                            ))}
                          </ul>
                        </div>
                        <button type="button" className="btn-danger" style={{fontSize:"0.75rem", padding:"4px 10px"}} onClick={() => deletePreorder(po.id)}>Sil</button>
                      </div>
                    </div>
                  );
                })}
            </Card>
          </div>
        )}

        {showTahsilatDetay && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowTahsilatDetay(false)}>
            <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:1180,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={(e) => e.stopPropagation()}>
              <div style={{flexShrink:0,padding:"24px 24px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Dönem Tahsilatları Detayı</h2>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={exportTahsilatToExcel}>Excel'e Aktar</button>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowTahsilatDetay(false)}>Kapat</button>
                  </div>
                </div>
                {!isSellerRole && totals.openingBalancePeriodId && (
                  <div style={{background:"#fffbeb", borderRadius:12, padding:"10px 14px", marginBottom:16, display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", fontSize:"0.8rem"}}>
                    <span style={{color:"#92400e", fontWeight:600}}>Dönem Başlangıç Kasa Bakiyesi (önceki dönemden devir)</span>
                    {editingOpeningBalance ? (
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input
                          className="input"
                          type="number"
                          style={{fontSize:"0.78rem",padding:"4px 6px", width: 100}}
                          value={openingBalanceDraft}
                          onChange={(e) => setOpeningBalanceDraft(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveOpeningBalance(totals.openingBalancePeriodId!); }}
                        />
                        <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => saveOpeningBalance(totals.openingBalancePeriodId!)}>Kaydet</button>
                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingOpeningBalance(false); setOpeningBalanceDraft(""); }}>Vazgeç</button>
                      </div>
                    ) : (
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontWeight:700, color:"#92400e"}}>{money(totals.openingBalance)}</span>
                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingOpeningBalance(true); setOpeningBalanceDraft(String(totals.openingBalance)); }}>Değiştir</button>
                      </div>
                    )}
                    {editingOpeningBalanceNote ? (
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <input
                          className="input"
                          style={{fontSize:"0.78rem",padding:"4px 6px"}}
                          value={openingBalanceNoteDraft}
                          onChange={(e) => setOpeningBalanceNoteDraft(e.target.value)}
                          placeholder="Örn: 1500 TL bundan 12.parti alımına gitti"
                          autoFocus
                        />
                        <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => saveOpeningBalanceNote(totals.openingBalancePeriodId!)}>Kaydet</button>
                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingOpeningBalanceNote(false); setOpeningBalanceNoteDraft(""); }}>Vazgeç</button>
                      </div>
                    ) : (
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {totals.openingBalanceNote && <span style={{color:"#92400e",fontStyle:"italic"}}>{totals.openingBalanceNote}</span>}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{fontSize:"0.7rem",padding:"3px 8px"}}
                          onClick={() => { setEditingOpeningBalanceNote(true); setOpeningBalanceNoteDraft(totals.openingBalanceNote || ""); }}
                        >
                          {totals.openingBalanceNote ? "Değiştir" : "Not Ekle"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{overflow:"auto",padding:"0 24px 24px",flex:1}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Tarih</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Cari</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Ekleyen</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Yöntem</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Tutar</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Kasa</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Para Kimde</th>
                      {!isSellerRole && <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Açıklama</th>}
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}></th>
                    </tr>
                    <tr style={{background:"#f0fdf4",borderBottom:"1.5px solid #bbf7d0"}}>
                      <td style={{padding:"7px 10px",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}} colSpan={4}>Toplamı ({totals.recentPayments.length} ödeme)</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(totals.grossCash)}</td>
                      <td style={{padding:"7px 10px",fontWeight:700,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(toplamKasaHavuzu)}</td>
                      <td style={{position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}></td>
                      {!isSellerRole && <td style={{position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}></td>}
                      <td style={{position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}></td>
                    </tr>
                  </thead>
                  <tbody>
                    {!isSellerRole && totals.pastPendingAdvanceTotal > 0 && (
                      <tr style={{borderBottom:"1px solid #f1f5f9", background:"#fef9c3"}}>
                        <td style={{padding:"7px 10px", color:"#854d0e", fontWeight:600}} colSpan={9}>
                          💰 Geçmiş dönem(ler)den bekleyen ön ödemeler (henüz satışa dönüşmedi, bu ekranda ayrı satır olarak görünmüyor çünkü eski dönemde kalmış): <b>{money(totals.pastPendingAdvanceTotal)}</b> — satışa dönüştükçe bu tutar otomatik azalır.
                        </td>
                      </tr>
                    )}
                    {totals.recentPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((pay) => {
                      const linkedPreorder = pay.preorder_id ? preorderMap.get(pay.preorder_id) : null;
                      const isPendingAdvance = !!linkedPreorder && linkedPreorder.status === "bekliyor";
                      return (
                      <tr key={pay.id} style={{borderBottom:"1px solid #f1f5f9", background: isPendingAdvance ? "#fffbeb" : undefined}}>
                        <td style={{padding:"7px 10px"}}>{toTR(pay.created_at, true)}</td>
                        <td style={{padding:"7px 10px"}}>
                          {customerMap.get(pay.customer_id)?.name || "-"}
                          {isPendingAdvance && <span style={{marginLeft:6, fontSize:"0.7rem", fontWeight:700, color:"#92400e"}}>💰 Ön Ödeme</span>}
                        </td>
                        <td style={{padding:"7px 10px",color:"#64748b"}}>{pay.user_email?.split("@")[0] || "-"}</td>
                        <td style={{padding:"7px 10px"}}>
                          {pay.payment_method === "nakit" ? "Nakit" : pay.payment_method === "banka" ? "Banka" : <span style={{color:"#cbd5e1"}}>—</span>}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:500}}>{isPendingAdvance ? <span style={{color:"#cbd5e1"}}>—</span> : money(pay.amount)}</td>
                        <td style={{padding:"7px 10px", minWidth: 110}}>
                          {editingPaymentRowId === pay.id ? (
                            <input
                              className="input"
                              type="number"
                              style={{fontSize:"0.78rem",padding:"4px 6px", width: 90}}
                              placeholder="₺"
                              value={paymentRowDraft.kasa}
                              onChange={(e) => setPaymentRowDraft((d) => ({ ...d, kasa: e.target.value }))}
                            />
                          ) : (
                            pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? money(pay.kasa_tutari) : <span style={{color:"#cbd5e1"}}>—</span>
                          )}
                        </td>
                        <td style={{padding:"7px 10px", minWidth: 110}}>
                          {editingPaymentRowId === pay.id ? (
                            <select
                              className="input"
                              style={{fontSize:"0.78rem",padding:"4px 6px"}}
                              value={paymentRowDraft.paraSahibi}
                              onChange={(e) => setPaymentRowDraft((d) => ({ ...d, paraSahibi: e.target.value }))}
                            >
                              <option value="">Kimde?</option>
                              {paraSahibiSecenekleri.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          ) : (
                            pay.para_sahibi ? <span style={{color:"#475569"}}>{pay.para_sahibi}</span> : <span style={{color:"#cbd5e1"}}>—</span>
                          )}
                        </td>
                        {!isSellerRole && (
                          <td style={{padding:"7px 10px", minWidth: 160}}>
                            {editingPaymentRowId === pay.id ? (
                              <input
                                className="input"
                                style={{fontSize:"0.78rem",padding:"4px 6px"}}
                                value={paymentRowDraft.aciklama}
                                onChange={(e) => setPaymentRowDraft((d) => ({ ...d, aciklama: e.target.value }))}
                                placeholder="Açıklama..."
                              />
                            ) : (
                              pay.aciklama ? <span style={{color:"#475569",fontStyle:"italic"}}>{pay.aciklama}</span> : <span style={{color:"#cbd5e1"}}>—</span>
                            )}
                          </td>
                        )}
                        <td style={{padding:"7px 10px", minWidth: 110}}>
                          {editingPaymentRowId === pay.id ? (
                            <div style={{display:"flex",gap:6}}>
                              <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => savePaymentRow(pay.id)}>Kaydet</button>
                              <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => setEditingPaymentRowId(null)}>Vazgeç</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{fontSize:"0.7rem",padding:"3px 8px"}}
                              onClick={() => {
                                setEditingPaymentRowId(pay.id);
                                setPaymentRowDraft({
                                  note: pay.note || "",
                                  kasa: pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? String(pay.kasa_tutari) : "",
                                  paraSahibi: pay.para_sahibi || "",
                                  aciklama: pay.aciklama || "",
                                });
                              }}
                            >
                              Düzenle
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showMusteriDetay && (() => {
          const scopedCustomersList = isSellerRole ? myCustomers : customers;
          const scopedActiveSalesList = isSellerRole ? myActiveSales : activeSales;
          const debtList = scopedCustomersList
            .map((c) => {
              const balance = getCustomerBalance(c.id);
              const unpaidSales = scopedActiveSalesList.filter((s) =>
                s.customer_id === c.id &&
                s.sale_type === "Normal satış" &&
                toNum(s.paid_amount) < toNum(s.total)
              );
              return { name: c.name, balance, unpaidSales };
            })
            .filter((c) => c.balance > 0)
            .sort((a, b) => b.balance - a.balance);
          const total = debtList.reduce((s, c) => s + c.balance, 0);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowMusteriDetay(false)}>
              <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:800,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={(e) => e.stopPropagation()}>
                <div style={{flexShrink:0,padding:"24px 24px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Müşteri Borcu Detayı</h2>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowMusteriDetay(false)}>Kapat</button>
                  </div>
                </div>
                <div style={{overflowY:"auto",padding:"0 24px 24px",flex:1}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Tarih</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Müşteri</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Ürün</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Ad.</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Tutar</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Ödenen</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>Kalan</th>
                    </tr>
                    <tr style={{background:"#fef2f2",borderBottom:"1.5px solid #fecaca"}}>
                      <td style={{padding:"7px 10px",fontWeight:600,position:"sticky",top:33,background:"#fef2f2",zIndex:2}} colSpan={3}>Toplamı ({debtList.length} müşteri)</td>
                      <td style={{position:"sticky",top:33,background:"#fef2f2",zIndex:2}}></td>
                      <td style={{position:"sticky",top:33,background:"#fef2f2",zIndex:2}}></td>
                      <td style={{position:"sticky",top:33,background:"#fef2f2",zIndex:2}}></td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:"#dc2626",position:"sticky",top:33,background:"#fef2f2",zIndex:2}}>{money(total)}</td>
                    </tr>
                  </thead>
                  <tbody>
                    {debtList.flatMap((c) =>
                      c.unpaidSales.map((s) => ({ ...s, customerName: c.name }))
                    )
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((s) => (
                        <tr key={s.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                          <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{toTR(s.created_at)}</td>
                          <td style={{padding:"7px 10px",fontWeight:500}}>{s.customerName}</td>
                          <td style={{padding:"7px 10px"}}>{saleProductName(s)}</td>
                          <td style={{padding:"7px 10px",textAlign:"right"}}>{s.qty}</td>
                          <td style={{padding:"7px 10px",textAlign:"right"}}>{money(s.total)}</td>
                          <td style={{padding:"7px 10px",textAlign:"right",color:"#16a34a"}}>{money(toNum(s.paid_amount))}</td>
                          <td style={{padding:"7px 10px",textAlign:"right",fontWeight:500,color:"#dc2626"}}>{money(toNum(s.total) - toNum(s.paid_amount))}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          );
        })()}

        {showStokDetay && (() => {
          // Her ürün-parti kombinasyonu için stok hesapla
          const rows: {urun: string; parti: string; tur: string; toplam: number; alisF: number}[] = [];
          for (const bi of batchItems) {
            const product = productMap.get(bi.product_id);
            const batch = batchMap.get(bi.batch_id);
            if (!product || product.passive) continue;
            const sold = getBatchSoldQtyForItem(bi);
            const kalan = Math.max(bi.bought - sold, 0);
            if (kalan <= 0) continue;
            const existing = rows.find((r) => r.urun === product.name && r.parti === (batch?.name || "") && r.alisF === bi.buy_price);
            if (existing) {
              existing.toplam += kalan;
            } else {
              rows.push({ urun: product.name, parti: batch?.name || "-", tur: product.gender_category || "-", toplam: kalan, alisF: bi.buy_price });
            }
          }
          const sorted = [...rows].sort((a, b) => {
            const dir = stokSort.dir === "asc" ? 1 : -1;
            if (stokSort.col === "urun") return a.urun.localeCompare(b.urun, "tr") * dir;
            if (stokSort.col === "parti") return a.parti.localeCompare(b.parti, "tr", { numeric: true }) * dir;
            if (stokSort.col === "tur") return a.tur.localeCompare(b.tur, "tr") * dir;
            if (stokSort.col === "toplam") return (a.toplam - b.toplam) * dir;
            if (stokSort.col === "alis") return (a.alisF - b.alisF) * dir;
            return 0;
          });
          const stokTh = (col: string, label: string) => (
            <th key={col} onClick={() => setStokSort((p) => ({col, dir: p.col === col && p.dir === "asc" ? "desc" : "asc"}))}
              style={{padding:"8px 10px",textAlign:["asli","mihri","toplam","alis"].includes(col)?"right":"left",fontWeight:600,color:"#64748b",whiteSpace:"nowrap",cursor:"pointer",userSelect:"none",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>
              {label}{stokSort.col === col ? (stokSort.dir === "asc" ? " ↑" : " ↓") : " ↕"}
            </th>
          );
          const genelToplam = sorted.reduce((s, r) => s + r.toplam, 0);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowStokDetay(false)}>
              <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:900,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={(e) => e.stopPropagation()}>
                <div style={{flexShrink:0,padding:"24px 24px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                    <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Mevcut Stok Detayı</h2>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowStokDetay(false)}>Kapat</button>
                  </div>
                </div>
                <div style={{overflow:"auto",padding:"0 24px 24px",flex:1}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                    <thead>
                      <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                        {stokTh("urun","Ürün Adı")}
                        {stokTh("parti","Parti")}
                        {stokTh("tur","Tür")}
                        {stokTh("toplam","Stok")}
                        {stokTh("alis","Alış Fiyatı")}
                      </tr>
                      <tr style={{background:"#f0fdf4",borderBottom:"1.5px solid #bbf7d0"}}>
                        <td style={{padding:"7px 10px",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}} colSpan={3}>Toplamı ({sorted.length} kalem)</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{genelToplam}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(sorted.reduce((s, r) => s + r.alisF * r.toplam, 0))}</td>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => (
                        <tr key={i} style={{borderBottom:"1px solid #f1f5f9"}}>
                          <td style={{padding:"7px 10px",fontWeight:500}}>{r.urun}</td>
                          <td style={{padding:"7px 10px",color:"#64748b"}}>{r.parti}</td>
                          <td style={{padding:"7px 10px",color:"#64748b"}}>{r.tur}</td>
                          <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600}}>{r.toplam}</td>
                          <td style={{padding:"7px 10px",textAlign:"right"}}>{money(r.alisF)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {showKarDetay && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowKarDetay(false)}>
            <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:900,maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={(e) => e.stopPropagation()}>
              <div style={{flexShrink:0,padding:"24px 24px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Net Kar Detayı</h2>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={exportKarDetayToExcel}>Excel'e Aktar</button>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowKarDetay(false)}>Kapat</button>
                  </div>
                </div>
                {(() => {
                  const eskiDonemTahsilat = karDetay.filter((r) => r.fromPreviousPeriod).reduce((s, r) => s + r.tahsilat, 0);
                  const buDonemTahsilat = karDetay.reduce((s, r) => s + r.tahsilat, 0) - eskiDonemTahsilat;
                  if (eskiDonemTahsilat <= 0) return null;
                  return (
                    <div style={{background:"#fffbeb", borderRadius:12, padding:"8px 12px", marginBottom:12, fontSize:"0.75rem", color:"#92400e"}}>
                      💰 Yukarıdaki toplamın <b>{money(buDonemTahsilat)}</b>'si bu dönemin gerçek tahsilatı, <b>{money(eskiDonemTahsilat)}</b>'si ise önceki dönem(ler)de alınmış ön ödemelerin şimdi satışa dönüşüp kâr hesabına yansımasından geliyor.
                    </div>
                  );
                })()}
              </div>
              <div style={{overflow:"auto",padding:"0 24px 24px",flex:1}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      {["Tarih","Cari","Ürün","Ad.","Satış","Tahsilat","Maliyet","Ek Maliyet","Kar"].map((h) => (
                        <th key={h} style={{padding:"8px 10px",textAlign:h==="Cari"||h==="Ürün"||h==="Tarih"?"left":"right",fontWeight:600,color:"#64748b",whiteSpace:"nowrap",position:"sticky",top:0,background:"#f8fafc",zIndex:2}}>{h}</th>
                      ))}
                    </tr>
                    <tr style={{background:"#f0fdf4",borderBottom:"1.5px solid #bbf7d0"}}>
                      <td style={{padding:"7px 10px",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}} colSpan={5}>Toplamı</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(karDetay.reduce((s,r) => s + r.tahsilat, 0))}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(karDetay.reduce((s,r) => s + r.maliyet, 0))}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(karDetay.reduce((s,r) => s + r.ekMaliyet, 0))}</td>
                      <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:anlıkKar<0?"#dc2626":"#16a34a",position:"sticky",top:33,background:"#f0fdf4",zIndex:2}}>{money(anlıkKar)}</td>
                    </tr>
                  </thead>
                  <tbody>
                    {[...karDetay].sort((a,b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime()).map((row, i) => (
                      <tr key={i} style={{borderBottom:"1px solid #f1f5f9",background:row.saleType==="Hibe"?"#fef9c3":"white"}}>
                        <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>{toTR(row.tarih, true)}</td>
                        <td style={{padding:"7px 10px",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.cari}</td>
                        <td style={{padding:"7px 10px",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.urun} {row.saleType==="Hibe"?<span style={{fontSize:"0.7rem",color:"#92400e"}}>(Hibe)</span>:null}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{row.adet}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{money(row.satisFiyati)}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>
                          {money(row.tahsilat)}
                          {row.fromPreviousPeriod && <span title="Bu tahsilat önceki dönemden alınan ön ödemeden geliyor" style={{marginLeft:4}}>💰</span>}
                        </td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{money(row.maliyet)}</td>
                        <td style={{padding:"7px 10px",textAlign:"right"}}>{row.ekMaliyet > 0 ? money(row.ekMaliyet) : "—"}</td>
                        <td style={{padding:"7px 10px",textAlign:"right",fontWeight:500,color:row.kar<0?"#dc2626":"#16a34a"}}>{money(row.kar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {advancePaymentModal && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setAdvancePaymentModal(null)}>
            <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:420}} onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">Ön Ödeme Ekle</h2>
              <p className="text-sm text-slate-500 mb-4">{customerMap.get(advancePaymentModal.customer_id)?.name} — henüz satışa dönüşmemiş sipariş için alınan ön ödeme. Kasaya işlenir ama satış gerçekleşene kadar tahsilat/kâr hesabına dahil edilmez.</p>
              <div className="space-y-3">
                <div>
                  <label className="label">Tutar (₺)</label>
                  <input className="input" type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="Örn: 1500" autoFocus />
                </div>
                <div>
                  <label className="label">Yöntem</label>
                  <select className="input" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                    <option value="banka">Banka</option>
                    <option value="nakit">Nakit</option>
                  </select>
                </div>
                <div>
                  <label className="label">Not (opsiyonel)</label>
                  <input className="input" value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} placeholder="Örn: Kapora" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" className="btn" disabled={isLoading("advancePayment")} onClick={() => withLoading("advancePayment", addPreorderAdvancePayment)}>{isLoading("advancePayment") ? "..." : "Kaydet"}</button>
                <button type="button" className="btn-secondary" onClick={() => setAdvancePaymentModal(null)}>Vazgeç</button>
              </div>
            </div>
          </div>
        )}

        {convertModal && (() => {
          const { preorder: po, item } = convertModal;
          const customer = customerMap.get(po.customer_id);
          const product = productMap.get(item.product_id);
          const advanceTotal = payments.filter((p) => p.preorder_id === po.id && !p.cancelled).reduce((s, p) => s + Number(p.amount || 0), 0);
          const price = Number(convertPrices[item.id] || 0);
          const saleTotalPreview = price * item.qty;
          const remainderPreview = Math.max(saleTotalPreview - advanceTotal, 0);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
              <div style={{background:"white",borderRadius:"16px",padding:"24px",width:"100%",maxWidth:"400px"}}>
                <h2 className="text-lg font-bold mb-1">Satışa Dönüştür</h2>
                <p className="text-sm text-slate-500 mb-4">{customer?.name} · {product?.name} × {item.qty}</p>
                {advanceTotal > 0 && (
                  <div className="text-sm rounded-lg p-3 mb-3" style={{background:"#fffbeb", color:"#92400e", border:"1px solid #fde68a"}}>
                    💰 Bu siparişe daha önce <b>{money(advanceTotal)}</b> ön ödeme alınmış.
                    {saleTotalPreview > 0 && (
                      <> Satış tutarı <b>{money(saleTotalPreview)}</b> girilirse, kalan <b>{money(remainderPreview)}</b> için aşağıdaki ödeme türü geçerli olur.</>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="label">Birim Fiyat</label>
                    <input className="input" type="number" min="0" placeholder="Birim fiyat" value={convertPrices[item.id] || ""} onChange={(e) => setConvertPrices({ [item.id]: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{advanceTotal > 0 ? "Kalan Tutar İçin Ödeme Türü" : "Ödeme Türü"}</label>
                    <select className="input" value={convertPaid} onChange={(e) => { setConvertPaid(e.target.value); if (e.target.value === "false") setConvertParaSahibi(""); }}>
                      <option value="false">Cari borç</option>
                      <option value="banka">Peşin - Banka alındı</option>
                      <option value="nakit">Peşin - Nakit alındı</option>
                    </select>
                  </div>
                  {(convertPaid === "banka" || convertPaid === "nakit") && (
                    <div>
                      <label className="label">Para kimde? *</label>
                      <select className="input" value={convertParaSahibi} onChange={(e) => setConvertParaSahibi(e.target.value)}>
                        <option value="">Para kimde? *</option>
                        {paraSahibiSecenekleri.map((kisi) => <option key={kisi} value={kisi}>{kisi}</option>)}
                      </select>
                    </div>
                  )}
                  {isSellerRole && (
                    <div>
                      <label className="label">Kendi Karım (₺)</label>
                      <input className="input" type="number" min="0" placeholder="Örn: 200" value={convertSellerProfit} onChange={(e) => setConvertSellerProfit(e.target.value)} />
                    </div>
                  )}
                </div>
                {message && <p className="text-sm text-red-600 mt-2">{message}</p>}
                <div className="flex gap-2 mt-4">
                  <button type="button" className="btn" disabled={isLoading("convertToSales")} onClick={() => withLoading("convertToSales", convertToSales)}>{isLoading("convertToSales") ? "..." : "Satışa Dönüştür"}</button>
                  <button type="button" className="btn-secondary" onClick={() => { setConvertModal(null); setMessage(""); setConvertSellerProfit(""); setConvertParaSahibi(""); }}>Vazgeç</button>
                </div>
              </div>
            </div>
          );
        })()}

        {active === "sales" && (
          <div className="space-y-4">
            <Card title="Yeni Satış Girişi">
              <p className="mb-5 text-slate-500">Satış girebilmek için önce cari kaydı ve ürün kaydı var olmalıdır.</p>
              <div className="grid gap-3 md:grid-cols-4">
                <SearchableSelect
                  placeholder="Cari ara..."
                  value={saleForm.customerId}
                  onChange={(v) => setSaleForm({ ...saleForm, customerId: v })}
                  options={sortedActiveCustomers.map((c) => ({ value: c.id, label: c.name }))}
                />
                <SearchableSelect
                  placeholder="Ürün ara..."
                  value={saleForm.productId}
                  onChange={(v) => setSaleForm({ ...saleForm, productId: v, batchId: "", variant: "ana" })}
                  options={sortedActiveProducts
                    .filter((p) => batchItemsForProduct(p.id).some((i) => i.bought - getBatchSoldQtyForItem(i) > 0))
                    .map((p) => {
                      const anaStok = getProductVariantStock(p.id, "ana");
                      const cepStok = getProductVariantStock(p.id, "cep_boy");
                      return { value: p.id, label: cepStok > 0 ? `${p.name} — Stok:${anaStok} Cep:${cepStok}` : `${p.name} — Stok: ${anaStok}` };
                    })}
                />
                {/* Cep Boy stoğu varsa sor, yoksa hiç gösterme - direkt Asıl Ürün'den satılır */}
                {saleForm.productId && getProductVariantStock(saleForm.productId, "cep_boy") > 0 && (
                  <select
                    className="input"
                    value={saleForm.variant}
                    onChange={(e) => {
                      const v = e.target.value as "ana" | "cep_boy";
                      setSaleForm({ ...saleForm, variant: v, batchId: "", customSalePrice: v === "cep_boy" ? String(CEP_BOY_SATIS_FIYATI) : saleForm.customSalePrice });
                    }}
                  >
                    <option value="ana">Asıl Ürün — Stok: {getProductVariantStock(saleForm.productId, "ana")}</option>
                    <option value="cep_boy">Cep Boy — Stok: {getProductVariantStock(saleForm.productId, "cep_boy")}</option>
                  </select>
                )}
                {/* Parti: seçili varyanta ait birden fazla stoklu parti varsa göster */}
                {saleForm.productId && (() => {
                  const partiler = batchItemsForProduct(saleForm.productId).filter((i) => {
                    const kalan = i.bought - getBatchSoldQtyForItem(i);
                    return kalan > 0 && (i.variant || "ana") === saleForm.variant;
                  });
                  const uniqueBatches = [...new Map(partiler.map((i) => [i.batch_id, i])).values()];
                  if (uniqueBatches.length <= 1) return null;
                  return (
                    <select className="input" value={saleForm.batchId} onChange={(e) => setSaleForm({ ...saleForm, batchId: e.target.value })}>
                      <option value="">Tüm partiler</option>
                      {uniqueBatches.map((item) => (
                        <option key={item.batch_id} value={item.batch_id}>
                          {batchMap.get(item.batch_id)?.name || "-"}
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <input className="input" type="number" min="1" placeholder="Adet" value={saleForm.qty} onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })} />
                {!isSellerRole && (
                  <select className="input" value={saleForm.seller} onChange={(e) => setSaleForm({ ...saleForm, seller: e.target.value as Seller })}><option>Aslı</option><option>Mihrimah</option></select>
                )}
                <select className="input" value={saleForm.saleType} onChange={(e) => {
                  const t = e.target.value as SaleType;
                  setSaleForm({ ...saleForm, saleType: t, customSalePrice: (t === "Fire/Bozuk" || t === "Hibe") ? "0" : saleForm.customSalePrice });
                }}>
                  <option>Normal satış</option><option>Fire/Bozuk</option><option>Hibe</option>
                </select>
                {saleForm.saleType !== "Fire/Bozuk" && saleForm.saleType !== "Hibe" && (
                  <input className="input" type="number" min="0" placeholder="Satış fiyatı" value={saleForm.customSalePrice} onChange={(e) => setSaleForm({ ...saleForm, customSalePrice: e.target.value })} />
                )}
                {isSellerRole && saleForm.saleType !== "Fire/Bozuk" && saleForm.saleType !== "Hibe" && (
                  <input className="input" type="number" min="0" placeholder="Kendi Karım (₺)" value={saleForm.sellerProfit} onChange={(e) => setSaleForm({ ...saleForm, sellerProfit: e.target.value })} />
                )}
                {saleForm.saleType !== "Fire/Bozuk" && saleForm.saleType !== "Hibe" && (
                  <select className="input" value={saleForm.paid} onChange={(e) => setSaleForm({ ...saleForm, paid: e.target.value })}>
                    <option value="false">Cari borç olarak yaz</option>
                    <option value="banka">Ödeme banka alındı</option>
                    <option value="nakit">Ödeme nakit alındı</option>
                  </select>
                )}
                {(saleForm.paid === "banka" || saleForm.paid === "nakit") && (
                  <select className="input" value={saleForm.paraSahibi} onChange={(e) => setSaleForm({ ...saleForm, paraSahibi: e.target.value })}>
                    <option value="">Para kimde? *</option>
                    {paraSahibiSecenekleri.map((kisi) => <option key={kisi} value={kisi}>{kisi}</option>)}
                  </select>
                )}
                {(saleForm.saleType === "Fire/Bozuk" || saleForm.saleType === "Hibe") && (
                  <input className="input" placeholder="Açıklama (zorunlu) *" value={saleForm.note} onChange={(e) => setSaleForm({ ...saleForm, note: e.target.value })} style={{minWidth: 220}} />
                )}
                <button type="button" className="btn" onClick={addSaleFromForm} disabled={saleLoading} style={{opacity: saleLoading ? 0.6 : 1, pointerEvents: saleLoading ? "none" : "auto", cursor: saleLoading ? "not-allowed" : "pointer"}}>{saleLoading ? "Kaydediliyor..." : "Satışı Kaydet"}</button>
              </div>
            </Card>

            <Card title="Satış Listesi">
              <div style={{marginBottom:12, display:"flex", alignItems:"center", gap:8}}>
                <label style={{fontSize:"0.8rem", color:"var(--color-text-secondary)"}}>Durum:</label>
                <select className="input" style={{width:"auto", fontSize:"0.8rem", padding:"4px 10px"}} value={saleStatusFilter} onChange={(e) => setSaleStatusFilter(e.target.value)}>
                  <option>Tümü</option>
                  <option>Peşin</option>
                  <option>Ödendi</option>
                  <option>Cari borç</option>
                  <option>Kısmi</option>
                </select>
                {saleStatusFilter !== "Tümü" && <span style={{fontSize:"0.75rem", color:"var(--color-text-secondary)"}}>{sortedSales.length} kayıt</span>}
              </div>
              <Table
                headers={[
                  salesTh("created_at","Tarih"), salesTh("customer","Müşteri"), salesTh("product","Ürün"), salesTh("batch","Parti"),
                  ...(!isSellerRole ? [salesTh("seller","Satıcı")] : []),
                  salesTh("sale_type","Tip"), salesTh("qty","Adet"), salesTh("total","Tutar"),
                  ...(!isSellerRole ? [salesTh("cost","Maliyet"), salesTh("profit","Kâr/Zarar")] : []),
                  salesTh("status","Durum"), "Not", "İşlem"
                ]}
                rows={sortedSales.map((sale) => {
                  const isEditing = editingSaleId === sale.id;
                  const draft = saleDrafts[sale.id];
                  const draftRequiresNote = isEditing && (draft.sale_type === "Hibe" || draft.sale_type === "Fire/Bozuk");
                  return [
                    toTR(sale.created_at),
                    customerMap.get(sale.customer_id)?.name || "-",
                    saleProductName(sale),
                    batchMap.get(sale.batch_id)?.name || "-",
                    ...(!isSellerRole ? [isEditing ? <select key="seller" className="input" value={draft.seller} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], seller: e.target.value as Seller } }))}><option>Aslı</option><option>Mihrimah</option></select> : (sale.seller_account_id ? (sellerAccountMap.get(sale.seller_account_id)?.name || "Satıcı") : sale.seller)] : []),
                    isEditing ? <select key="type" className="input" value={draft.sale_type} onChange={(e) => { const t = e.target.value as SaleType; setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], sale_type: t, total: (t === "Fire/Bozuk" || t === "Hibe") ? "0" : p[sale.id].total } })); }}><option>Normal satış</option><option>Fire/Bozuk</option><option>Hibe</option></select> : sale.sale_type,
                    isEditing ? <input key="qty" className="input" style={{width:64}} type="number" min="1" value={draft.qty} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], qty: e.target.value } }))} /> : sale.qty,
                    isEditing ? <input key="total" className="input" style={{width:100}} type="number" min="0" value={draft.total} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], total: e.target.value } }))} /> : money(sale.total),
                    ...(!isSellerRole ? [
                      isEditing ? <input key="cost" className="input" style={{width:100}} type="number" min="0" value={draft.cost} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], cost: e.target.value } }))} /> : money(sale.cost),
                      isEditing
                        ? <span key="profit" className={(Number(draft.total||0) - Number(draft.cost||0)) < 0 ? "text-red-600" : ""}>{money(Number(draft.total||0) - Number(draft.cost||0))}</span>
                        : <span key={sale.id} className={sale.total - sale.cost < 0 ? "text-red-600" : ""}>{money(sale.total - sale.cost)}</span>,
                    ] : []),
                    isEditing ? <select key="paid" className="input" value={draft.paid ? "true" : "false"} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], paid: e.target.value === "true" } }))}><option value="false">Cari borç</option><option value="true">Ödendi</option></select> : getSaleStatus(sale),
                    isEditing
                      ? (draftRequiresNote
                          ? <input key="note" className="input" style={{width:150}} placeholder="Açıklama (zorunlu) *" value={draft.note} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], note: e.target.value } }))} />
                          : <span key="note" style={{color:"#cbd5e1"}}>—</span>)
                      : (sale.note
                          ? <button key="note" type="button" className="btn-secondary" style={{fontSize:"0.75rem", padding:"3px 10px"}} onClick={() => setViewingSaleNote(sale)}>Not</button>
                          : <span key="note" style={{color:"#cbd5e1"}}>—</span>),
                    isEditing
                      ? <div key="actions" className="flex gap-2"><button type="button" className="btn" disabled={isLoading(`sale-save-${sale.id}`)} onClick={() => withLoading(`sale-save-${sale.id}`, () => saveSaleEdit(sale.id))}>{isLoading(`sale-save-${sale.id}`) ? "..." : "Kaydet"}</button><button type="button" className="btn-secondary" onClick={() => cancelSaleEdit(sale.id)}>Vazgeç</button></div>
                      : <div key="actions" className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => startSaleEdit(sale)}>Değiştir</button><button type="button" className="btn-danger" disabled={deletingId === sale.id} onClick={() => deleteSale(sale.id)}>{deletingId === sale.id ? "..." : "Sil"}</button></div>,
                  ];
                })}
              />
              {viewingSaleNote && (
                <div
                  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                  onClick={() => setViewingSaleNote(null)}
                >
                  <div
                    style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>
                        {customerMap.get(viewingSaleNote.customer_id)?.name || "-"} — {saleProductName(viewingSaleNote)}
                      </h2>
                      <button type="button" className="btn-secondary" style={{ padding: "4px 12px" }} onClick={() => setViewingSaleNote(null)}>Kapat</button>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>{viewingSaleNote.sale_type}</p>
                    <p style={{ fontSize: "0.9rem", color: "#334155", whiteSpace: "pre-wrap" }}>{viewingSaleNote.note}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {active === "period" && !isSellerRole && (
          <div className="space-y-4">
            <Card title="Dönem Kapanışı">
              <p className="mb-5 text-slate-500">Dağıtım, Kar tablosunun (Net Kar Detayı) dip toplamına + satıcıların bu dönem gerçekleşen kâr paylarına göre yapılır; borcu olan ortağın payı önce borcundan düşülür.</p>
              <div className="mb-5 grid gap-4 text-sm md:grid-cols-5">
                <div className="rounded-xl bg-slate-100 p-4">Toplam tahsilat<br /><b>{money(totals.grossCash)}</b></div>
                {totals.refundIncome > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-300 p-4">Bunun içinde toptancı iadesi<br /><b>{money(totals.refundIncome)}</b></div>
                )}
                <div className="rounded-xl bg-slate-100 p-4">Kasadaki para (bilgi amaçlı)<br /><b>{money(toplamKasaHavuzu)}</b></div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4">Kar tablosu dip toplamı (dağıtılacak)<br /><b>{money(donemKapanisKari)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Aslı payı<br /><b>{money(anlıkKar / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Mihrimah payı<br /><b>{money(anlıkKar / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Müşteri cari<br /><b>{money(totals.customerDebt)}</b></div>
                {sellerAccounts.map((s) => {
                  const tutar = sellerRealizedProfitSinceClose.get(s.id) || 0;
                  if (tutar <= 0) return null;
                  return (
                    <div key={s.id} className="rounded-xl bg-sky-50 border border-sky-200 p-4">{s.name} payı (gerçekleşen kâr)<br /><b>{money(tutar)}</b></div>
                  );
                })}
              </div>
              <button type="button" className="btn" disabled={isLoading("closePeriod")} onClick={() => withLoading("closePeriod", closePeriod)}>{isLoading("closePeriod") ? "Kapatılıyor..." : "Dönemi Kapat ve Mahsuplaştır"}</button>
            </Card>

            <Card title="Dönem Geçmişi">
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.85rem"}}>
                      <thead>
                        <tr style={{background:"#f8fafc", borderBottom:"1.5px solid #e2e8f0"}}>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Dönem</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Dönem Karı</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Toplam Tahsilat</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Aslı Net Ödeme</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Mihri Net Ödeme</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Satıcılar</th>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Durum</th>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Kapanış</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((p) => {
                          const sellerDist = p.seller_distributions || [];
                          const sellerDistTotal = sellerDist.reduce((s, d) => s + Number(d.amount || 0), 0);
                          const isExpanded = expandedSellerDistPeriodId === p.id;
                          return (
                          <Fragment key={p.id}>
                          <tr style={{borderBottom:"1px solid #f1f5f9"}}>
                            <td style={{padding:"10px 12px"}}>{p.name}</td>
                            {(["donem_kari"] as const).map((field) => (
                              <td key={field} style={{padding:"10px 12px", textAlign:"right"}}>
                                {editingNetOdemeId === `${p.id}-${field}` ? (
                                  <div style={{display:"flex", gap:4, justifyContent:"flex-end", alignItems:"center"}}>
                                    <input type="number" className="input" style={{width:90, padding:"3px 8px", fontSize:"0.8rem"}} value={editingNetOdemeVal} onChange={(e) => setEditingNetOdemeVal(e.target.value)} />
                                    <button type="button" className="btn" style={{fontSize:"0.7rem", padding:"3px 10px"}} onClick={async () => {
                                      await supabase.from("periods").update({ [field]: Number(editingNetOdemeVal) || 0 }).eq("id", p.id);
                                      setEditingNetOdemeId(null);
                                      loadAll();
                                    }}>Kaydet</button>
                                    <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"3px 8px"}} onClick={() => setEditingNetOdemeId(null)}>✕</button>
                                  </div>
                                ) : (
                                  <div style={{display:"flex", gap:6, justifyContent:"flex-end", alignItems:"center"}}>
                                    <span>{p[field] ? money(Number(p[field])) : "—"}</span>
                                    <button type="button" className="btn-secondary" style={{fontSize:"0.65rem", padding:"2px 7px"}} onClick={() => { setEditingNetOdemeId(`${p.id}-${field}`); setEditingNetOdemeVal(String(p[field] || "")); }}>Düzenle</button>
                                  </div>
                                )}
                              </td>
                            ))}
                            <td style={{padding:"10px 12px", textAlign:"right", fontWeight:500}}>{money(Number(p.closing_cash || 0))}</td>
                            {(["asli_net_odeme", "mihri_net_odeme"] as const).map((field) => (
                              <td key={field} style={{padding:"10px 12px", textAlign:"right"}}>
                                {editingNetOdemeId === `${p.id}-${field}` ? (
                                  <div style={{display:"flex", gap:4, justifyContent:"flex-end", alignItems:"center"}}>
                                    <input type="number" className="input" style={{width:90, padding:"3px 8px", fontSize:"0.8rem"}} value={editingNetOdemeVal} onChange={(e) => setEditingNetOdemeVal(e.target.value)} />
                                    <button type="button" className="btn" style={{fontSize:"0.7rem", padding:"3px 10px"}} onClick={async () => {
                                      await supabase.from("periods").update({ [field]: Number(editingNetOdemeVal) || 0 }).eq("id", p.id);
                                      setEditingNetOdemeId(null);
                                      loadAll();
                                    }}>Kaydet</button>
                                    <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"3px 8px"}} onClick={() => setEditingNetOdemeId(null)}>✕</button>
                                  </div>
                                ) : (
                                  <div style={{display:"flex", gap:6, justifyContent:"flex-end", alignItems:"center"}}>
                                    <span>{p[field] ? money(p[field]!) : "—"}</span>
                                    <button type="button" className="btn-secondary" style={{fontSize:"0.65rem", padding:"2px 7px"}} onClick={() => { setEditingNetOdemeId(`${p.id}-${field}`); setEditingNetOdemeVal(String(p[field] || "")); }}>Düzenle</button>
                                  </div>
                                )}
                              </td>
                            ))}
                            <td style={{padding:"10px 12px", textAlign:"right"}}>
                              {sellerDist.length > 0 ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{fontSize:"0.75rem", padding:"3px 10px"}}
                                  onClick={() => setExpandedSellerDistPeriodId(isExpanded ? null : p.id)}
                                >
                                  {money(sellerDistTotal)} {isExpanded ? "▲" : "▼"}
                                </button>
                              ) : "—"}
                            </td>
                            <td style={{padding:"10px 12px"}}>{p.closed ? "Kapalı" : "Açık"}</td>
                            <td style={{padding:"10px 12px"}}>{p.closed_at ? new Date(p.closed_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                          </tr>
                          {isExpanded && sellerDist.length > 0 && (
                            <tr style={{borderBottom:"1px solid #f1f5f9", background:"#f8fafc"}}>
                              <td colSpan={8} style={{padding:"10px 12px"}}>
                                <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
                                  {sellerDist.map((d) => (
                                    <span key={d.seller_id} className="rounded-lg bg-white border px-3 py-1.5 text-sm">
                                      <b>{d.name}</b>: {money(d.amount)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
          </div>
        )}
      </section>

      <style jsx global>{`
        .field-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 700; color: #334155; }
        @keyframes loadbar { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .input { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.75rem; background: white; padding: 0.625rem 0.75rem; outline: none; }
        .input:focus { border-color: #0f172a; }
        .btn { border-radius: 0.75rem; background: #0f172a; color: white; padding: 0.625rem 1rem; font-size: 0.875rem; }
        .btn-secondary { border: 1px solid #cbd5e1; border-radius: 0.75rem; background: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .btn-danger { border-radius: 0.75rem; background: #ef4444; color: white; padding: 0.5rem 0.75rem; font-size: 0.875rem; }

        /* ── Product Page Mobile Design ── */
        .product-page { display: flex; flex-direction: column; min-height: 100%; background: #f8fafc; }
        .product-page-header { padding: 20px 16px 4px; }
        .product-page-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .product-search-wrap { padding: 12px 16px 4px; }
        .product-search-inner { display: flex; align-items: center; gap: 10px; background: white; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 10px 14px; }
        .product-search-icon { width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
        .product-search-input { border: none; outline: none; background: transparent; font-size: 0.9375rem; color: #0f172a; width: 100%; }
        .product-search-input::placeholder { color: #94a3b8; }

        .product-list { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px 4px; }
        .product-sort-row { display: flex; align-items: center; gap: 6px; padding: 4px 16px 8px; }
        .product-sort-buttons { display: flex; gap: 6px; flex: 1; }
        .product-sort-btn { font-size: 0.7rem; font-weight: 700; padding: 5px 10px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: white; color: #475569; }
        .product-sort-btn--active { background: #0f172a; color: white; border-color: #0f172a; }
        .product-sort-col { display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 0.625rem; color: #94a3b8; font-weight: 600; background: transparent; border: none; padding: 0; min-width: 44px; }
        .product-sort-col svg { flex-shrink: 0; }
        .product-sort-row > span:last-child { width: 18px; flex-shrink: 0; }

        .product-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; transition: box-shadow 0.15s; }
        .product-card--open { box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-color: #cbd5e1; }

        .product-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 14px 14px 16px; text-align: left; background: transparent; border: none; cursor: pointer; }
        .product-row:active { background: #f8fafc; }
        .product-row-left { flex: 1; min-width: 0; }
        .product-name { font-size: 0.9375rem; font-weight: 700; line-height: 1.3; }
        .product-name--erkek { color: #3b82c4; }
        .product-name--kadin { color: #d6598f; }
        .product-name--unisex { color: #c99a2e; }
        .product-meta { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }

        .product-row-stats { display: flex; gap: 6px; flex-shrink: 0; }
        .product-stat-chip { background: #f1f5f9; border-radius: 10px; padding: 5px 6px; text-align: center; min-width: 44px; }
        .product-stat-chip--low { background: #fff1f2; }
        .product-stat-label { display: block; font-size: 0.625rem; color: #64748b; font-weight: 500; line-height: 1; margin-bottom: 2px; }
        .product-stat-label--stock { color: #dc2626; }
        .product-stat-val { display: block; font-size: 0.875rem; font-weight: 700; color: #0f172a; }
        .product-stat-val--stock { color: #dc2626; }

        .product-chevron { color: #94a3b8; flex-shrink: 0; display: flex; align-items: center; }

        /* Expanded Detail Panel */
        .product-detail { border-top: 1.5px solid #f1f5f9; padding: 16px; background: #fafafa; }
        .product-info-row { display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start; }
        .product-img-box { width: 120px; height: 120px; flex-shrink: 0; border-radius: 14px; overflow: hidden; background: #f1f5f9; }
        .product-img { width: 100%; height: 100%; object-fit: cover; }
        .product-img-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #94a3b8; font-size: 0.7rem; }

        .product-info-chips { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .product-info-chips--sm { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
        .product-info-chip { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
        .product-info-chip--sm { padding: 7px 10px; border-radius: 10px; }
        .product-info-chip-label { font-size: 0.65rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
        .product-info-chip--sm .product-info-chip-label { font-size: 0.6rem; margin-bottom: 2px; }
        .product-info-chip-val { font-size: 0.875rem; font-weight: 700; color: #0f172a; }
        .product-info-chip--sm .product-info-chip-val { font-size: 0.8125rem; }
        .product-info-chip-val--active { color: #16a34a; }
        .product-info-chip-val--passive { color: #dc2626; }

        /* Batch Table */
        .product-batch-section { margin-bottom: 16px; }
        .product-batch-title { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
        .product-batch-table { background: white; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
        .product-batch-thead { display: grid; grid-template-columns: minmax(75px, 1.3fr) 34px 34px 34px 62px 62px minmax(64px, 1fr); padding: 8px 6px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1.5px solid #e2e8f0; align-items: end; }
        .product-batch-thead > div:not(:first-child) { writing-mode: vertical-rl; transform: rotate(180deg); text-align: left; line-height: 1; }
        .product-batch-row { display: grid; grid-template-columns: minmax(75px, 1.3fr) 34px 34px 34px 62px 62px minmax(64px, 1fr); padding: 10px 6px; border-bottom: 1px solid #f1f5f9; font-size: 0.8125rem; }
        .product-batch-row:last-child { border-bottom: none; }
        .product-batch-cell { color: #334155; }
        .product-batch-cell--name { font-weight: 600; color: #0f172a; }
        .product-batch-empty { padding: 12px; font-size: 0.8125rem; color: #94a3b8; text-align: center; }

        @media (max-width: 640px) {
          .product-info-row { flex-direction: column; }
          .product-img-box { width: 100%; height: 180px; }
          .product-info-chips { grid-template-columns: 1fr; }
          .product-info-chips--sm { grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
          .product-batch-table { overflow-x: auto; }
          .product-batch-thead, .product-batch-row { min-width: 400px; }
          .product-row { flex-wrap: wrap; padding: 12px; }
          .product-row-left { flex-basis: 100%; margin-bottom: 6px; }
          .product-row-stats { flex-basis: 100%; justify-content: space-between; }
          .product-stat-chip { flex: 1; min-width: 0; }
          .product-chevron { position: absolute; top: 12px; right: 12px; }
          .product-card { position: relative; }
          .product-sort-row { padding: 4px 6px 8px; }
          .product-list { padding: 12px 6px 4px; }
        }

        /* Action Buttons */
        .product-action-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .product-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 12px; padding: 10px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; border: none; }
        .product-btn--secondary { background: white; color: #334155; border: 1.5px solid #e2e8f0; }
        .product-btn--danger { background: white; color: #dc2626; border: 1.5px solid #fecaca; }

        /* Edit Form */
        .product-edit-form { display: flex; flex-direction: column; gap: 14px; }
        .product-edit-image-row { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
        .product-img-change-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; font-size: 0.8125rem; font-weight: 600; color: #334155; cursor: pointer; background: white; width: 100%; }
        .product-edit-fields { display: grid; gap: 10px; }

        /* Add Button */
        .product-add-wrap { padding: 12px 16px 24px; }
        .product-add-wrap--top { padding: 8px 16px 4px; }
        .product-add-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: #0f172a; color: white; border: none; border-radius: 16px; padding: 16px; font-size: 1rem; font-weight: 700; cursor: pointer; letter-spacing: -0.01em; }
        .product-add-form-panel { padding: 16px; border-top: 1.5px solid #f1f5f9; background: #fafafa; }

        /* Cari tables */
        .stat-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        @media (max-width: 768px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        .cari-sales-thead { display: grid; grid-template-columns: 1.1fr 1.5fr 0.8fr 0.4fr 1fr 0.9fr; gap: 6px; padding: 8px 12px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1.5px solid #e2e8f0; }
        .cari-sales-row { display: grid; grid-template-columns: 1.1fr 1.5fr 0.8fr 0.4fr 1fr 0.9fr; gap: 6px; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
        .cari-sales-row:last-child { border-bottom: none; }
        .cari-pay-thead { display: grid; grid-template-columns: 1fr 1fr auto; padding: 8px 12px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1.5px solid #e2e8f0; }
        .cari-pay-row { display: grid; grid-template-columns: 1fr 1fr auto; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; align-items: center; }
        .cari-pay-row:last-child { border-bottom: none; }
      `}</style>
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) return <main className="p-8">Yükleniyor...</main>;

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="mb-2 text-2xl font-bold">Giriş Yap</h1>
          
          <div className="space-y-3">
            <input className="w-full rounded-xl border p-3 text-slate-900" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full rounded-xl border p-3 text-slate-900" placeholder="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={login} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Giriş Yap</button>
          </div>
        </div>
      </main>
    );
  }

  return <AppContent onLogout={logout} />;
}