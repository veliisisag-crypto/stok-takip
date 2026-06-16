"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

function AuditSection({ supabase }: { supabase: typeof import("@/lib/supabase").supabase }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setLogs((data || []) as AuditLog[]); setLoading(false); });
  }, []);
  return (
    <div className="space-y-4">
      <Card title="İşlem Geçmişi">
        {loading ? <p className="text-sm text-slate-500">Yükleniyor...</p> : (
          <Table
            headers={["Tarih", "İşlem", "Tablo", "Kayıt", "Kullanıcı"]}
            rows={logs.map((log) => [
              toTR(log.created_at, true),
              log.action,
              log.entity_type,
              log.entity_name || "-",
              log.user_email || "-",
            ])}
          />
        )}
      </Card>
    </div>
  );
}


type GenderCategory = "Kadın" | "Erkek" | "Unisex";
type SaleType = "Normal satış" | "Fire/Bozuk" | "Hibe";
type Seller = "Aslı" | "Mihrimah";

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
  items?: PreorderItem[];
};

type Product = {
  id: string;
  name: string;
  code: string;
  gender_category: GenderCategory;
  image_url: string | null;

  passive: boolean;
};

type Customer = {
  id: string;
  name: string;
  passive: boolean;
};

type Batch = {
  id: string;
  name: string;
};

type BatchItem = {
  id: string;
  batch_id: string;
  product_id: string;
  bought: number;
  buy_price: number;
  sale_price: number;
  depo?: string;
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
  cancelled: boolean;
  created_at: string;
};

type Payment = {
  id: string;
  customer_id: string;
  amount: number;
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
  product_cost: number;
  shipping_cost: number;
  closing_cash?: number | null;
  asli_distribution?: number | null;
  mihrimah_distribution?: number | null;
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

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      {title ? <h3 className="mb-4 text-lg font-semibold">{title}</h3> : null}
      {children}
    </section>
  );
}

