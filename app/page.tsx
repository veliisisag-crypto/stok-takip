"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GenderCategory = "Kadın" | "Erkek" | "Unisex";
type SaleType = "Normal satış" | "Fire/Bozuk" | "Hibe";
type Seller = "Aslı" | "Mihrimah";

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
};

type Sale = {
  id: string;
  customer_id: string;
  product_id: string;
  batch_id: string;
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

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap p-3 text-left font-semibold">
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

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleDrafts, setSaleDrafts] = useState<Record<string, { qty: string; total: string; seller: Seller; sale_type: SaleType }>>({});
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, Partial<Product>>>({});
  const [customerDrafts, setCustomerDrafts] = useState<Record<string, Partial<Customer>>>({});
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState({ name: "", genderCategory: "Kadın" as GenderCategory, image: "" });
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [batchReportFilter, setBatchReportFilter] = useState("Tümü");
  const [batchForm, setBatchForm] = useState({ batchId: "", productId: "", bought: "", buyPrice: "", salePrice: "" });
  const [saleForm, setSaleForm] = useState({ customerId: "", productId: "", qty: "1", seller: "Aslı" as Seller, saleType: "Normal satış" as SaleType, paid: "false", customSalePrice: "" });
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
      const [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, auditLogsRes] = await Promise.all([
        supabase.from("products").select("id,name,code,gender_category,image_url,passive").order("created_at", { ascending: true }),
        supabase.from("customers").select("*").order("created_at", { ascending: true }),
        supabase.from("batches").select("*").order("created_at", { ascending: true }),
        supabase.from("batch_items").select("*").order("created_at", { ascending: true }),
        supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("partner_ledger").select("*").order("partner_name", { ascending: true }),
        supabase.from("periods").select("*").order("created_at", { ascending: false }),
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      for (const res of [productsRes, customersRes, batchesRes, batchItemsRes, salesRes, paymentsRes, partnersRes, periodsRes, auditLogsRes]) {
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
      setAuditLogs((auditLogsRes.data || []) as AuditLog[]);
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

  const getBatchSoldQty = (productId: string, batchId: string) =>
    activeSales.filter((sale) => sale.product_id === productId && sale.batch_id === batchId).reduce((sum, sale) => sum + sale.qty, 0);

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
    const revenue = activeSales.reduce((sum, item) => sum + item.total, 0);
    const profit = activeSales.reduce((sum, item) => sum + (item.total - item.cost), 0);
    const customerDebt = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const stockValue = batchItems.reduce((sum, item) => sum + Math.max(item.bought - getBatchSoldQty(item.product_id, item.batch_id), 0) * item.buy_price, 0);
    const totalStock = products.filter((p) => !p.passive).reduce((sum, p) => sum + getProductStock(p.id), 0);
    const grossCash = activeSales.filter((item) => item.paid).reduce((sum, item) => sum + item.total, 0) + activePayments.reduce((sum, item) => sum + item.amount, 0);
    const distributedCash = periods
      .filter((period) => period.closed)
      .reduce((sum, period) => sum + Number(period.asli_distribution || 0) + Number(period.mihrimah_distribution || 0), 0);
    const cash = Math.max(grossCash - distributedCash, 0);
    return { revenue, profit, customerDebt, stockValue, totalStock, grossCash, distributedCash, cash };
  }, [products, customers, batchItems, activeSales, activePayments, periods]);


  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return sortedCustomers;
    return sortedCustomers.filter((customer) => customer.name.toLowerCase().includes(query));
  }, [sortedCustomers, customerSearch]);

  const recentMovements = useMemo(() => {
    const saleRows = activeSales.map((sale) => ({
      id: `sale-${sale.id}`,
      date: sale.created_at,
      type: sale.paid ? "Peşin satış" : "Cari satış",
      customer: customerMap.get(sale.customer_id)?.name || "-",
      detail: `${productMap.get(sale.product_id)?.name || "-"} / ${batchMap.get(sale.batch_id)?.name || "-"} / ${sale.qty} adet`,
      amount: toNum(sale.total),
    }));

    const paymentRows = activePayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.created_at,
      type: "Tahsilat",
      customer: customerMap.get(payment.customer_id)?.name || "-",
      detail: "Cari ödeme",
      amount: toNum(payment.amount),
    }));

    const auditRows = auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      date: log.created_at,
      type: log.action,
      customer: log.entity_type,
      detail: log.entity_name || "-",
      amount: 0,
    }));

    return [...saleRows, ...paymentRows, ...auditRows]
      .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())
      .slice(0, 20);
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
    await logAction("Ürün değiştirildi", "products", products.find((p) => p.id === productId)?.name || productId, dbPatch);
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
    });
    if (error) return showError(error);
    await logAction("Partiye ürün eklendi", "batch_items", `${productMap.get(productId)?.name || productId} / ${batchMap.get(batchId)?.name || batchId}`, { adet: bought, alis: buyPrice, satis: salePrice });
    setBatchForm({ batchId, productId: "", bought: "", buyPrice: "", salePrice: "" });
    setMessage("Parti ürün kaydı eklendi.");
    loadAll();
  };

  const updateBatchItem = async (itemId: string, patch: Partial<BatchItem>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.batch_id !== undefined) dbPatch.batch_id = patch.batch_id;
    if (patch.bought !== undefined) dbPatch.bought = patch.bought;
    if (patch.buy_price !== undefined) dbPatch.buy_price = patch.buy_price;
    if (patch.sale_price !== undefined) dbPatch.sale_price = patch.sale_price;
    const { error } = await supabase.from("batch_items").update(dbPatch).eq("id", itemId);
    if (error) return showError(error);
    await logAction("Parti ürün satırı değiştirildi", "batch_items", itemId, dbPatch);
    loadAll();
  };

  const deleteBatchItem = async (item: BatchItem) => {
    const sold = getBatchSoldQty(item.product_id, item.batch_id);
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
    if (getProductStock(product.id) < qty) return setMessage("Yetersiz stok.");

    let remainingQty = qty;
    const rows: Record<string, unknown>[] = [];

    for (const item of batchItemsForProduct(product.id)) {
      if (remainingQty <= 0) break;
      const available = Math.max(item.bought - getBatchSoldQty(product.id, item.batch_id), 0);
      const take = Math.min(available, remainingQty);
      if (take <= 0) continue;
      const isZeroPrice = saleForm.saleType === "Hibe" || saleForm.saleType === "Fire/Bozuk";
      const unitSalePrice = isZeroPrice ? 0 : Number(saleForm.customSalePrice || item.sale_price || 0);
      rows.push({
        customer_id: customer.id,
        product_id: product.id,
        batch_id: item.batch_id,
        seller: saleForm.seller,
        sale_type: saleForm.saleType,
        qty: take,
        total: unitSalePrice * take,
        cost: item.buy_price * take,
        paid: saleForm.paid === "true" || isZeroPrice,
        paid_amount: saleForm.paid === "true" || isZeroPrice ? unitSalePrice * take : 0,
        cancelled: false,
      });
      remainingQty -= take;
    }

    if (remainingQty > 0) return setMessage("Parti stokları yetersiz.");
    const { error } = await supabase.from("sales").insert(rows);
    if (error) return showError(error);
    await logAction("Satış eklendi", "sales", `${customer.name} - ${product.name}`, { adet: qty, toplam: rows.reduce((sum, row) => sum + Number(row.total || 0), 0), satir_sayisi: rows.length });
    setSaleForm({ customerId: "", productId: "", qty: "1", seller: "Aslı", saleType: "Normal satış", paid: "false", customSalePrice: "" });
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
    if (patch.paid !== undefined) dbPatch.paid = patch.paid;
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
      [sale.id]: { qty: String(sale.qty), total: String(sale.total), seller: sale.seller, sale_type: sale.sale_type },
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
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount });
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

  const markPayment = async (customerId: string) => {
    const balance = getCustomerBalance(customerId);
    if (balance <= 0) return;
    const { error } = await supabase.from("payments").insert({ customer_id: customerId, amount: balance });
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
    let imageUrl = draft.image_url ?? null;

    // If it's a new base64 image (not already a URL), upload to Storage
    if (imageUrl && imageUrl.startsWith("data:")) {
      setMessage("Resim yükleniyor...");
      const product = products.find((p) => p.id === productId);
      imageUrl = await uploadImageToStorage(imageUrl, product?.code || productId);
    }

    await updateProduct(productId, {
      name: String(draft.name || "").trim(),
      gender_category: draft.gender_category as GenderCategory,
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
    ["products", "Ürünler"],
    ["batchEntry", "Parti/Ürün Girişi"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
    ["partners", "Ortaklık Muhasebesi"],
    ["period", "Dönem Açılış/Kapanış"],
    ["audit", "İşlem Geçmişi"],
  ];

  const filteredProducts = sortedProducts.filter((p) => `${p.name} ${p.code} ${p.gender_category}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{position:"fixed",inset:0,zIndex:999999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}
        >
          <img
            src={lightboxImg}
            alt="Tam ekran"
            style={{maxWidth:"95vw",maxHeight:"92vh",borderRadius:12,objectFit:"contain",boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxImg(null)}
            style={{position:"absolute",top:16,right:16,background:"white",border:"none",borderRadius:"50%",width:36,height:36,fontSize:20,lineHeight:1,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}
          >✕</button>
        </div>
      )}
      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r bg-white p-5 lg:block">
        <div className="mb-8">
          <h1 className="text-lg font-bold">Ticari Takip</h1>
          <p className="text-xs text-slate-500">Supabase bağlı sürüm</p>
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
              <StatCard title="Kasadaki Nakit" value={money(totals.cash)} note="Tahsilat - dönem dağıtımları" />
              <StatCard title="Müşteri Borcu" value={money(totals.customerDebt)} note="Cari satış - ödeme" />
              <StatCard title="Mevcut Stok" value={totals.totalStock} />
            </div>
            <Card title="Son Hareketler">
              <Table
                headers={["Tarih", "Tür", "Cari", "Detay", "Tutar"]}
                rows={recentMovements.map((movement) => [
                  movement.date?.slice(0, 16).replace("T", " ") || "-",
                  movement.type,
                  movement.customer,
                  movement.detail,
                  money(movement.amount),
                ])}
              />
            </Card>
          </div>
        )}


        {active === "recent" && (
          <div className="space-y-4">
            <Card title="Son Hareketler">
              <Table
                headers={["Tarih", "Tür", "Cari", "Detay", "Tutar"]}
                rows={recentMovements.map((movement) => [
                  movement.date?.slice(0, 16).replace("T", " ") || "-",
                  movement.type,
                  movement.customer,
                  movement.detail,
                  money(movement.amount),
                ])}
              />
            </Card>
          </div>
        )}

        {active === "audit" && (
          <div className="space-y-4">
            <Card title="İşlem Geçmişi">
              <Table
                headers={["Tarih", "İşlem", "Tablo", "Kayıt", "Kullanıcı"]}
                rows={auditLogs.map((log) => [
                  log.created_at?.slice(0, 16).replace("T", " ") || "-",
                  log.action,
                  log.entity_type,
                  log.entity_name || "-",
                  log.user_email || "-",
                ])}
              />
            </Card>
          </div>
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
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), image_url: String(reader.result || "") } }); reader.readAsDataURL(file); }} />
                                </label>
                              </div>
                              <div className="product-edit-fields">
                                <label className="field-label"><span>Ürün adı</span><input className="input" maxLength={50} value={String(draft.name ?? p.name)} onChange={(e) => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), name: e.target.value } })} /></label>
                                <label className="field-label"><span>Kategori</span><select className="input" value={String(draft.gender_category ?? p.gender_category)} onChange={(e) => setProductDrafts({ ...productDrafts, [p.id]: { ...(productDrafts[p.id] || {}), gender_category: e.target.value as GenderCategory } })}><option>Kadın</option><option>Erkek</option><option>Unisex</option></select></label>
                              </div>
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
                                  <div className="product-batch-thead"><div>Parti</div><div>Alındı</div><div>Satıldı</div><div>Kalan</div><div>Alış</div><div>Satış</div></div>
                                  {batchItemsForProduct(p.id).length ? batchItemsForProduct(p.id).map((item) => {
                                    const sold = getBatchSoldQty(p.id, item.batch_id);
                                    return (
                                      <div key={item.id} className="product-batch-row">
                                        <div className="product-batch-cell product-batch-cell--name">{batchMap.get(item.batch_id)?.name || "-"}</div>
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
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => startProductEdit(p)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                                  Resim Değiştir
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
                <button type="button" className="btn" onClick={addBatchProduct}>Partiye Ürün Ekle</button>
              </div>
            </Card>

            <Card title="Parti Bazlı Ürün / Stok Raporu">
              <select className="input mb-4 max-w-xs" value={batchReportFilter} onChange={(e) => setBatchReportFilter(e.target.value)}>
                <option value="Tümü">Tüm Partiler</option>
                {sortedBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
              </select>
              <Table
                headers={["Parti", "Ürün", "Alınan", "Satılan", "Kalan", "Alış", "Satış", "İşlem"]}
                rows={batchItems
                  .filter((item) => batchReportFilter === "Tümü" || item.batch_id === batchReportFilter)
                  .map((item) => {
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
                      getBatchSoldQty(item.product_id, item.batch_id),
                      item.bought - getBatchSoldQty(item.product_id, item.batch_id),
                      editingBatchItemId === key ? <input className="input w-24" type="number" value={item.buy_price} onChange={(e) => updateBatchItem(item.id, { buy_price: Number(e.target.value || 0) })} /> : money(item.buy_price),
                      editingBatchItemId === key ? <input className="input w-24" type="number" value={item.sale_price} onChange={(e) => updateBatchItem(item.id, { sale_price: Number(e.target.value || 0) })} /> : money(item.sale_price),
                      <div key={key} className="flex gap-2">
                        <button type="button" className="btn-secondary" onClick={() => setEditingBatchItemId(editingBatchItemId === key ? null : key)}>Değiştir</button>
                        <button type="button" className="btn-danger" onClick={() => deleteBatchItem(item)}>Sil</button>
                      </div>,
                    ];
                  })}
              />
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
                                <button type="button" className="product-btn product-btn--secondary" onClick={() => markPayment(c.id)}>Tamamı Ödendi</button>
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
                                const d = sale.created_at?.slice(0, 10) || "";
                                const fmtDate = d ? `${d.slice(8,10)}.${d.slice(5,7)}.${d.slice(0,4)}` : "-";
                                return (
                                  <div key={sale.id} className="cari-sales-row">
                                    <div className="product-batch-cell" style={{fontSize:"0.68rem"}}>{fmtDate}</div>
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
                                <div>Tarih</div><div>Tutar</div>
                              </div>
                              {customerPayments.length ? customerPayments.map((pay) => {
                                const d = pay.created_at?.slice(0, 10) || "";
                                const fmtDate = d ? `${d.slice(8,10)}.${d.slice(5,7)}.${d.slice(0,4)}` : "-";
                                return (
                                  <div key={pay.id} className="cari-pay-row">
                                    <div className="product-batch-cell" style={{fontSize:"0.8rem"}}>{fmtDate}</div>
                                    <div className="product-batch-cell" style={{fontSize:"0.8rem"}}>{money(pay.amount)}</div>
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

        {active === "sales" && (
          <div className="space-y-4">
            <Card title="Yeni Satış Girişi">
              <p className="mb-5 text-slate-500">Satış girebilmek için önce cari kaydı ve ürün kaydı var olmalıdır.</p>
              <div className="grid gap-3 md:grid-cols-4">
                <select className="input" value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })}>
                  <option value="">Cari seçin</option>
                  {sortedActiveCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={saleForm.productId} onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value })}>
                  <option value="">Ürün seçin</option>
                  {sortedActiveProducts.map((p) => <option key={p.id} value={p.id}>{p.name} - Stok: {getProductStock(p.id)}</option>)}
                </select>
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
                headers={["Tarih", "Müşteri", "Ürün", "Parti", "Satıcı", "Tip", "Adet", "Tutar", "Maliyet", "Kâr/Zarar", "Durum", "İşlem"]}
                rows={activeSales.map((sale) => {
                  const isEditing = editingSaleId === sale.id;
                  const draft = saleDrafts[sale.id];
                  return [
                    sale.created_at?.slice(0, 10),
                    customerMap.get(sale.customer_id)?.name || "-",
                    productMap.get(sale.product_id)?.name || "-",
                    batchMap.get(sale.batch_id)?.name || "-",
                    isEditing
                      ? <select key="seller" className="input" value={draft.seller} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], seller: e.target.value as Seller } }))}><option>Aslı</option><option>Mihrimah</option></select>
                      : sale.seller,
                    isEditing
                      ? <select key="type" className="input" value={draft.sale_type} onChange={(e) => { const t = e.target.value as SaleType; setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], sale_type: t, total: (t === "Fire/Bozuk" || t === "Hibe") ? "0" : p[sale.id].total } })); }}><option>Normal satış</option><option>Fire/Bozuk</option><option>Hibe</option></select>
                      : sale.sale_type,
                    isEditing
                      ? <input key="qty" className="input w-20" type="number" min="1" value={draft.qty} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], qty: e.target.value } }))} />
                      : sale.qty,
                    isEditing
                      ? <input key="total" className="input w-28" type="number" min="0" value={draft.total} onChange={(e) => setSaleDrafts((p) => ({ ...p, [sale.id]: { ...p[sale.id], total: e.target.value } }))} />
                      : money(sale.total),
                    money(sale.cost),
                    <span key={sale.id} className={sale.total - sale.cost < 0 ? "text-red-600" : ""}>{money(sale.total - sale.cost)}</span>,
                    getSaleStatus(sale),
                    isEditing
                      ? <div key="actions" className="flex gap-2">
                          <button type="button" className="btn" onClick={() => saveSaleEdit(sale.id)}>Kaydet</button>
                          <button type="button" className="btn-secondary" onClick={() => cancelSaleEdit(sale.id)}>Vazgeç</button>
                        </div>
                      : <div key="actions" className="flex gap-2">
                          <button type="button" className="btn-secondary" onClick={() => startSaleEdit(sale)}>Değiştir</button>
                          <button type="button" className="btn-danger" onClick={() => deleteSale(sale.id)}>Sil</button>
                        </div>,
                  ];
                })}
              />
            </Card>
          </div>
        )}

        {active === "partners" && (
          <div className="grid gap-4 md:grid-cols-3">
            {partners.map((row) => (
              <Card key={row.id}>
                <h3 className="text-xl font-bold">{row.partner_name}</h3>
                <p className="mb-4 text-sm text-slate-500">{row.role}</p>
                <div className="space-y-2 text-sm">
                  {(["contribution", "receivable", "debt", "profit_share"] as const).map((field) => (
                    <div className="flex items-center justify-between gap-3" key={field}>
                      <span>{field === "contribution" ? "Katılım" : field === "receivable" ? "Alacak" : field === "debt" ? "Borç" : "Kâr Payı/Mahsup"}</span>
                      {editingPartnerId === row.id ? (
                        <input className="input w-32" type="number" value={row[field]} onChange={(e) => updatePartner(row.id, field, Number(e.target.value || 0))} />
                      ) : (
                        <b className={field === "debt" && row.debt > 0 ? "text-red-600" : ""}>{money(Number(row[field] || 0))}</b>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-secondary mt-4" onClick={() => setEditingPartnerId(editingPartnerId === row.id ? null : row.id)}>Değiştir</button>
              </Card>
            ))}
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
        .product-batch-thead { display: grid; grid-template-columns: 1.4fr 0.7fr 0.7fr 0.7fr 1fr 1fr; padding: 8px 12px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; border-bottom: 1.5px solid #e2e8f0; align-items: end; }
        .product-batch-thead > div:not(:first-child) { writing-mode: vertical-rl; transform: rotate(180deg); text-align: left; line-height: 1; }
        .product-batch-row { display: grid; grid-template-columns: 1.4fr 0.7fr 0.7fr 0.7fr 1fr 1fr; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.8125rem; }
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
        .cari-pay-thead { display: grid; grid-template-columns: 1fr 1fr; padding: 8px 12px; background: #f8fafc; font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 1.5px solid #e2e8f0; }
        .cari-pay-row { display: grid; grid-template-columns: 1fr 1fr; padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
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
            <input className="w-full rounded-xl border p-3" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full rounded-xl border p-3" placeholder="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={login} className="w-full rounded-xl bg-black p-3 font-semibold text-white">Giriş Yap</button>
          </div>
        </div>
      </main>
    );
  }

  return <AppContent onLogout={logout} />;
}
