"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

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
  created_at: string;
};

type Sale = {
  id: string;
  customer_id: string;
  product_id: string;
  batch_id: string;
  batch_item_id?: string | null;
  seller: Seller;
  sale_type: SaleType;
  qty: number;
  total: number;
  cost: number;
  paid: boolean;
  paid_amount: number;
  payment_method?: "nakit" | "banka" | null;
  seller_account_id?: string | null;
  seller_profit?: number | null;
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

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const getMessageTone = (msg: string): "error" | "success" => {
    const negative = ["yetersiz", "hata", "zorunlu", "olamaz", "olmalı", "silinmedi", "seçin", "girin", "eklemeli", "bulunamadı", "reddedildi", "geçerli", "yok"];
    const lower = msg.toLowerCase();
    return negative.some((w) => lower.includes(w)) ? "error" : "success";
  };
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [sellerAccounts, setSellerAccounts] = useState<SellerAccount[]>([]);
  const [sellerSettlements, setSellerSettlements] = useState<SellerSettlement[]>([]);
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerEmail, setNewSellerEmail] = useState("");
  const [sellerSettlementDrafts, setSellerSettlementDrafts] = useState<Record<string, string>>({});
  const [openSellerId, setOpenSellerId] = useState<string | null>(null);
  const [sellerSalesDetailId, setSellerSalesDetailId] = useState<string | null>(null);

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

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [paymentMethodInputs, setPaymentMethodInputs] = useState<Record<string, string>>({});
  const [editingPaymentNoteId, setEditingPaymentNoteId] = useState<string | null>(null);
  const [paymentNoteDraft, setPaymentNoteDraft] = useState("");
  const [editingPaymentAciklamaId, setEditingPaymentAciklamaId] = useState<string | null>(null);
  const [paymentAciklamaDraft, setPaymentAciklamaDraft] = useState("");
  const [kasaTutariDrafts, setKasaTutariDrafts] = useState<Record<string, string>>({});
  const [editingKasaId, setEditingKasaId] = useState<string | null>(null);
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [openingBalanceDraft, setOpeningBalanceDraft] = useState("");
  const [editingOpeningBalanceNote, setEditingOpeningBalanceNote] = useState(false);
  const [openingBalanceNoteDraft, setOpeningBalanceNoteDraft] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
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
  const [editingNetOdemeVal, setEditingNetOdemeVal] = useState<string>("");
  const [salesSort, setSalesSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "created_at", dir: "desc"});
  const [saleStatusFilter, setSaleStatusFilter] = useState<string>("Tümü");
  const [splitModal, setSplitModal] = useState<{item: BatchItem; newDepo: string} | null>(null);
  const [splitQty, setSplitQty] = useState<string>("");
  const [saleDrafts, setSaleDrafts] = useState<Record<string, { qty: string; total: string; cost: string; seller: Seller; sale_type: SaleType; paid: boolean }>>({});
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, Partial<Product>>>({});
  const pendingImageRef = useRef<Record<string, string>>({});
  const [salesModalProductId, setSalesModalProductId] = useState<string | null>(null);
  const [customerDrafts, setCustomerDrafts] = useState<Record<string, Partial<Customer>>>({});
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ name: "", genderCategory: "Kadın" as GenderCategory, image: "" });
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [batchReportFilter, setBatchReportFilter] = useState("Tümü");
  const [batchReportSort, setBatchReportSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "batch", dir: "asc"});
  const [batchForm, setBatchForm] = useState({ batchId: "", productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Stok" });
  const [saleForm, setSaleForm] = useState({ customerId: "", productId: "", batchId: "", qty: "1", seller: "Aslı" as Seller, saleType: "Normal satış" as SaleType, paid: "false", customSalePrice: "", depo: "Stok", sellerProfit: "" });
  const [periodForm, setPeriodForm] = useState({ name: `Dönem ${today()}`, sponsor: "0", asli: "0", mihrimah: "0", productCost: "0", shippingCost: "0" });

  const activeSales = sales.filter((sale) => !sale.cancelled);
  const activePayments = payments.filter((payment) => !payment.cancelled);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
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
    return null;
  };

  const recalcBatchFormBuyPrice = (productId: string, batchId: string) => {
    const product = productMap.get(productId);
    const batch = batchMap.get(batchId);
    if (!product || !batch) return;
    const usdPrice = getUsdPriceForBatch(product, batch);
    if (usdPrice === null || !batch.usd_kuru) return;
    const computed = Math.round(usdPrice * batch.usd_kuru * 100) / 100;
    setBatchForm((prev) => ({ ...prev, buyPrice: String(computed) }));
  };

  useEffect(() => {
    if (!batchForm.productId || !batchForm.batchId) return;
    recalcBatchFormBuyPrice(batchForm.productId, batchForm.batchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchForm.productId, batchForm.batchId, products, batches]);

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
    setMessage(msg);
  };

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email || "";
      setCurrentUserEmail(email);
      const defaultDepo = email.includes("mihrimah") ? "Stok" : "Stok";
      const defaultSeller: Seller = email.includes("mihrimah") ? "Mihrimah" : "Aslı";
      setSaleForm((prev) => ({ ...prev, depo: defaultDepo, seller: defaultSeller }));
      setBatchForm((prev) => ({ ...prev, depo: defaultDepo }));

      const [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes, preordersRes, preorderItemsRes, paymentAllocationsRes, suppliersRes, supplierReturnsRes, sellerAccountsRes, sellerSettlementsRes] = await Promise.all([
        supabase.from("products").select("id,name,code,gender_category,image_url,passive,usd_fiyat_tyuksel,usd_fiyat_thasan,manual_price").order("created_at", { ascending: true }),
        supabase.from("customers").select("*").order("created_at", { ascending: true }),
        supabase.from("batches").select("*").order("created_at", { ascending: true }),
        supabase.from("batch_items").select("*").order("created_at", { ascending: true }),
        supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
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
      ]);

      for (const res of [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes, suppliersRes, supplierReturnsRes, sellerAccountsRes, sellerSettlementsRes]) {
        if (res.error) throw res.error;
      }

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
      setCostInputs((prev) => ({ ...inputs, ...prev }));
    } catch (err) {
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
    // First try exact match by batch_item_id (new sales)
    const byItemId = activeSales.filter((s) => s.batch_item_id === item.id).reduce((sum, s) => sum + s.qty, 0);
    // Also count sales without batch_item_id (old sales) using old batch_id method
    const oldSales = activeSales.filter((s) => !s.batch_item_id && s.product_id === item.product_id && s.batch_id === item.batch_id);
    if (oldSales.length === 0) return byItemId;
    // For old sales, distribute among siblings proportionally (greedy by bought desc)
    const siblings = batchItems.filter((i) => i.product_id === item.product_id && i.batch_id === item.batch_id);
    const oldTotal = oldSales.reduce((sum, s) => sum + s.qty, 0);
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
  const getProductSoldQty = (productId: string) => activeSales.filter((sale) => sale.product_id === productId).reduce((sum, sale) => sum + sale.qty, 0);
  const getProductStock = (productId: string) => getProductTotalBought(productId) - getProductSoldQty(productId);
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
  // Birim ek maliyet artık manuel girilmiyor: Parti Maliyet Kaydı'ndaki Kargo tutarı,
  // o partideki toplam alınan adede bölünerek otomatik hesaplanır.
  const getEkMaliyet = (batchId: string) => {
    const cost = batchCosts.find((c) => c.batch_id === batchId);
    const kargo = Number(cost?.kargo || 0);
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
          urun: productMap.get(sale.product_id)?.name || "-",
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
    return { revenue, profit, customerDebt, stockValue, totalStock, grossCash, distributedCash, cash, recentPayments, refundIncome, openingBalance, openingBalancePeriodId, openingBalanceNote, pendingAdvanceTotal, pastPendingAdvanceTotal };
  }, [products, customers, myCustomers, batchItems, activeSales, myActiveSales, activePayments, myActivePayments, periods, supplierReturns, preorderMap, isSellerRole]);


  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return sortedCustomers;
    return sortedCustomers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [sortedCustomers, customerSearch]);

  const recentMovements = useMemo(() => {
    const scopedActiveSales = isSellerRole ? myActiveSales : activeSales;
    const scopedActivePayments = isSellerRole ? myActivePayments : activePayments;
    const shortUser = (email?: string, seller?: string) => {
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
        detail: `${productMap.get(sale.product_id)?.name || "-"} / ${batchMap.get(sale.batch_id)?.name || "-"} / ${sale.qty} adet${methodSuffix}`,
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
    });
    if (error) return showError(error);
    await logAction("Ürün eklendi", "products", name, { code });
    setNewProduct({ name: "", genderCategory: "Kadın", image: "" });
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

  const getSellerSummary = (sellerId: string) => {
    const sellerSales = activeSales.filter((s) => s.seller_account_id === sellerId);
    const sellerSaleIds = new Set(sellerSales.map((s) => s.id));
    const sellerCustomerIds = new Set(customers.filter((c) => c.seller_account_id === sellerId).map((c) => c.id));
    const totalSatis = sellerSales.reduce((sum, s) => sum + toNum(s.total), 0);
    const totalKarPayi = sellerSales.reduce((sum, s) => sum + Number(s.seller_profit || 0), 0);
    // Satışın sadece FİİLEN TAHSİL EDİLMİŞ kısmı satıcının elinde olabilir - bu yüzden
    // "bize borç" ve "gerçekleşen kâr" tam satış tutarı üzerinden değil, her tahsilatın
    // (payment_allocations) o satışa düşen oranı üzerinden hesaplanır (anlıkKar/karDetay
    // ile aynı yöntem, satır ~810-880).
    const saleMap = new Map(sellerSales.map((s) => [s.id, s]));
    const sellerAllocs = paymentAllocations.filter((a) => sellerSaleIds.has(a.sale_id));
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
    const totalTeslimEdilen = sellerSettlements.filter((se) => se.seller_account_id === sellerId).reduce((sum, se) => sum + Number(se.amount || 0), 0);
    const cariBorcu = customers.filter((c) => sellerCustomerIds.has(c.id)).reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const totalTahsilat = activePayments.filter((p) => p.seller_account_id === sellerId).reduce((sum, p) => sum + toNum(p.amount), 0);
    // Size Kalan Borç = Tahsilat - Gerçekleşen Kâr Payı
    const kalanBorc = Math.max(totalTahsilat - gerceklesenKarPayi, 0);
    const kasaTutari = activePayments.filter((p) => p.seller_account_id === sellerId).reduce((sum, p) => sum + Number(p.kasa_tutari ?? p.amount ?? 0), 0);
    return { totalSatis, totalKarPayi, gerceklesenKarPayi, totalBizeBorc: totalBizeBorcOrantili, totalTeslimEdilen, kalanBorc, cariBorcu, totalTahsilat, kasaTutari };
  };

  const recordSellerSettlement = async (sellerId: string, amount: number, note: string) => {
    if (!amount || amount <= 0) return setMessage("Geçerli bir tutar girin.");
    const { error } = await supabase.from("seller_settlements").insert({ seller_account_id: sellerId, amount, note: note || null, created_by: currentUserEmail });
    if (error) return showError(error);
    await logAction("Satıcı teslimatı kaydedildi", "seller_settlements", sellerAccountMap.get(sellerId)?.name || sellerId, { tutar: amount });
    setMessage(`${money(amount)} teslimat kaydedildi.`);
    loadAll();
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
    });
    if (error) return showError(error);
    await logAction("Partiye ürün eklendi", "batch_items", `${productMap.get(productId)?.name || productId} / ${batchMap.get(batchId)?.name || batchId}`, { adet: bought, alis: buyPrice, satis: salePrice, depo: batchForm.depo });
    setBatchForm({ batchId, productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Stok" });
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
    const { error } = await supabase.from("batch_items").delete().eq("id", item.id);
    if (error) return showError(error);
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
    // Depo bazlı stok kontrolü
    const depoStock = batchItemsForProduct(product.id)
      .filter((i) => i.depo === saleForm.depo)
      .reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
    if (depoStock < qty) return setMessage(`Yetersiz stok. ${saleForm.depo} deposunda bu üründen sadece ${depoStock} adet var.`);

    let remainingQty = qty;
    const rows: Record<string, unknown>[] = [];

    // Filter by depo and batch if selected - strictly match depo
    const availableItems = batchItemsForProduct(product.id).filter((item) => {
      const matchDepo = saleForm.depo ? item.depo === saleForm.depo : true;
      const matchBatch = !saleForm.batchId || item.batch_id === saleForm.batchId;
      return matchDepo && matchBatch;
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
        seller: saleForm.seller,
        sale_type: saleForm.saleType,
        qty: take,
        total: totalPrice,
        cost: item.buy_price * take + rowSellerProfit,
        paid: isPaid,
        paid_amount: isPaid ? totalPrice : 0,
        payment_method: (saleForm.paid === "banka" || saleForm.paid === "nakit") ? saleForm.paid : null,
        seller_account_id: currentSellerAccount?.id || null,
        seller_profit: isSellerRole ? rowSellerProfit : null,
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
          .insert({ customer_id: customer.id, amount: totalAmount, user_email: currentUserEmail, cancelled: false, payment_method: saleForm.paid === "nakit" ? "nakit" : "banka", kasa_tutari: totalAmount, seller_account_id: currentSellerAccount?.id || null })
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

    await logAction("Satış eklendi", "sales", `${customer.name} - ${product.name}`, { adet: qty, toplam: rows.reduce((sum, row) => sum + Number(row.total || 0), 0), satir_sayisi: rows.length });
    setSaleForm((prev) => ({ customerId: "", productId: "", batchId: "", qty: "1", seller: prev.seller, saleType: "Normal satış", paid: "false", customSalePrice: "", depo: prev.depo, sellerProfit: "" }));
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
    await logAction("Satış iptal edildi", "sales", sale ? `${customerMap.get(sale.customer_id)?.name || sale.customer_id} - ${productMap.get(sale.product_id)?.name || sale.product_id}` : saleId, { tutar: sale?.total || 0 });
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
    const saleEntityName = oldSale ? `${customerMap.get(oldSale.customer_id)?.name || oldSale.customer_id} - ${productMap.get(oldSale.product_id)?.name || oldSale.product_id}` : saleId;
    await logAction("Satış değiştirildi", "sales", saleEntityName, diffOf(oldSale as unknown as Record<string, unknown>, dbPatch));
    loadAll();
  };

  const startSaleEdit = (sale: Sale) => {
    setSaleDrafts((prev) => ({
      ...prev,
      [sale.id]: { qty: String(sale.qty), total: String(sale.total), cost: String(sale.cost), seller: sale.seller, sale_type: sale.sale_type, paid: sale.paid },
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
    await updateSale(saleId, {
      qty: newQty,
      total: Number(draft.total || 0),
      cost: Number(draft.cost || 0),
      seller: draft.seller,
      sale_type: draft.sale_type,
      paid: draft.paid,
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
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount, user_email: userEmail, payment_method: method, kasa_tutari: amount, seller_account_id: currentSellerAccount?.id || null });
    if (error) return showError(error);
    try {
      await allocatePaymentsForCustomer(customerId);
    } catch (err) {
      return showError(err);
    }
    await logAction("Ödeme eklendi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: amount, yontem: method === "nakit" ? "Nakit" : "Banka" });
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
    loadAll();
    } finally {
      setPaymentLoading(null);
    }
  };

  const savePaymentNote = async (paymentId: string) => {
    const note = paymentNoteDraft.trim();
    const oldPayment = payments.find((p) => p.id === paymentId);
    const { error } = await supabase.from("payments").update({ note: note || null }).eq("id", paymentId);
    if (error) return showError(error);
    setPayments((prev) => prev.map((p) => p.id === paymentId ? { ...p, note: note || null } : p));
    await logAction("Tahsilat notu güncellendi", "payments", oldPayment ? (customerMap.get(oldPayment.customer_id)?.name || paymentId) : paymentId, diffOf({ not: oldPayment?.note || "" }, { not: note }));
    setEditingPaymentNoteId(null);
    setPaymentNoteDraft("");
  };

  const savePaymentAciklama = async (paymentId: string) => {
    const aciklama = paymentAciklamaDraft.trim();
    const oldPayment = payments.find((p) => p.id === paymentId);
    const { error } = await supabase.from("payments").update({ aciklama: aciklama || null }).eq("id", paymentId);
    if (error) return showError(error);
    setPayments((prev) => prev.map((p) => p.id === paymentId ? { ...p, aciklama: aciklama || null } : p));
    await logAction("Tahsilat açıklaması güncellendi", "payments", oldPayment ? (customerMap.get(oldPayment.customer_id)?.name || paymentId) : paymentId, diffOf({ aciklama: oldPayment?.aciklama || "" }, { aciklama }));
    setEditingPaymentAciklamaId(null);
    setPaymentAciklamaDraft("");
  };

  const saveKasaTutari = async (paymentId: string) => {
    const raw = kasaTutariDrafts[paymentId];
    const value = raw === undefined || raw === "" ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) return setMessage("Geçerli bir tutar girin.");
    const oldPayment = payments.find((p) => p.id === paymentId);
    const { error } = await supabase.from("payments").update({ kasa_tutari: value }).eq("id", paymentId);
    if (error) return showError(error);
    setPayments((prev) => prev.map((p) => p.id === paymentId ? { ...p, kasa_tutari: value } : p));
    await logAction("Tahsilat kasa tutarı güncellendi", "payments", oldPayment ? (customerMap.get(oldPayment.customer_id)?.name || paymentId) : paymentId, diffOf({ kasa_tutari: oldPayment?.kasa_tutari ?? null }, { kasa_tutari: value }));
    setEditingKasaId(null);
    setKasaTutariDrafts((prev) => { const n = { ...prev }; delete n[paymentId]; return n; });
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
    setConvertModal({ preorder: po, item });
  };

  const addPreorderAdvancePayment = async () => {
    if (!advancePaymentModal) return;
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) return setMessage("Geçerli bir tutar girin.");
    const method = advanceMethod === "nakit" ? "nakit" : "banka";
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
    const product = productMap.get(item.product_id);
    if (!product) return;
    const seller: Seller = currentUserEmail.includes("mihrimah") ? "Mihrimah" : "Aslı";
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
        .insert({ customer_id: po.customer_id, amount: remainder, user_email: currentUserEmail, payment_method: paymentMethod, kasa_tutari: remainder, seller_account_id: currentSellerAccount?.id || null })
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
    rows.push(["Tarih", "Cari", "Ekleyen", "Yöntem", "Tutar", "Not", "Kasa", "Açıklama"]);

    if (!isSellerRole && totals.openingBalance !== 0) {
      rows.push([
        "Dönem Başlangıç Kasa Bakiyesi (önceki dönemden devir)", "", "", "",
        "",
        "",
        Number(totals.openingBalance),
        totals.openingBalanceNote || "",
      ]);
    }

    [...totals.recentPayments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((pay) => {
        rows.push([
          toTR(pay.created_at, true),
          customerMap.get(pay.customer_id)?.name || "-",
          pay.user_email?.split("@")[0] || "-",
          pay.payment_method === "nakit" ? "Nakit" : pay.payment_method === "banka" ? "Banka" : "-",
          Number(pay.amount),
          pay.note || "",
          pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? Number(pay.kasa_tutari) : "",
          pay.aciklama || "",
        ]);
      });

    const kasaToplam = totals.recentPayments.reduce((s, p) => s + Number(p.kasa_tutari || 0), 0) + (isSellerRole ? 0 : totals.openingBalance);
    rows.push(["Toplam", "", "", "", Number(totals.grossCash), "", kasaToplam, ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 17 }, { wch: 26 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 34 }];
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
    const distributableProfit = Math.round(anlıkKar * 100) / 100;
    if (!Number.isFinite(distributableProfit)) {
      window.alert("Kar hesabında geçersiz bir değer var (NaN), dönem kapatılamadı. Lütfen ek maliyet ve satış kayıtlarını kontrol edin.");
      setMessage("Kar hesabında geçersiz bir değer var (NaN), dönem kapatılamadı. Lütfen ek maliyet ve satış kayıtlarını kontrol edin.");
      return;
    }
    if (distributableProfit <= 0) {
      window.alert(`Kar tablosuna göre dağıtılacak kar yok. (Hesaplanan: ${money(distributableProfit)})`);
      setMessage("Kar tablosuna göre dağıtılacak kar yok.");
      return;
    }

    const half = distributableProfit / 2;
    const closedAt = new Date().toISOString();
    const asli = partners.find((p) => p.partner_name === "Aslı");
    const mihrimah = partners.find((p) => p.partner_name === "Mihrimah");
    const updates = [];

    if (asli) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(asli.debt - half, 0), profit_share: asli.profit_share + half }).eq("id", asli.id));
    if (mihrimah) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(mihrimah.debt - half, 0), profit_share: mihrimah.profit_share + half }).eq("id", mihrimah.id));

    // Kasada fiilen olan para ile dağıtılan kar arasındaki fark (dağıtılmayan/devreden kasa)
    const devirBakiyesi = Math.round((Number(totals.cash || 0) - distributableProfit) * 100) / 100;

    const openPeriod = periods.find((p) => !p.closed);
    const periodPayload = {
      closed: true,
      closed_at: closedAt,
      closing_cash: Number(totals.cash || 0),
      asli_distribution: half,
      mihrimah_distribution: half,
      donem_kari: distributableProfit,
      devir_bakiyesi: devirBakiyesi,
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
    await logAction("Dönem kapatıldı", "periods", openPeriod?.name || `Kapanış ${today()}`, { dagitilan_kar: distributableProfit, asli_payi: half, mihrimah_payi: half, devir_bakiyesi: devirBakiyesi });
    window.alert(`Dönem kapatıldı.\n${money(distributableProfit)} kar Aslı ve Mihrimah arasında %50/%50 dağıtıldı.\nAslı payı: ${money(half)}\nMihrimah payı: ${money(half)}${devirBakiyesi !== 0 ? `\n\nKasada dağıtılmayan ${money(devirBakiyesi)} bir sonraki döneme devir bakiyesi olarak taşınacak.` : ""}`);
    setMessage(`Dönem kapatıldı; ${money(distributableProfit)} kar Aslı ve Mihrimah arasında %50/%50 dağıtıldı.`);
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
    ["batchEntry", "Parti/Ürün Girişi"],
    ["returns", "Toptancı İadeleri"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
    ["partners", "Parti Maliyet Kaydı"],
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
            <button type="button" onClick={() => setMessage("")} style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1, opacity: 0.6 }}>
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
                    <a href="/galeri" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{fontSize:"0.8rem", padding:"6px 12px", textDecoration:"none"}}>🔗 Paylaşım Linki</a>
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
                                    <div className="product-info-chip-label">T-Yüksel ($)</div>
                                    <input
                                      className="input"
                                      style={{ width: 80, fontSize: "0.85rem", padding: "3px 6px" }}
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
                                    <div className="product-info-chip-label">T-Hasan ($)</div>
                                    <input
                                      className="input"
                                      style={{ width: 80, fontSize: "0.85rem", padding: "3px 6px" }}
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
                const groupProducts = sortedProducts.filter((p) => !p.passive && p.gender_category === g.gender && p.image_url);
                if (!groupProducts.length) return null;
                return (
                  <div key={g.gender} style={{marginBottom: 32}}>
                    <div style={{fontSize:"0.75rem", fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, paddingBottom:6, borderBottom:"1.5px solid var(--color-border-tertiary)"}}>
                      {g.label} — {groupProducts.length} ürün
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
                      {groupProducts.map((p) => (
                        <div key={p.id} style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                          <div style={{width:"100%", aspectRatio:"1/1", borderRadius:10, overflow:"hidden", background:"#f8fafc", border:"1px solid #e2e8f0", cursor:"pointer"}}
                            onClick={() => setLightboxImg(p.image_url)}>
                            <img src={p.image_url!} alt={p.name} style={{width:"100%", height:"100%", objectFit:"cover"}} />
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

        {active === "batchEntry" && (
          <div className="space-y-4">
            <Card title="Parti Bazlı Ürün Girişi">
              <p className="mb-5 text-slate-500">Önce kaynak ürün ve parti adı oluşturulur. Sonra partiye ürün, adet, alış fiyatı ve hedef satış fiyatı girilir.</p>
              <div className="mb-5 flex flex-wrap gap-3">
                <input className="input max-w-sm" placeholder="Yeni parti adı" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} />
                <select className="input max-w-xs" value={newBatchSupplierId} onChange={(e) => setNewBatchSupplierId(e.target.value)}>
                  <option value="">Toptancı seçin (opsiyonel)</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" className="btn-secondary" onClick={addBatchName}>Parti Adı Ekle</button>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
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
              </div>
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
                <input className="input" type="number" placeholder="Toplam sipariş/adet" value={batchForm.bought} onChange={(e) => setBatchForm({ ...batchForm, bought: e.target.value })} />
                <input className="input" type="number" placeholder="Alış fiyatı (otomatik hesaplanır, isterseniz değiştirin)" value={batchForm.buyPrice} onChange={(e) => setBatchForm({ ...batchForm, buyPrice: e.target.value })} />
                <input className="input" type="number" placeholder="Hedef satış fiyatı" value={batchForm.salePrice} onChange={(e) => setBatchForm({ ...batchForm, salePrice: e.target.value })} />
                <button type="button" className="btn" onClick={addBatchProduct}>Partiye Ürün Ekle</button>
              </div>
              {batchForm.batchId && batchForm.productId && (() => {
                const batch = batchMap.get(batchForm.batchId);
                const product = productMap.get(batchForm.productId);
                const supplier = batch?.supplier_id ? supplierMap.get(batch.supplier_id) : null;
                if (!batch?.supplier_id) return <p className="mt-2 text-sm text-red-600">⚠️ Bu partiye henüz toptancı atanmamış. Önce "Parti Maliyet Kaydı" ekranından bu partinin toptancısını ve USD kurunu girin.</p>;
                if (!batch?.usd_kuru) return <p className="mt-2 text-sm text-red-600">⚠️ Bu partiye henüz USD kuru girilmemiş. Önce "Parti Maliyet Kaydı" ekranından USD kurunu girin.</p>;
                const usdPrice = product ? getUsdPriceForBatch(product, batch) : null;
                if (usdPrice === null) return <p className="mt-2 text-sm text-red-600">⚠️ "{product?.name}" ürününde "{supplier?.name}" için USD fiyatı girilmemiş. Önce ürün kartından bu alanı doldurun.</p>;
                return <p className="mt-2 text-sm text-emerald-600">✓ {supplier?.name}: ${usdPrice} × {batch.usd_kuru} kur = {money(Math.round(usdPrice * batch.usd_kuru * 100) / 100)} olarak hesaplandı.</p>;
              })()}
            </Card>

            <Card title="Parti Bazlı Ürün / Stok Raporu">
              <div className="mb-5 flex items-center gap-2">
                <select className="input flex-1" value={batchReportFilter} onChange={(e) => setBatchReportFilter(e.target.value)}>
                  <option value="Tümü">Tüm Partiler</option>
                  {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </select>

              {(() => {
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

              {(() => {
                const handleBRSort = (col: string) => setBatchReportSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
                const brArr = (col: string) => batchReportSort.col === col ? (batchReportSort.dir === "asc" ? " ▲" : " ▼") : " ↕";
                const brTh = (col: string, label: string) => (
                  <button type="button" onClick={() => handleBRSort(col)} style={{fontWeight:700,background:"none",border:"none",cursor:"pointer",padding:0,whiteSpace:"nowrap"}}>{label}{brArr(col)}</button>
                );
                const filteredItems = batchItems.filter((item) => batchReportFilter === "Tümü" || item.batch_id === batchReportFilter);
                const sortedItems = [...filteredItems].sort((a, b) => {
                  let av: string|number = "", bv: string|number = "";
                  if (batchReportSort.col === "batch") { av = batchMap.get(a.batch_id)?.name||""; bv = batchMap.get(b.batch_id)?.name||""; }
                  else if (batchReportSort.col === "depo") { av = a.depo||""; bv = b.depo||""; }
                  else if (batchReportSort.col === "product") { av = productMap.get(a.product_id)?.name||""; bv = productMap.get(b.product_id)?.name||""; }
                  else if (batchReportSort.col === "bought") { av = a.bought; bv = b.bought; }
                  else if (batchReportSort.col === "sold") { av = getBatchSoldQtyForItem(a); bv = getBatchSoldQtyForItem(b); }
                  else if (batchReportSort.col === "kalan") { av = a.bought - getBatchSoldQtyForItem(a); bv = b.bought - getBatchSoldQtyForItem(b); }
                  else if (batchReportSort.col === "buy_price") { av = a.buy_price; bv = b.buy_price; }
                  else if (batchReportSort.col === "sale_price") { av = a.sale_price; bv = b.sale_price; }
                  const cmp = typeof av === "number" ? av-(bv as number) : String(av).localeCompare(String(bv),"tr",{numeric:true});
                  return batchReportSort.dir === "asc" ? cmp : -cmp;
                });
                return (
                  <Table
                    headers={[brTh("batch","Parti"), brTh("product","Ürün"), brTh("bought","Alınan"), brTh("sold","Satılan"), brTh("kalan","Kalan"), brTh("buy_price","Alış"), brTh("sale_price","Satış"), "İşlem"]}
                    rows={sortedItems.map((item) => {
                      const key = item.id;
                      const p = productMap.get(item.product_id);
                      return [
                        editingBatchItemId === key ? (
                          <select className="input" value={item.batch_id} onChange={(e) => updateBatchItem(item.id, { batch_id: e.target.value })}>
                            {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                          </select>
                        ) : batchMap.get(item.batch_id)?.name || "-",
                        p?.name || "-",
                        editingBatchItemId === key ? <input className="input w-24" type="number" value={item.bought} onChange={(e) => updateBatchItem(item.id, { bought: Number(e.target.value || 0) })} /> : item.bought,
                        getBatchSoldQtyForItem(item),
                        item.bought - getBatchSoldQtyForItem(item),
                        editingBatchItemId === key ? <input className="input w-24" type="number" value={item.buy_price} onChange={(e) => updateBatchItem(item.id, { buy_price: Number(e.target.value || 0) })} /> : money(item.buy_price),
                        editingBatchItemId === key ? <input className="input w-24" type="number" value={item.sale_price} onChange={(e) => updateBatchItem(item.id, { sale_price: Number(e.target.value || 0) })} /> : money(item.sale_price),
                        <div key={key} className="flex gap-2">
                          <button type="button" className="btn-secondary" onClick={() => setEditingBatchItemId(editingBatchItemId === key ? null : key)}>Değiştir</button>
                          <button type="button" className="btn-danger" onClick={() => deleteBatchItem(item)}>Sil</button>
                        </div>,
                      ];
                    })}
                  />
                );
              })()}
            </Card>
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

        {active === "sellers" && (
          <div className="space-y-4">
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
                          <button type="button" className="btn-secondary" style={{fontSize:"0.75rem"}} onClick={() => toggleSellerActive(seller)}>
                            {seller.active ? "Pasif Et" : "Aktif Et"}
                          </button>
                        </div>
                        <div className="grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Satış</div><b>{money(summary.totalSatis)}</b></div>
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Tahsilat</div><b>{money(summary.totalTahsilat)}</b></div>
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Cari Borcu</div><b>{money(summary.cariBorcu)}</b></div>
                          <div className="rounded-lg bg-emerald-50 p-2"><div className="text-xs text-slate-500">Kâr Payı (Toplam)</div><b>{money(summary.totalKarPayi)}</b></div>
                          <div className="rounded-lg bg-emerald-50 p-2"><div className="text-xs text-slate-500">Gerçekleşen Kâr</div><b>{money(summary.gerceklesenKarPayi)}</b></div>
                          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Satıcı Kasası</div><b>{money(summary.kasaTutari)}</b></div>
                          <div className="rounded-lg bg-amber-50 p-2"><div className="text-xs text-slate-500">Size Kalan Borç</div><b style={{color: summary.kalanBorc > 0 ? "#b45309" : "#16a34a"}}>{money(summary.kalanBorc)}</b></div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            className="input"
                            style={{width: 140}}
                            type="number"
                            placeholder="Teslim alınan ₺"
                            value={sellerSettlementDrafts[seller.id] || ""}
                            onChange={(e) => setSellerSettlementDrafts({ ...sellerSettlementDrafts, [seller.id]: e.target.value })}
                          />
                          <button
                            type="button"
                            className="btn"
                            style={{fontSize:"0.8rem"}}
                            onClick={() => {
                              recordSellerSettlement(seller.id, Number(sellerSettlementDrafts[seller.id] || 0), "");
                              setSellerSettlementDrafts({ ...sellerSettlementDrafts, [seller.id]: "" });
                            }}
                          >
                            Teslimat Kaydet
                          </button>
                          <span className="text-xs text-slate-400">Satıcı size nakit/havale teslim ettiğinde buraya tutarı girip kaydet, borcundan düşer.</span>
                        </div>
                        <div className="mt-3">
                          <button type="button" className="btn-secondary" style={{fontSize:"0.8rem"}} onClick={() => setSellerSalesDetailId(seller.id)}>
                            Satış Detayları
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
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
                      headers={["Tarih", "Müşteri", "Ürün", "Adet", "Toplam", "Kâr Payı", "Ödendi mi"]}
                      rows={sellerSales.map((s) => [
                        toTR(s.created_at, true),
                        customerMap.get(s.customer_id)?.name || "-",
                        productMap.get(s.product_id)?.name || "-",
                        s.qty,
                        money(s.total),
                        money(Number(s.seller_profit || 0)),
                        s.paid ? "Evet" : "Hayır",
                      ])}
                    />
                    {sellerSales.length === 0 && <p className="mt-2 text-sm text-slate-500">Bu satıcıya ait satış bulunamadı.</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

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
                                    <div className="product-batch-cell product-batch-cell--name" style={{fontSize:"0.68rem"}}>{productMap.get(sale.product_id)?.name || "-"}</div>
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
            <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:1180,maxHeight:"90vh",overflowY:"auto"}} onClick={(e) => e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Dönem Tahsilatları Detayı</h2>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:"0.85rem",color:"#64748b"}}>{totals.recentPayments.length} ödeme · Toplam: <strong>{money(totals.grossCash)}</strong></span>
                  <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={exportTahsilatToExcel}>Excel'e Aktar</button>
                  <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowTahsilatDetay(false)}>Kapat</button>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Tarih</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Cari</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Ekleyen</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Yöntem</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b"}}>Tutar</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Not</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Kasa</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!isSellerRole && totals.openingBalancePeriodId && (
                      <tr style={{borderBottom:"1px solid #f1f5f9", background:"#fffbeb"}}>
                        <td style={{padding:"7px 10px", color:"#92400e", fontWeight:600}} colSpan={4}>Dönem Başlangıç Kasa Bakiyesi (önceki dönemden devir)</td>
                        <td style={{padding:"7px 10px",textAlign:"right",color:"#cbd5e1"}}>—</td>
                        <td></td>
                        <td style={{padding:"7px 10px",fontWeight:700, color:"#92400e"}}>
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
                              <span>{money(totals.openingBalance)}</span>
                              <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingOpeningBalance(true); setOpeningBalanceDraft(String(totals.openingBalance)); }}>Değiştir</button>
                            </div>
                          )}
                        </td>
                        <td style={{padding:"7px 10px", minWidth: 180}}>
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
                        </td>
                      </tr>
                    )}
                    {!isSellerRole && totals.pastPendingAdvanceTotal > 0 && (
                      <tr style={{borderBottom:"1px solid #f1f5f9", background:"#fef9c3"}}>
                        <td style={{padding:"7px 10px", color:"#854d0e", fontWeight:600}} colSpan={8}>
                          💰 Geçmiş dönem(ler)den bekleyen ön ödemeler (henüz satışa dönüşmedi, bu ekranda ayrı satır olarak görünmüyor çünkü eski dönemde kalmış): <b>{money(totals.pastPendingAdvanceTotal)}</b> — satışa dönüştükçe bu tutar otomatik azalır.
                        </td>
                      </tr>
                    )}
                    {totals.recentPayments.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((pay) => {
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
                        <td style={{padding:"7px 10px", minWidth: 180}}>
                          {editingPaymentNoteId === pay.id ? (
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <input
                                className="input"
                                style={{fontSize:"0.78rem",padding:"4px 6px"}}
                                value={paymentNoteDraft}
                                onChange={(e) => setPaymentNoteDraft(e.target.value)}
                                placeholder="Not yaz..."
                                autoFocus
                              />
                              <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => savePaymentNote(pay.id)}>Kaydet</button>
                              <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingPaymentNoteId(null); setPaymentNoteDraft(""); }}>Vazgeç</button>
                            </div>
                          ) : (
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              {pay.note && <span style={{color:"#475569",fontStyle:"italic"}}>{pay.note}</span>}
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{fontSize:"0.7rem",padding:"3px 8px"}}
                                onClick={() => { setEditingPaymentNoteId(pay.id); setPaymentNoteDraft(pay.note || ""); }}
                              >
                                {pay.note ? "Değiştir" : "Not Ekle"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{padding:"7px 10px", minWidth: 130}}>
                          {editingKasaId === pay.id ? (
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <input
                                className="input"
                                type="number"
                                style={{fontSize:"0.78rem",padding:"4px 6px", width: 90}}
                                placeholder="₺"
                                value={kasaTutariDrafts[pay.id] ?? ""}
                                onChange={(e) => setKasaTutariDrafts((prev) => ({ ...prev, [pay.id]: e.target.value }))}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") saveKasaTutari(pay.id); }}
                              />
                              <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => saveKasaTutari(pay.id)}>Kaydet</button>
                              <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingKasaId(null); setKasaTutariDrafts((prev) => { const n = { ...prev }; delete n[pay.id]; return n; }); }}>Vazgeç</button>
                            </div>
                          ) : (
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span>{pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? money(pay.kasa_tutari) : <span style={{color:"#cbd5e1"}}>—</span>}</span>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{fontSize:"0.7rem",padding:"3px 8px"}}
                                onClick={() => { setEditingKasaId(pay.id); setKasaTutariDrafts((prev) => ({ ...prev, [pay.id]: pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? String(pay.kasa_tutari) : "" })); }}
                              >
                                {pay.kasa_tutari !== null && pay.kasa_tutari !== undefined ? "Değiştir" : "Kasa Ekle"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{padding:"7px 10px", minWidth: 180}}>
                          {editingPaymentAciklamaId === pay.id ? (
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <input
                                className="input"
                                style={{fontSize:"0.78rem",padding:"4px 6px"}}
                                value={paymentAciklamaDraft}
                                onChange={(e) => setPaymentAciklamaDraft(e.target.value)}
                                placeholder="Açıklama yaz..."
                                autoFocus
                              />
                              <button type="button" className="btn" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => savePaymentAciklama(pay.id)}>Kaydet</button>
                              <button type="button" className="btn-secondary" style={{fontSize:"0.7rem",padding:"3px 8px"}} onClick={() => { setEditingPaymentAciklamaId(null); setPaymentAciklamaDraft(""); }}>Vazgeç</button>
                            </div>
                          ) : (
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              {pay.aciklama && <span style={{color:"#475569",fontStyle:"italic"}}>{pay.aciklama}</span>}
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{fontSize:"0.7rem",padding:"3px 8px"}}
                                onClick={() => { setEditingPaymentAciklamaId(pay.id); setPaymentAciklamaDraft(pay.aciklama || ""); }}
                              >
                                {pay.aciklama ? "Değiştir" : "Açıklama Ekle"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}>
                      <td colSpan={4} style={{padding:"8px 10px",fontWeight:600}}>Toplam</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{money(totals.grossCash)}</td>
                      <td></td>
                      <td style={{padding:"8px 10px",fontWeight:700}}>{money(totals.recentPayments.reduce((s, p) => s + Number(p.kasa_tutari || 0), 0) + (isSellerRole ? 0 : totals.openingBalance))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
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
              <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:800,maxHeight:"90vh",overflowY:"auto"}} onClick={(e) => e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Müşteri Borcu Detayı</h2>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:"0.85rem",color:"#64748b"}}>{debtList.length} müşteri · Toplam: <strong>{money(total)}</strong></span>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowMusteriDetay(false)}>Kapat</button>
                  </div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Tarih</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Müşteri</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:"#64748b"}}>Ürün</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b"}}>Ad.</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b"}}>Tutar</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b"}}>Ödenen</th>
                      <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:"#64748b"}}>Kalan</th>
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
                          <td style={{padding:"7px 10px"}}>{productMap.get(s.product_id)?.name || "-"}</td>
                          <td style={{padding:"7px 10px",textAlign:"right"}}>{s.qty}</td>
                          <td style={{padding:"7px 10px",textAlign:"right"}}>{money(s.total)}</td>
                          <td style={{padding:"7px 10px",textAlign:"right",color:"#16a34a"}}>{money(toNum(s.paid_amount))}</td>
                          <td style={{padding:"7px 10px",textAlign:"right",fontWeight:500,color:"#dc2626"}}>{money(toNum(s.total) - toNum(s.paid_amount))}</td>
                        </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}>
                      <td colSpan={6} style={{padding:"8px 10px",fontWeight:600}}>Toplam Borç</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#dc2626"}}>{money(total)}</td>
                    </tr>
                  </tfoot>
                </table>
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
              style={{padding:"8px 10px",textAlign:["asli","mihri","toplam","alis"].includes(col)?"right":"left",fontWeight:600,color:"#64748b",whiteSpace:"nowrap",cursor:"pointer",userSelect:"none"}}>
              {label}{stokSort.col === col ? (stokSort.dir === "asc" ? " ↑" : " ↓") : " ↕"}
            </th>
          );
          const genelToplam = sorted.reduce((s, r) => s + r.toplam, 0);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowStokDetay(false)}>
              <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:900,maxHeight:"90vh",overflowY:"auto"}} onClick={(e) => e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                  <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Mevcut Stok Detayı</h2>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:"0.85rem",color:"#64748b"}}>{sorted.length} kalem · <strong>{genelToplam}</strong> adet</span>
                    <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowStokDetay(false)}>Kapat</button>
                  </div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                    <thead>
                      <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                        {stokTh("urun","Ürün Adı")}
                        {stokTh("parti","Parti")}
                        {stokTh("tur","Tür")}
                        {stokTh("toplam","Stok")}
                        {stokTh("alis","Alış Fiyatı")}
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
                    <tfoot>
                      <tr style={{borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}>
                        <td colSpan={3} style={{padding:"8px 10px",fontWeight:600}}>Toplam</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700}}>{genelToplam}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {showKarDetay && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={() => setShowKarDetay(false)}>
            <div style={{background:"white",borderRadius:16,padding:24,width:"100%",maxWidth:900,maxHeight:"90vh",overflowY:"auto"}} onClick={(e) => e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h2 style={{fontSize:"1.1rem",fontWeight:700}}>Net Kar Detayı</h2>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:"0.85rem",color:"#64748b"}}>{karDetay.length} satır · Toplam: <strong>{money(anlıkKar)}</strong></span>
                  <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={exportKarDetayToExcel}>Excel'e Aktar</button>
                  <button type="button" className="btn-secondary" style={{padding:"4px 12px"}} onClick={() => setShowKarDetay(false)}>Kapat</button>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.8rem"}}>
                  <thead>
                    <tr style={{background:"#f8fafc",borderBottom:"1.5px solid #e2e8f0"}}>
                      {["Tarih","Cari","Ürün","Ad.","Satış","Tahsilat","Maliyet","Ek Maliyet","Kar"].map((h) => (
                        <th key={h} style={{padding:"8px 10px",textAlign:h==="Cari"||h==="Ürün"||h==="Tarih"?"left":"right",fontWeight:600,color:"#64748b",whiteSpace:"nowrap"}}>{h}</th>
                      ))}
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
                  <tfoot>
                    <tr style={{borderTop:"1.5px solid #e2e8f0",background:"#f8fafc"}}>
                      <td colSpan={5} style={{padding:"8px 10px",fontWeight:600,color:"#64748b"}}>Toplam Tahsilat</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{money(karDetay.reduce((s,r) => s + r.tahsilat, 0))}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{money(karDetay.reduce((s,r) => s + r.maliyet, 0))}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}>{money(karDetay.reduce((s,r) => s + r.ekMaliyet, 0))}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600}}></td>
                    </tr>
                    {(() => {
                      const eskiDonemTahsilat = karDetay.filter((r) => r.fromPreviousPeriod).reduce((s, r) => s + r.tahsilat, 0);
                      const buDonemTahsilat = karDetay.reduce((s, r) => s + r.tahsilat, 0) - eskiDonemTahsilat;
                      if (eskiDonemTahsilat <= 0) return null;
                      return (
                        <tr style={{background:"#fffbeb"}}>
                          <td colSpan={9} style={{padding:"6px 10px", fontSize:"0.75rem", color:"#92400e"}}>
                            💰 Yukarıdaki toplamın <b>{money(buDonemTahsilat)}</b>'si bu dönemin gerçek tahsilatı, <b>{money(eskiDonemTahsilat)}</b>'si ise önceki dönem(ler)de alınmış ön ödemelerin şimdi satışa dönüşüp kâr hesabına yansımasından geliyor.
                          </td>
                        </tr>
                      );
                    })()}
                    <tr style={{borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}>
                      <td colSpan={8} style={{padding:"8px 10px",fontWeight:600}}>Toplam Net Kar</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:anlıkKar<0?"#dc2626":"#16a34a"}}>{money(anlıkKar)}</td>
                    </tr>
                  </tfoot>
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
                    <select className="input" value={convertPaid} onChange={(e) => setConvertPaid(e.target.value)}>
                      <option value="false">Cari borç</option>
                      <option value="banka">Peşin - Banka alındı</option>
                      <option value="nakit">Peşin - Nakit alındı</option>
                    </select>
                  </div>
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
                  <button type="button" className="btn-secondary" onClick={() => { setConvertModal(null); setMessage(""); setConvertSellerProfit(""); }}>Vazgeç</button>
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
                  onChange={(v) => setSaleForm({ ...saleForm, productId: v, batchId: "" })}
                  options={sortedActiveProducts
                    .filter((p) => batchItemsForProduct(p.id).some((i) => i.bought - getBatchSoldQtyForItem(i) > 0))
                    .map((p) => {
                      const stok = batchItemsForProduct(p.id).reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
                      return { value: p.id, label: `${p.name} — Stok: ${stok}` };
                    })}
                />
                {/* Parti: birden fazla stoklu parti varsa göster */}
                {saleForm.productId && (() => {
                  const partiler = batchItemsForProduct(saleForm.productId).filter((i) => {
                    const kalan = i.bought - getBatchSoldQtyForItem(i);
                    return kalan > 0;
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
                  salesTh("status","Durum"), "İşlem"
                ]}
                rows={sortedSales.map((sale) => {
                  const isEditing = editingSaleId === sale.id;
                  const draft = saleDrafts[sale.id];
                  return [
                    toTR(sale.created_at),
                    customerMap.get(sale.customer_id)?.name || "-",
                    productMap.get(sale.product_id)?.name || "-",
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
                      ? <div key="actions" className="flex gap-2"><button type="button" className="btn" disabled={isLoading(`sale-save-${sale.id}`)} onClick={() => withLoading(`sale-save-${sale.id}`, () => saveSaleEdit(sale.id))}>{isLoading(`sale-save-${sale.id}`) ? "..." : "Kaydet"}</button><button type="button" className="btn-secondary" onClick={() => cancelSaleEdit(sale.id)}>Vazgeç</button></div>
                      : <div key="actions" className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => startSaleEdit(sale)}>Değiştir</button><button type="button" className="btn-danger" disabled={deletingId === sale.id} onClick={() => deleteSale(sale.id)}>{deletingId === sale.id ? "..." : "Sil"}</button></div>,
                  ];
                })}
              />
            </Card>
          </div>
        )}

        {active === "partners" && (
          <div className="space-y-4">
            <Card title="Parti Maliyet Kaydı">
              <p className="mb-4 text-sm text-slate-500">Her parti satırındaki değerleri doldurun ve "Kaydet" butonuna basın. Yeni parti eklendiğinde otomatik alt satıra eklenir.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-3 text-left font-semibold border border-slate-200">Parti</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">İlk Parti Açılışı</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">İlk Mal Girişi</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">USD Kuru</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Birim Ek Maliyet</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Veli</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Aslı</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Mihri</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Kasa</th>
                      <th className="p-3 text-right font-semibold border border-slate-200 bg-slate-200">Toptancı</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Kargo</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Diğer</th>
                      <th className="p-3 text-left font-semibold border border-slate-200">Açıklama</th>
                      <th className="p-3 text-right font-semibold border border-slate-200 bg-slate-200">Toplam Maliyet</th>
                      <th className="p-3 border border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBatches.map((batch) => {
                      const row = costInputs[batch.id] || { veli: "0", asli: "0", mihrimah: "0", kasa: "0", kargo: "0", diger: "0", aciklama: "" };
                      const setRow = (field: string, val: string) => setCostInputs((prev) => ({ ...prev, [batch.id]: { ...(prev[batch.id] || { veli:"0", asli:"0", mihrimah:"0", kasa:"0", kargo:"0", diger:"0", aciklama:"" }), [field]: val } }));
                      const total = (Number(row.veli)||0) + (Number(row.asli)||0) + (Number(row.mihrimah)||0) + (Number(row.kasa)||0) + (Number(row.diger)||0);
                      // Toptancı = Kasa + Veli + Aslı + Mihri - Kargo - Diğer
                      const toptanci = (Number(row.veli)||0) + (Number(row.asli)||0) + (Number(row.mihrimah)||0) + (Number(row.kasa)||0) - (Number(row.kargo)||0) - (Number(row.diger)||0);
                      const existing = batchCosts.find((c) => c.batch_id === batch.id);
                      const isDirty = !existing
                        ? (Number(row.veli)||0) !== 0 || (Number(row.asli)||0) !== 0 || (Number(row.mihrimah)||0) !== 0 || (Number(row.kasa)||0) !== 0 || (Number(row.kargo)||0) !== 0 || (Number(row.diger)||0) !== 0 || (row.aciklama || "") !== ""
                        : (Number(row.veli)||0) !== Number(existing.veli||0) || (Number(row.asli)||0) !== Number(existing.asli||0) || (Number(row.mihrimah)||0) !== Number(existing.mihrimah||0) || (Number(row.kasa)||0) !== Number(existing.kasa||0) || (Number(row.kargo)||0) !== Number(existing.kargo||0) || (Number(row.diger)||0) !== Number(existing.diger||0) || (row.aciklama || "") !== (existing.aciklama || "");
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
                          <td className="p-1 border border-slate-200">
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
                          {(["veli","asli","mihrimah","kasa"] as const).map((f) => (
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
                          <td className="p-3 text-right font-semibold border border-slate-200 bg-slate-50">
                            {(total !== 0 || Number(row.kargo || 0) !== 0) ? toptanci.toLocaleString("tr-TR") : "-"}
                          </td>
                          {(["kargo","diger"] as const).map((f) => (
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
                        {(["veli","asli","mihrimah","kasa"] as const).map((f) => (
                          <td key={f} className="p-3 text-right border border-slate-300">
                            {batchCosts.reduce((s,c) => s + Number(c[f]||0), 0).toLocaleString("tr-TR")}
                          </td>
                        ))}
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + Number(c.veli||0) + Number(c.asli||0) + Number(c.mihrimah||0) + Number(c.kasa||0) - Number(c.kargo||0) - Number(c.diger||0), 0).toLocaleString("tr-TR")}
                        </td>
                        {(["kargo","diger"] as const).map((f) => (
                          <td key={f} className="p-3 text-right border border-slate-300">
                            {batchCosts.reduce((s,c) => s + Number(c[f]||0), 0).toLocaleString("tr-TR")}
                          </td>
                        ))}
                        <td className="p-3 border border-slate-300"></td>
                        <td className="p-3 text-right border border-slate-300">
                          {batchCosts.reduce((s,c) => s + Number(c.veli||0) + Number(c.asli||0) + Number(c.mihrimah||0) + Number(c.kasa||0) + Number(c.diger||0), 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="border border-slate-300"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {active === "period" && (
          <div className="space-y-4">
            <Card title="Dönem Kapanışı">
              <p className="mb-5 text-slate-500">Dağıtım, Kar tablosunun (Net Kar Detayı) dip toplamına göre eşit yapılır; borcu olan ortağın payı önce borcundan düşülür.</p>
              <div className="mb-5 grid gap-4 text-sm md:grid-cols-5">
                <div className="rounded-xl bg-slate-100 p-4">Toplam tahsilat<br /><b>{money(totals.grossCash)}</b></div>
                {totals.refundIncome > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-300 p-4">Bunun içinde toptancı iadesi<br /><b>{money(totals.refundIncome)}</b></div>
                )}
                <div className="rounded-xl bg-slate-100 p-4">Kasadaki para (bilgi amaçlı)<br /><b>{money(totals.cash)}</b></div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4">Kar tablosu dip toplamı (dağıtılacak)<br /><b>{money(anlıkKar)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Aslı payı<br /><b>{money(anlıkKar / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Mihrimah payı<br /><b>{money(anlıkKar / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Müşteri cari<br /><b>{money(totals.customerDebt)}</b></div>
              </div>
              <button type="button" className="btn" disabled={isLoading("closePeriod")} onClick={() => withLoading("closePeriod", closePeriod)}>{isLoading("closePeriod") ? "Kapatılıyor..." : "Dönemi Kapat ve Mahsuplaştır"}</button>
            </Card>

            <Card title="Dönem Geçmişi">
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.85rem"}}>
                      <thead>
                        <tr style={{background:"#f8fafc", borderBottom:"1.5px solid #e2e8f0"}}>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Dönem</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Ürün Maliyeti</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Diğer Maliyetler</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Dönem Karı</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Toplam Tahsilat</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Aslı Net Ödeme</th>
                          <th style={{padding:"10px 12px", textAlign:"right", fontWeight:600, color:"#64748b"}}>Mihri Net Ödeme</th>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Durum</th>
                          <th style={{padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#64748b"}}>Kapanış</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((p) => (
                          <tr key={p.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                            <td style={{padding:"10px 12px"}}>{p.name}</td>
                            {(["urun_maliyeti","diger_maliyetler","donem_kari"] as const).map((field) => (
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
                            <td style={{padding:"10px 12px"}}>{p.closed ? "Kapalı" : "Açık"}</td>
                            <td style={{padding:"10px 12px"}}>{p.closed_at ? new Date(p.closed_at).toLocaleDateString("tr-TR") : "-"}</td>
                          </tr>
                        ))}
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
        .product-info-chips--sm { grid-template-columns: 1fr 1fr; gap: 6px; }
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
          .product-info-chips--sm { grid-template-columns: 1fr 1fr; }
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