function StatCard({ title, value, note }: { title: string; value: ReactNode; note?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </Card>
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [batchCosts, setBatchCosts] = useState<BatchCost[]>([]);
  const [costInputs, setCostInputs] = useState<Record<string, Record<string, string>>>({});
  const [periods, setPeriods] = useState<Period[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [preorderItems, setPreorderItems] = useState<PreorderItem[]>([]);
  const [preorderForm, setPreorderForm] = useState<{ customerId: string; note: string; items: { productId: string; qty: string }[] }>({ customerId: "", note: "", items: [{ productId: "", qty: "1" }] });
  const [editingPreorderId, setEditingPreorderId] = useState<string | null>(null);
  const [convertModal, setConvertModal] = useState<{ preorder: Preorder; item: PreorderItem } | null>(null);
  const [convertPrices, setConvertPrices] = useState<Record<string, string>>({});
  const [convertPaid, setConvertPaid] = useState<string>("false");

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState<string>("");
  const [salesSort, setSalesSort] = useState<{col: string; dir: "asc"|"desc"}>({col: "created_at", dir: "desc"});
  const [splitModal, setSplitModal] = useState<{item: BatchItem; newDepo: string} | null>(null);
  const [splitQty, setSplitQty] = useState<string>("");
  const [saleDrafts, setSaleDrafts] = useState<Record<string, { qty: string; total: string; seller: Seller; sale_type: SaleType; paid: boolean }>>({});
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
  const [batchForm, setBatchForm] = useState({ batchId: "", productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Aslı-depo" });
  const [saleForm, setSaleForm] = useState({ customerId: "", productId: "", batchId: "", qty: "1", seller: "Aslı" as Seller, saleType: "Normal satış" as SaleType, paid: "false", customSalePrice: "", depo: "Aslı-depo" });
  const [periodForm, setPeriodForm] = useState({ name: `Dönem ${today()}`, sponsor: "0", asli: "0", mihrimah: "0", productCost: "0", shippingCost: "0" });

  const activeSales = sales.filter((sale) => !sale.cancelled);
  const activePayments = payments.filter((payment) => !payment.cancelled);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const batchMap = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [products]
  );
  const sortedActiveProducts = useMemo(
    () => sortedProducts.filter((p) => !p.passive),
    [sortedProducts]
  );
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [customers]
  );
  const sortedActiveCustomers = useMemo(
    () => sortedCustomers.filter((c) => !c.passive),
    [sortedCustomers]
  );
  const sortedBatches = useMemo(
    () => [...batches].sort((a, b) => a.name.localeCompare(b.name, "tr", { numeric: true })),
    [batches]
  );

  const showError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error || "Bilinmeyen hata");
    setMessage(msg);
  };

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email || "";
      setCurrentUserEmail(email);
      const defaultDepo = email.includes("mihrimah") ? "Mihri-depo" : "Aslı-depo";
      const defaultSeller: Seller = email.includes("mihrimah") ? "Mihrimah" : "Aslı";
      setSaleForm((prev) => ({ ...prev, depo: defaultDepo, seller: defaultSeller }));
      setBatchForm((prev) => ({ ...prev, depo: defaultDepo }));

      const [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes, preordersRes, preorderItemsRes] = await Promise.all([
        supabase.from("products").select("id,name,code,gender_category,image_url,passive").order("created_at", { ascending: true }),
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
      ]);

      for (const res of [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, batchCostsRes]) {
        if (res.error) throw res.error;
      }

      setProducts((productsRes.data || []) as Product[]);
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

  const getCustomerCollectedTotal = (customerId: string) =>
    getCustomerPaidSalesTotal(customerId) + getCustomerManualPaymentsTotal(customerId);

  const getCustomerBalance = (customerId: string) =>
    Math.max(getCustomerSalesTotal(customerId) - getCustomerCollectedTotal(customerId), 0);

  const totals = useMemo(() => {
    const customerDebt = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const stockValue = batchItems.reduce((sum, item) => sum + Math.max(item.bought - getBatchSoldQtyForItem(item), 0) * item.buy_price, 0);
    const totalStock = products.filter((p) => !p.passive).reduce((sum, p) => sum + getProductStock(p.id), 0);
    const grossCash = activeSales.filter((item) => item.paid).reduce((sum, item) => sum + item.total, 0) + activePayments.reduce((sum, item) => sum + item.amount, 0);
    const distributedCash = periods
      .filter((period) => period.closed)
      .reduce((sum, period) => sum + Number(period.asli_distribution || 0) + Number(period.mihrimah_distribution || 0), 0);
    const cash = Math.max(grossCash - distributedCash, 0);
    const revenue = cash + customerDebt + distributedCash;
    const profit = activeSales.reduce((sum, item) => sum + (item.total - item.cost), 0);
    return { revenue, profit, customerDebt, stockValue, totalStock, grossCash, distributedCash, cash };
  }, [products, customers, batchItems, activeSales, activePayments, periods]);


  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return sortedCustomers;
    return sortedCustomers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [sortedCustomers, customerSearch]);

  const recentMovements = useMemo(() => {
    const shortUser = (email?: string, seller?: string) => {
      if (seller === "Aslı" || seller === "Mihrimah") return seller === "Mihrimah" ? "Mihri" : "Aslı";
      if (!email) return "-";
      if (email.includes("asli")) return "Aslı";
      if (email.includes("mihrimah")) return "Mihri";
      if (email.includes("veli")) return "Veli";
      return email.split("@")[0];
    };

    const saleRows = activeSales.map((sale) => ({
      id: `sale-${sale.id}`,
      date: sale.created_at,
      type: sale.sale_type === "Fire/Bozuk" ? "Fire/Bozuk" : sale.paid ? "Peşin satış" : "Cari satış",
      customer: customerMap.get(sale.customer_id)?.name || "-",
      detail: `${productMap.get(sale.product_id)?.name || "-"} / ${batchMap.get(sale.batch_id)?.name || "-"} / ${sale.qty} adet`,
      amount: toNum(sale.total),
      user: shortUser(undefined, sale.seller),
    }));

    const paymentRows = activePayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.created_at,
      type: "Tahsilat",
      customer: customerMap.get(payment.customer_id)?.name || "-",
      detail: "Cari ödeme",
      amount: toNum(payment.amount),
      user: shortUser(payment.user_email ?? undefined),
    }));

    const auditRows = auditLogs.map((log) => ({
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
      .slice(0, 50);
  }, [activeSales, activePayments, auditLogs, customerMap, productMap, batchMap]);

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
    const { error } = await supabase.from("products").update(dbPatch).eq("id", productId);
    if (error) return showError(error);
    // Exclude image_url from log to avoid storing large base64/URL data
    const { image_url: _img, ...logPatch } = dbPatch as Record<string, unknown> & { image_url?: unknown };
    await logAction("Ürün değiştirildi", "products", products.find((p) => p.id === productId)?.name || productId, logPatch);
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
    const { error } = await supabase.from("customers").insert({ name });
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
    await logAction("Cari değiştirildi", "customers", oldName, { yeni_ad: name });
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
      await logAction("Cari pasife alındı", "customers", customer.name);
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
    const { error } = await supabase.from("batches").insert({ name });
    if (error) return showError(error);
    await logAction("Parti eklendi", "batches", name);
    setNewBatchName("");
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
    await logAction("Parti değiştirildi", "batches", oldName, { yeni_ad: clean });
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
    setBatchForm({ batchId, productId: "", bought: "", buyPrice: "", salePrice: "", depo: "Aslı-depo" });
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
    const { error } = await supabase.from("batch_items").update(dbPatch).eq("id", itemId);
    if (error) return showError(error);
    await logAction("Parti ürün satırı değiştirildi", "batch_items", itemId, dbPatch);
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
      rows.push({
        customer_id: customer.id,
        product_id: product.id,
        batch_id: item.batch_id,
        batch_item_id: item.id,
        seller: saleForm.seller,
        sale_type: saleForm.saleType,
        qty: take,
        total: totalPrice,
        cost: item.buy_price * take,
        paid: saleForm.paid === "true" || isZeroPrice,
        paid_amount: saleForm.paid === "true" || isZeroPrice ? totalPrice : 0,
        cancelled: false,
      });
      remainingQty -= take;
    }

    if (remainingQty > 0) return setMessage("Parti stokları yetersiz.");
    const { error } = await supabase.from("sales").insert(rows);
    if (error) return showError(error);
    await logAction("Satış eklendi", "sales", `${customer.name} - ${product.name}`, { adet: qty, toplam: rows.reduce((sum, row) => sum + Number(row.total || 0), 0), satir_sayisi: rows.length });
    setSaleForm((prev) => ({ customerId: "", productId: "", batchId: "", qty: "1", seller: prev.seller, saleType: "Normal satış", paid: "false", customSalePrice: "", depo: prev.depo }));
    setMessage("Satış kaydedildi.");
    loadAll();
  };

  const deleteSale = async (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    const { error } = await supabase.from("sales").update({ cancelled: true }).eq("id", saleId);
    if (error) return showError(error);
    if (sale) {
      try {
        await allocatePaymentsForCustomer(sale.customer_id);
      } catch (err) {
        return showError(err);
      }
    }
    await logAction("Satış iptal edildi", "sales", sale ? `${customerMap.get(sale.customer_id)?.name || sale.customer_id} - ${productMap.get(sale.product_id)?.name || sale.product_id}` : saleId, { tutar: sale?.total || 0 });
    setMessage("Satış iptal edildi. Kayıt silinmez, iptal olarak saklanır.");
    loadAll();
  };

  const updateSale = async (saleId: string, patch: Partial<Sale>) => {
    const dbPatch: Record<string, unknown> = {};
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
    await logAction("Satış değiştirildi", "sales", saleId, dbPatch);
    loadAll();
  };

  const startSaleEdit = (sale: Sale) => {
    setSaleDrafts((prev) => ({
      ...prev,
      [sale.id]: { qty: String(sale.qty), total: String(sale.total), seller: sale.seller, sale_type: sale.sale_type, paid: sale.paid },
    }));
    setEditingSaleId(sale.id);
  };

  const saveSaleEdit = async (saleId: string) => {
    const draft = saleDrafts[saleId];
    if (!draft) return;
    await updateSale(saleId, {
      qty: Number(draft.qty || 0),
      total: Number(draft.total || 0),
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
        .select("amount,cancelled")
        .eq("customer_id", customerId),
    ]);

    if (salesRes.error) throw salesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    let remainingManualPayments = (paymentsRes.data || [])
      .filter((payment) => !payment.cancelled)
      .reduce((sum, payment) => sum + toNum(payment.amount), 0);

    const updates = (salesRes.data || []).map((sale) => {
      const total = toNum(sale.total);
      let paidAmount = 0;

      if (sale.paid) {
        paidAmount = total;
      } else {
        paidAmount = Math.max(0, Math.min(total, remainingManualPayments));
        remainingManualPayments -= paidAmount;
      }

      return supabase.from("sales").update({ paid_amount: paidAmount }).eq("id", sale.id);
    });

    const results = await Promise.all(updates);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;
  };

  const addCustomerPayment = async (customerId: string) => {
    const amount = Number(paymentInputs[customerId] || 0);
    if (!amount || amount <= 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData.user?.email || null;
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount, user_email: userEmail });
    if (error) return showError(error);
    try {
      await allocatePaymentsForCustomer(customerId);
    } catch (err) {
      return showError(err);
    }
    await logAction("Ödeme eklendi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: amount });
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
    loadAll();
  };

  const updatePayment = async (paymentId: string, newAmount: number, customerId: string) => {
    if (!newAmount || newAmount <= 0) return setMessage("Tutar 0'dan büyük olmalı.");
    const { error } = await supabase.from("payments").update({ amount: newAmount }).eq("id", paymentId);
    if (error) return showError(error);
    try { await allocatePaymentsForCustomer(customerId); } catch (err) { return showError(err); }
    await logAction("Ödeme güncellendi", "payments", customerMap.get(customerId)?.name || customerId, { tutar: newAmount });
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
      const { error } = await supabase.from("preorders").update({ customer_id: preorderForm.customerId, note: preorderForm.note }).eq("id", editingPreorderId);
      if (error) return showError(error);
      await supabase.from("preorder_items").delete().eq("preorder_id", editingPreorderId);
      const { error: itemErr } = await supabase.from("preorder_items").insert(validItems.map((i) => ({ preorder_id: editingPreorderId, product_id: i.productId, qty: Number(i.qty) })));
      if (itemErr) return showError(itemErr);
      await logAction("Ön sipariş güncellendi", "preorders", customer?.name || "", { items: validItems.length });
      setEditingPreorderId(null);
    } else {
      const { data: newPO, error } = await supabase.from("preorders").insert({ customer_id: preorderForm.customerId, note: preorderForm.note, created_by: currentUserEmail, status: "bekliyor" }).select().single();
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
    setConvertModal({ preorder: po, item });
  };

  const convertToSales = async () => {
    if (!convertModal) return;
    const { preorder: po, item } = convertModal;
    const price = Number(convertPrices[item.id] || 0);
    if (!price) return setMessage("Fiyat girin.");
    const product = productMap.get(item.product_id);
    if (!product) return;
    const userDepo = currentUserEmail.includes("mihrimah") ? "Mihri-depo" : "Aslı-depo";
    const otherDepo = userDepo === "Aslı-depo" ? "Mihri-depo" : "Aslı-depo";
    const userDepoStock = batchItemsForProduct(product.id).filter((bi) => bi.depo === userDepo).reduce((s, bi) => s + Math.max(bi.bought - getBatchSoldQtyForItem(bi), 0), 0);
    const depo = userDepoStock >= item.qty ? userDepo : otherDepo;
    const seller: Seller = depo === "Aslı-depo" ? "Aslı" : "Mihrimah";
    const depoBatchItems = batchItemsForProduct(product.id).filter((bi) => bi.depo === depo && Math.max(bi.bought - getBatchSoldQtyForItem(bi), 0) > 0);
    if (!depoBatchItems.length) return setMessage(`${product.name} için yeterli stok yok (${depo}).`);
    const batchItem = depoBatchItems[0];
    const { error } = await supabase.from("sales").insert({ customer_id: po.customer_id, product_id: product.id, batch_item_id: batchItem.id, qty: item.qty, total: price * item.qty, cost: batchItem.buy_price * item.qty, seller, sale_type: "Normal satış", paid: convertPaid === "true", paid_amount: convertPaid === "true" ? price * item.qty : 0, depo, user_email: currentUserEmail });
    if (error) return showError(error);
    // Bu item'ı sil
    await supabase.from("preorder_items").delete().eq("id", item.id);
    // Kalan item var mı kontrol et, yoksa ön siparişi tamamlandı yap
    const remaining = preorderItems.filter((i) => i.preorder_id === po.id && i.id !== item.id);
    if (remaining.length === 0) {
      await supabase.from("preorders").update({ status: "tamamlandı" }).eq("id", po.id);
    }
    await allocatePaymentsForCustomer(po.customer_id);
    await logAction("Ön sipariş satır satışa dönüştürüldü", "preorders", customerMap.get(po.customer_id)?.name || "", { ürün: product.name, adet: item.qty });
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
    await logAction("Ortaklık kaydı değiştirildi", "partner_ledger", partner?.partner_name || id, { alan: field, deger: value });
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

  const closePeriod = async () => {
    const distributableCash = Number(totals.cash || 0);
    if (distributableCash <= 0) {
      setMessage("Kasada dağıtılacak para yok.");
      return;
    }

    const half = distributableCash / 2;
    const closedAt = new Date().toISOString();
    const asli = partners.find((p) => p.partner_name === "Aslı");
    const mihrimah = partners.find((p) => p.partner_name === "Mihrimah");
    const updates = [];

    if (asli) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(asli.debt - half, 0), profit_share: asli.profit_share + half }).eq("id", asli.id));
    if (mihrimah) updates.push(supabase.from("partner_ledger").update({ debt: Math.max(mihrimah.debt - half, 0), profit_share: mihrimah.profit_share + half }).eq("id", mihrimah.id));

    const openPeriod = periods.find((p) => !p.closed);
    const periodPayload = {
      closed: true,
      closed_at: closedAt,
      closing_cash: distributableCash,
      asli_distribution: half,
      mihrimah_distribution: half,
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
    if (firstError) return showError(firstError);
    await logAction("Dönem kapatıldı", "periods", openPeriod?.name || `Kapanış ${today()}`, { dagitilan_kasa: distributableCash, asli_payi: half, mihrimah_payi: half });
    setMessage(`Dönem kapatıldı; ${money(distributableCash)} kasa Aslı ve Mihrimah arasında %50/%50 dağıtıldı.`);
    loadAll();
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

    await updateProduct(productId, {
      name: String(draft.name || product?.name || "").trim(),
      gender_category: (draft.gender_category || product?.gender_category) as GenderCategory,
      image_url: imageUrl,
    });
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
    const oldName = customers.find((c) => c.id === customerId)?.name || customerId;
    const { error } = await supabase
      .from("customers")
      .update({ name, passive: Boolean(draft.passive) })
      .eq("id", customerId);
    if (error) return showError(error);
    await logAction("Cari değiştirildi", "customers", oldName, { yeni_ad: name, passive: Boolean(draft.passive) });
    cancelCustomerEdit(customerId);
    loadAll();
  };

  const menu = [
    ["dashboard", "Özet Tablo"],
    ["preorders", "Ön Siparişler"],
    ["products", "Ürünler"],
    ["batchEntry", "Parti/Ürün Girişi"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
    ["partners", "Parti Maliyet Kaydı"],
    ["period", "Dönem Açılış/Kapanış"],
    ["audit", "İşlem Geçmişi"],
  ];

  const filteredProducts = sortedProducts.filter((p) => `${p.name} ${p.code} ${p.gender_category}`.toLowerCase().includes(search.toLowerCase()));

  const handleSalesSort = (col: string) => setSalesSort((s) => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
  const salesSortArr = (col: string) => salesSort.col === col ? (salesSort.dir === "asc" ? " ▲" : " ▼") : " ↕";
  const sortedSales = [...activeSales].sort((a, b) => {
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
    const cmp = typeof av === "number" ? av-(bv as number) : String(av).localeCompare(String(bv),"tr");
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

      <section className="p-5 lg:ml-72 lg:p-8">
        {/* Scroll to top button - top right */}
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{position:"fixed", right:"16px", top:"16px", zIndex:99999}} className="rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-bold text-black shadow-2xl">
          ↑ En Üste
        </button>

        {loadingData && (
          <div style={{position:"fixed",top:0,left:0,right:0,height:3,zIndex:99998,background:"linear-gradient(90deg,#0f172a 0%,#64748b 50%,#0f172a 100%)",backgroundSize:"200% 100%",animation:"loadbar 1.2s linear infinite"}} />
        )}

        {message ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm shadow-sm">
            <span>{message}</span>
            <button type="button" className="btn-secondary" onClick={() => setMessage("")}>Kapat</button>
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

        {active === "dashboard" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Toplam Satış" value={money(totals.revenue)} note="Aktif satış toplamı" />
              <StatCard title="Tahsilatlar" value={money(totals.cash)} note="Tahsilat - dönem dağıtımları" />
              <StatCard title="Müşteri Borcu" value={money(totals.customerDebt)} note="Cari satış - ödeme" />
              <StatCard title="Mevcut Stok" value={totals.totalStock} />
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
                <h2 className="product-page-title">Ürün Listesi ve Stok Özeti</h2>
              </div>
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
              <div className="product-search-wrap">
                <div className="product-search-inner">
                  <svg className="product-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="product-search-input" placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="product-list">
                {filteredProducts.length ? filteredProducts.map((p) => {
                  const isOpen = expandedProductId === p.id;
                  const isEditing = editingProductId === p.id;
                  const draft = productDrafts[p.id] || {};
                  const totalBought = getProductTotalBought(p.id);
                  const totalSold = getProductSoldQty(p.id);
                  const stock = getProductStock(p.id);
                  const isLowStock = stock === 0;
                  return (
                    <div key={p.id} className={`product-card ${isOpen ? "product-card--open" : ""}`}>
                      <button type="button" className="product-row" onClick={() => openProductDetail(p)}>
                        <div className="product-row-left">
                          <div className="product-name">{p.name}</div>
                          <div className="product-meta">{p.code} • {p.gender_category}</div>
                        </div>
                        <div className="product-row-stats">
                          <div className="product-stat-chip">
                            <span className="product-stat-label">Alınan</span>
                            <b className="product-stat-val">{totalBought}</b>
                          </div>
                          <div className="product-stat-chip">
                            <span className="product-stat-label">Satılan</span>
                            <b className="product-stat-val">{totalSold}</b>
                          </div>
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
                                            <option value="Aslı-depo">Aslı-depo</option>
                                            <option value="Mihri-depo">Mihri-depo</option>
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
                                <div className="product-info-chips product-info-chips--sm">
                                  <div className="product-info-chip product-info-chip--sm"><div className="product-info-chip-label">Kod</div><div className="product-info-chip-val">{p.code}</div></div>
                                  <div className="product-info-chip product-info-chip--sm"><div className="product-info-chip-label">Kategori</div><div className="product-info-chip-val">{p.gender_category}</div></div>
                                  <div className="product-info-chip product-info-chip--sm"><div className="product-info-chip-label">Durum</div><div className={`product-info-chip-val ${p.passive ? "product-info-chip-val--passive" : "product-info-chip-val--active"}`}>{p.passive ? "Pasif" : "Aktif"}</div></div>
                                </div>
                              </div>
                              <div className="product-batch-section">
                                <h4 className="product-batch-title">Parti Detayları</h4>
                                <div className="product-batch-table">
                                  <div className="product-batch-thead"><div>Parti</div><div>Depo</div><div>Alındı</div><div>Satıldı</div><div>Kalan</div><div>Alış</div><div>Satış</div></div>
                                  {batchItemsForProduct(p.id).length ? batchItemsForProduct(p.id).map((item) => {
                                    const sold = getBatchSoldQtyForItem(item);
                                    return (
                                      <div key={item.id} className="product-batch-row">
                                        <div className="product-batch-cell product-batch-cell--name">{batchMap.get(item.batch_id)?.name || "-"}</div>
                                        <div className="product-batch-cell" style={{fontSize:"0.72rem",color:"#64748b"}}>{item.depo || "Belirsiz"}</div>
                                        <div className="product-batch-cell">{item.bought}</div>
                                        <div className="product-batch-cell">{sold}</div>
                                        <div className="product-batch-cell">{item.bought - sold}</div>
                                        <div className="product-batch-cell">{money(item.buy_price)}</div>
                                        <div className="product-batch-cell">{money(item.sale_price)}</div>
                                      </div>
                                    );
                                  }) : <div className="product-batch-empty">Kayıt yok.</div>}
                                </div>
                              </div>
                              <div className="product-action-row">
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => startProductEdit(p)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                  Düzenle
                                </button>
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => setSalesModalProductId(p.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                  Satış Detayı
                                </button>
                                <button type="button" className="product-btn product-btn--danger" onClick={() => deleteProduct(p.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                  Pasife Al
                                </button>
                              </div>
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

        {active === "batchEntry" && (
          <div className="space-y-4">
            <Card title="Parti Bazlı Ürün Girişi">
              <p className="mb-5 text-slate-500">Önce kaynak ürün ve parti adı oluşturulur. Sonra partiye ürün, adet, alış fiyatı ve hedef satış fiyatı girilir.</p>
              <div className="mb-5 flex flex-wrap gap-3">
                <input className="input max-w-sm" placeholder="Yeni parti adı" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} />
                <button type="button" className="btn-secondary" onClick={addBatchName}>Parti Adı Ekle</button>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {sortedBatches.map((batch) => (
                  <div key={batch.id} className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                    <span>{batch.name}</span>
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
                <select className="input" value={batchForm.productId} onChange={(e) => setBatchForm({ ...batchForm, productId: e.target.value })}>
                  <option value="">Kaynak ürün seçin</option>
                  {sortedActiveProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input" type="number" placeholder="Toplam sipariş/adet" value={batchForm.bought} onChange={(e) => setBatchForm({ ...batchForm, bought: e.target.value })} />
                <input className="input" type="number" placeholder="Alış fiyatı" value={batchForm.buyPrice} onChange={(e) => setBatchForm({ ...batchForm, buyPrice: e.target.value })} />
                <input className="input" type="number" placeholder="Hedef satış fiyatı" value={batchForm.salePrice} onChange={(e) => setBatchForm({ ...batchForm, salePrice: e.target.value })} />
                <select className="input" value={batchForm.depo} onChange={(e) => setBatchForm({ ...batchForm, depo: e.target.value })}>
                  <option value="Aslı-depo">Aslı-depo</option>
                  <option value="Mihri-depo">Mihri-depo</option>
                </select>
                <button type="button" className="btn" onClick={addBatchProduct}>Partiye Ürün Ekle</button>
              </div>
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
                  const cmp = typeof av === "number" ? av-(bv as number) : String(av).localeCompare(String(bv),"tr");
                  return batchReportSort.dir === "asc" ? cmp : -cmp;
                });
                return (
                  <Table
                    headers={[brTh("batch","Parti"), brTh("depo","Depo"), brTh("product","Ürün"), brTh("bought","Alınan"), brTh("sold","Satılan"), brTh("kalan","Kalan"), brTh("buy_price","Alış"), brTh("sale_price","Satış"), "İşlem"]}
                    rows={sortedItems.map((item) => {
                      const key = item.id;
                      const p = productMap.get(item.product_id);
                      return [
                        editingBatchItemId === key ? (
                          <select className="input" value={item.batch_id} onChange={(e) => updateBatchItem(item.id, { batch_id: e.target.value })}>
                            {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                          </select>
                        ) : batchMap.get(item.batch_id)?.name || "-",
                        editingBatchItemId === key ? (
                          <select className="input" value={item.depo || "Belirsiz"} onChange={(e) => updateBatchItem(item.id, { depo: e.target.value })}>
                            <option value="Aslı-depo">Aslı-depo</option>
                            <option value="Mihri-depo">Mihri-depo</option>
                            <option value="Belirsiz">Belirsiz</option>
                          </select>
                        ) : item.depo || "Belirsiz",
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
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => addCustomerPayment(c.id)}>Ödeme Ekle</button>
                              </div>
                              <button type="button" className="product-btn product-btn--secondary" onClick={() => startCustomerEdit(c)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Düzenle
                              </button>
                              <button type="button" className="product-btn product-btn--danger" onClick={() => deleteCustomer(c.id)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                Sil / Pasife Al
                              </button>
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
                                        <button type="button" className="btn" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => updatePayment(pay.id, Number(editingPaymentAmount), c.id)}>Kaydet</button>
                                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => { setEditingPaymentId(null); setEditingPaymentAmount(""); }}>Vazgeç</button>
                                      </>) : (<>
                                        <button type="button" className="btn-secondary" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => { setEditingPaymentId(pay.id); setEditingPaymentAmount(String(pay.amount)); }}>Düzenle</button>
                                        <button type="button" className="btn-danger" style={{fontSize:"0.7rem", padding:"2px 8px"}} onClick={() => deletePayment(pay.id, c.id, pay.amount)}>Sil</button>
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
                  <select className="input" value={preorderForm.customerId} onChange={(e) => setPreorderForm({ ...preorderForm, customerId: e.target.value })}>
                    <option value="">Cari seçin</option>
                    {sortedActiveCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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
                        <select className="input flex-1" value={item.productId} onChange={(e) => { const items = [...preorderForm.items]; items[idx].productId = e.target.value; setPreorderForm({ ...preorderForm, items }); }}>
                          <option value="">Ürün seçin</option>
                          {sortedActiveProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className="input w-20" type="number" min="1" value={item.qty} onChange={(e) => { const items = [...preorderForm.items]; items[idx].qty = e.target.value; setPreorderForm({ ...preorderForm, items }); }} placeholder="Adet" />
                        {preorderForm.items.length > 1 && (
                          <button type="button" className="btn-danger" style={{padding:"6px 10px"}} onClick={() => { const items = preorderForm.items.filter((_, i) => i !== idx); setPreorderForm({ ...preorderForm, items }); }}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn-secondary text-sm" onClick={() => setPreorderForm({ ...preorderForm, items: [...preorderForm.items, { productId: "", qty: "1" }] })}>+ Ürün Ekle</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={savePreorder}>{editingPreorderId ? "Güncelle" : "Kaydet"}</button>
                  {editingPreorderId && <button type="button" className="btn-secondary" onClick={() => { setEditingPreorderId(null); setPreorderForm({ customerId: "", note: "", items: [{ productId: "", qty: "1" }] }); }}>Vazgeç</button>}
                </div>
                {message && <p className="text-sm text-red-600">{message}</p>}
              </div>
            </Card>

            {/* Bekleyen Ön Siparişler */}
            <Card title="Bekleyen Ön Siparişler">
              {preorders.filter((po) => po.status === "bekliyor").length === 0
                ? <p className="text-sm text-slate-500">Bekleyen ön sipariş yok.</p>
                : preorders.filter((po) => po.status === "bekliyor").map((po) => {
                  const items = preorderItems.filter((i) => i.preorder_id === po.id);
                  const customer = customerMap.get(po.customer_id);
                  return (
                    <div key={po.id} className="border rounded-xl p-4 mb-3 bg-white">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="font-semibold text-slate-800">{customer?.name || "—"}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{toTR(po.created_at, true)} · {po.created_by} {po.note ? `· ${po.note}` : ""}</div>
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
              {preorders.filter((po) => po.status === "tamamlandı").length === 0
                ? <p className="text-sm text-slate-500">Tamamlanan ön sipariş yok.</p>
                : preorders.filter((po) => po.status === "tamamlandı").map((po) => {
                  const items = preorderItems.filter((i) => i.preorder_id === po.id);
                  const customer = customerMap.get(po.customer_id);
                  return (
                    <div key={po.id} className="border rounded-xl p-4 mb-3 bg-slate-50">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="font-semibold text-slate-500">{customer?.name || "—"} <span className="text-xs text-green-600 font-semibold ml-1">✓ Tamamlandı</span></div>
                          <div className="text-xs text-slate-400 mt-0.5">{toTR(po.created_at, true)} · {po.created_by}</div>
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

        {convertModal && (() => {
          const { preorder: po, item } = convertModal;
          const customer = customerMap.get(po.customer_id);
          const product = productMap.get(item.product_id);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
              <div style={{background:"white",borderRadius:"16px",padding:"24px",width:"100%",maxWidth:"400px"}}>
                <h2 className="text-lg font-bold mb-1">Satışa Dönüştür</h2>
                <p className="text-sm text-slate-500 mb-4">{customer?.name} · {product?.name} × {item.qty}</p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Birim Fiyat</label>
                    <input className="input" type="number" min="0" placeholder="Birim fiyat" value={convertPrices[item.id] || ""} onChange={(e) => setConvertPrices({ [item.id]: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Ödeme Türü</label>
                    <select className="input" value={convertPaid} onChange={(e) => setConvertPaid(e.target.value)}>
                      <option value="false">Cari borç</option>
                      <option value="true">Peşin / Ödendi</option>
                    </select>
                  </div>
                </div>
                {message && <p className="text-sm text-red-600 mt-2">{message}</p>}
                <div className="flex gap-2 mt-4">
                  <button type="button" className="btn" onClick={convertToSales}>Satışa Dönüştür</button>
                  <button type="button" className="btn-secondary" onClick={() => { setConvertModal(null); setMessage(""); }}>Vazgeç</button>
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
                <select className="input" value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })}>
                  <option value="">Cari seçin</option>
                  {sortedActiveCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={saleForm.productId} onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value, batchId: "" })}>
                  <option value="">Ürün seçin</option>
                  {sortedActiveProducts
                    .filter((p) => {
                      const asliStock = batchItemsForProduct(p.id).filter((i) => i.depo === "Aslı-depo").reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
                      const mihriStock = batchItemsForProduct(p.id).filter((i) => i.depo === "Mihri-depo").reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
                      return asliStock > 0 || mihriStock > 0;
                    })
                    .map((p) => {
                      const asliStock = batchItemsForProduct(p.id).filter((i) => i.depo === "Aslı-depo").reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
                      const mihriStock = batchItemsForProduct(p.id).filter((i) => i.depo === "Mihri-depo").reduce((s, i) => s + Math.max(i.bought - getBatchSoldQtyForItem(i), 0), 0);
                      return <option key={p.id} value={p.id}>{p.name}  A: {asliStock}  M: {mihriStock}</option>;
                    })}
                </select>
                {/* Depo: her zaman göster, kullanıcıya göre default */}
                <select className="input" value={saleForm.depo} onChange={(e) => setSaleForm({ ...saleForm, depo: e.target.value, productId: "", batchId: "" })}>
                  <option value="Aslı-depo">Aslı-depo</option>
                  <option value="Mihri-depo">Mihri-depo</option>
                </select>
                {/* Parti: seçili depoda birden fazla stoklu parti varsa göster */}
                {saleForm.productId && (() => {
                  const partiler = batchItemsForProduct(saleForm.productId).filter((i) => {
                    const kalan = i.bought - getBatchSoldQtyForItem(i);
                    return kalan > 0 && i.depo === saleForm.depo;
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
                <select className="input" value={saleForm.seller} onChange={(e) => setSaleForm({ ...saleForm, seller: e.target.value as Seller })}><option>Aslı</option><option>Mihrimah</option></select>
                <select className="input" value={saleForm.saleType} onChange={(e) => {
                  const t = e.target.value as SaleType;
                  setSaleForm({ ...saleForm, saleType: t, customSalePrice: (t === "Fire/Bozuk" || t === "Hibe") ? "0" : saleForm.customSalePrice });
                }}>
                  <option>Normal satış</option><option>Fire/Bozuk</option><option>Hibe</option>
                </select>
                <input className="input" type="number" min="0" placeholder="Satış fiyatı" value={saleForm.customSalePrice} onChange={(e) => setSaleForm({ ...saleForm, customSalePrice: e.target.value })} />
                <select className="input" value={saleForm.paid} onChange={(e) => setSaleForm({ ...saleForm, paid: e.target.value })}><option value="false">Cari borç olarak yaz</option><option value="true">Ödeme alındı</option></select>
                <button type="button" className="btn" onClick={addSaleFromForm}>Satışı Kaydet</button>
              </div>
            </Card>

            <Card title="Satış Listesi">
              <Table
                headers={[salesTh("created_at","Tarih"), salesTh("customer","Müşteri"), salesTh("product","Ürün"), salesTh("batch","Parti"), salesTh("seller","Satıcı"), salesTh("sale_type","Tip"), salesTh("qty","Adet"), salesTh("total","Tutar"), salesTh("cost","Maliyet"), salesTh("profit","Kâr/Zarar"), "Durum", "İşlem"]}
                rows={sortedSales.map((sale) => {
                  const isEditing = editingSaleId === sale.id;
                  const draft = saleDrafts[sale.id];
                  return [
                    toTR(sale.created_at),
                    customerMap.get(sale.customer_id)?.name || "-",
                    productMap.get(sale.product_id)?.name || "-",
                    batchMap.get(sale.batch_id)?.name || "-",
                    isEditing ? <select key="seller" className="input" value={draft.seller} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], seller: e.target.value as Seller } }))}><option>Aslı</option><option>Mihrimah</option></select> : sale.seller,
                    isEditing ? <select key="type" className="input" value={draft.sale_type} onChange={(e) => { const t = e.target.value as SaleType; setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], sale_type: t, total: (t === "Fire/Bozuk" || t === "Hibe") ? "0" : p[sale.id].total } })); }}><option>Normal satış</option><option>Fire/Bozuk</option><option>Hibe</option></select> : sale.sale_type,
                    isEditing ? <select key="paid" className="input" value={draft.paid ? "true" : "false"} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], paid: e.target.value === "true" } }))}><option value="false">Cari borç</option><option value="true">Ödendi</option></select> : getSaleStatus(sale),
                    isEditing ? <input key="qty" className="input" style={{width:64}} type="number" min="1" value={draft.qty} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], qty: e.target.value } }))} /> : sale.qty,
                    isEditing ? <input key="total" className="input" style={{width:100}} type="number" min="0" value={draft.total} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], total: e.target.value } }))} /> : money(sale.total),
                    money(sale.cost),
                    <span key={sale.id} className={sale.total - sale.cost < 0 ? "text-red-600" : ""}>{money(sale.total - sale.cost)}</span>,
                    isEditing
                      ? <div key="actions" className="flex gap-2"><button type="button" className="btn" onClick={() => saveSaleEdit(sale.id)}>Kaydet</button><button type="button" className="btn-secondary" onClick={() => cancelSaleEdit(sale.id)}>Vazgeç</button></div>
                      : <div key="actions" className="flex gap-2"><button type="button" className="btn-secondary" onClick={() => startSaleEdit(sale)}>Değiştir</button><button type="button" className="btn-danger" onClick={() => deleteSale(sale.id)}>Sil</button></div>,
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
                      <th className="p-3 text-right font-semibold border border-slate-200">Veli</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Aslı</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Mihri</th>
                      <th className="p-3 text-right font-semibold border border-slate-200">Kasa</th>
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
                      const saveCost = async () => {
                        const existing = batchCosts.find((c) => c.batch_id === batch.id);
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
                          {(["veli","asli","mihrimah","kasa","kargo","diger"] as const).map((f) => (
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
                            <button type="button" className="btn-secondary text-xs px-3 py-1" onClick={saveCost}>Kaydet</button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    {sortedBatches.length > 0 && (
                      <tr className="bg-slate-200 font-bold">
                        <td className="p-3 border border-slate-300">Toplam</td>
                        {(["veli","asli","mihrimah","kasa","kargo","diger"] as const).map((f) => (
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
            <Card title="Yeni Dönem Açılışı">
              <p className="mb-4 text-sm text-slate-500">Yeni parti alımında sponsor ve ortak katkılarını girin. Ürün maliyeti ve kargo Aslı/Mihrimah arasında %50/%50 sorumluluk olarak hesaplanır.</p>
              <div className="grid gap-3 md:grid-cols-5">
                <label className="field-label"><span>Dönem adı</span><input className="input" value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} /></label>
                <label className="field-label"><span>Veli sponsor katkısı</span><input className="input" type="number" value={periodForm.sponsor} onChange={(e) => setPeriodForm({ ...periodForm, sponsor: e.target.value })} /></label>
                <label className="field-label"><span>Aslı katkısı</span><input className="input" type="number" value={periodForm.asli} onChange={(e) => setPeriodForm({ ...periodForm, asli: e.target.value })} /></label>
                <label className="field-label"><span>Mihrimah katkısı</span><input className="input" type="number" value={periodForm.mihrimah} onChange={(e) => setPeriodForm({ ...periodForm, mihrimah: e.target.value })} /></label>
                <label className="field-label"><span>Ürün toplam maliyeti</span><input className="input" type="number" value={periodForm.productCost} onChange={(e) => setPeriodForm({ ...periodForm, productCost: e.target.value })} /></label>
                <label className="field-label"><span>Kargo gideri</span><input className="input" type="number" value={periodForm.shippingCost} onChange={(e) => setPeriodForm({ ...periodForm, shippingCost: e.target.value })} /></label>
                <button type="button" className="btn" onClick={applyPeriodOpening}>Dönem Açılışını İşle</button>
              </div>
            </Card>

            <Card title="Dönem Kapatma Simülasyonu">
              <p className="mb-5 text-slate-500">Yeni parti alımından önce kasa eşit dağıtılır; borcu olan ortağın payı önce borcundan düşülür.</p>
              <div className="mb-5 grid gap-4 text-sm md:grid-cols-5">
                <div className="rounded-xl bg-slate-100 p-4">Toplam tahsilat<br /><b>{money(totals.grossCash)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Önceki dağıtımlar<br /><b>{money(totals.distributedCash)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Kasadaki para<br /><b>{money(totals.cash)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Aslı payı<br /><b>{money(totals.cash / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Mihrimah payı<br /><b>{money(totals.cash / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Müşteri cari<br /><b>{money(totals.customerDebt)}</b></div>
              </div>
              <button type="button" className="btn" onClick={closePeriod}>Dönemi Kapat ve Mahsuplaştır</button>
            </Card>

            <Card title="Dönem Geçmişi">
              <Table
                headers={["Dönem", "Sponsor", "Aslı Katkı", "Mihrimah Katkı", "Ürün Maliyeti", "Kargo", "Dağıtılan Kasa", "Aslı Dağıtım", "Mihrimah Dağıtım", "Durum", "Kapanış"]}
                rows={periods.map((p) => [
                  p.name,
                  money(p.sponsor_contribution),
                  money(p.asli_contribution),
                  money(p.mihrimah_contribution),
                  money(p.product_cost),
                  money(p.shipping_cost),
                  money(Number(p.closing_cash || 0)),
                  money(Number(p.asli_distribution || 0)),
                  money(Number(p.mihrimah_distribution || 0)),
                  p.closed ? "Kapalı" : "Açık",
                  p.closed_at ? new Date(p.closed_at).toLocaleDateString("tr-TR") : "-",
                ])}
              />
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
        .product-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; overflow: hidden; transition: box-shadow 0.15s; }
        .product-card--open { box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-color: #cbd5e1; }

        .product-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 14px 14px 16px; text-align: left; background: transparent; border: none; cursor: pointer; }
        .product-row:active { background: #f8fafc; }
        .product-row-left { flex: 1; min-width: 0; }
        .product-name { font-size: 0.9375rem; font-weight: 700; color: #0f172a; line-height: 1.3; }
        .product-meta { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }

        .product-row-stats { display: flex; gap: 6px; flex-shrink: 0; }
        .product-stat-chip { background: #f1f5f9; border-radius: 10px; padding: 5px 8px; text-align: center; min-width: 48px; }
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
        .product-batch-thead { display: grid; grid-template-columns: 1.2fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.9fr; padding: 8px 12px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1.5px solid #e2e8f0; align-items: end; }
        .product-batch-thead > div:not(:first-child):not(:nth-child(2)) { writing-mode: vertical-rl; transform: rotate(180deg); text-align: left; line-height: 1; }
        .product-batch-row { display: grid; grid-template-columns: 1.2fr 0.9fr 0.6fr 0.6fr 0.6fr 0.9fr 0.9fr; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.8125rem; }
        .product-batch-row:last-child { border-bottom: none; }
        .product-batch-cell { color: #334155; }
        .product-batch-cell--name { font-weight: 600; color: #0f172a; }
        .product-batch-empty { padding: 12px; font-size: 0.8125rem; color: #94a3b8; text-align: center; }

        /* Action Buttons */
        .product-action-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .product-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 12px; padding: 10px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; border: none; }
        .product-btn--secondary { background: white; color: #334155; border: 1.5px solid #e2e8f0; }
        .product-btn--danger { background: white; color: #dc2626; border: 1.5px solid #fecaca; }

        /* Edit Form */
        .product-edit-form { display: flex; flex-direction: column; gap: 14px; }
        .product-edit-image-row { display: flex; align-items: center; gap: 12px; }
        .product-img-change-btn { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; font-size: 0.8125rem; font-weight: 600; color: #334155; cursor: pointer; background: white; }
        .product-edit-fields { display: grid; gap: 10px; }

        /* Add Button */
        .product-add-wrap { padding: 12px 16px 24px; }
        .product-add-wrap--top { padding: 8px 16px 4px; }
        .product-add-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: #0f172a; color: white; border: none; border-radius: 16px; padding: 16px; font-size: 1rem; font-weight: 700; cursor: pointer; letter-spacing: -0.01em; }
        .product-add-form-panel { padding: 16px; border-top: 1.5px solid #f1f5f9; background: #fafafa; }

        /* Cari tables */
        .cari-payment-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
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
          <p className="mb-6 text-slate-500">Satış / stok paneli</p>
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
