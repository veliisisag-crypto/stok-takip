"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type GenderCategory = "Kadın" | "Erkek" | "Unisex";
type SaleType = "Normal satış" | "İndirimli satış" | "Kârsız satış" | "Zararına satış" | "Hibe";
type Seller = "Aslı" | "Mihrimah";

type BatchRow = {
  batch: string;
  bought: number;
  sold: number;
  buyPrice: number;
  salePrice: number;
};

type Product = {
  id: number;
  name: string;
  code: string;
  genderCategory: GenderCategory;
  image: string;
  stock: number;
  minStock: number;
  batches: BatchRow[];
  passive?: boolean;
};

type Customer = {
  id: number;
  name: string;
  debit: number;
  credit: number;
  passive?: boolean;
};

type Sale = {
  id: number;
  customer: string;
  product: string;
  batch: string;
  qty: number;
  total: number;
  cost: number;
  profit: number;
  paid: boolean;
  date: string;
  seller: Seller;
  enteredBy: string;
  saleType: SaleType;
  cancelled?: boolean;
};

type PartnerLedger = {
  Veli: { role: string; contribution: number; receivable: number; debt: number; profitShare: number };
  Aslı: { role: string; contribution: number; receivable: number; debt: number; profitShare: number };
  Mihrimah: { role: string; contribution: number; receivable: number; debt: number; profitShare: number };
};

const initialProducts: Product[] = [];

const initialCustomers: Customer[] = [];

const initialSales: Sale[] = [];

const initialPartnerLedger: PartnerLedger = {
  Veli: { role: "Sponsor", contribution: 0, receivable: 0, debt: 0, profitShare: 0 },
  Aslı: { role: "Ortak/Satıcı", contribution: 0, receivable: 0, debt: 0, profitShare: 0 },
  Mihrimah: { role: "Ortak/Satıcı", contribution: 0, receivable: 0, debt: 0, profitShare: 0 },
};

const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n || 0);

const today = () => new Date().toISOString().slice(0, 10);

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

function AppContent()  {
  const [active, setActive] = useState("dashboard");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [partnerLedger, setPartnerLedger] = useState<PartnerLedger>(initialPartnerLedger);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [paymentInputs, setPaymentInputs] = useState<Record<number, string>>({});
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingBatchKey, setEditingBatchKey] = useState<string | null>(null);
  const [editingPartner, setEditingPartner] = useState<keyof PartnerLedger | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    genderCategory: "Kadın" as GenderCategory,
    image: "",
    minStock: "5",
  });

  const [newCustomerName, setNewCustomerName] = useState("");
  const [batches, setBatches] = useState<string[]>([]);
  const [newBatchName, setNewBatchName] = useState("");
  const [batchReportFilter, setBatchReportFilter] = useState("Tümü");

  const [batchForm, setBatchForm] = useState({
    batch: "",
    productId: "",
    bought: "",
    buyPrice: "",
    salePrice: "",
    minStock: "5",
  });

  const [saleForm, setSaleForm] = useState({
    customerId: "",
    productId: "",
    qty: "1",
    seller: "Aslı" as Seller,
    saleType: "Normal satış" as SaleType,
    paid: "false",
    customSalePrice: "",
  });

  const [periodForm, setPeriodForm] = useState({
    sponsor: "0",
    asli: "0",
    mihrimah: "0",
    productCost: "0",
    shippingCost: "0",
  });

  const activeSales = sales.filter((sale) => !sale.cancelled);

  const getBatchSoldQty = (productName: string, batchName: string) =>
    activeSales
      .filter((sale) => sale.product === productName && sale.batch.split(",").map((b) => b.trim()).includes(batchName))
      .reduce((sum, sale) => sum + sale.qty, 0);

  const getProductTotalBought = (product: Product) =>
    product.batches.reduce((sum, batch) => sum + batch.bought, 0);

  const getProductSoldQty = (product: Product) =>
    product.batches.reduce((sum, batch) => sum + getBatchSoldQty(product.name, batch.batch), 0);

  const getProductStock = (product: Product) =>
    getProductTotalBought(product) - getProductSoldQty(product);

  const totals = useMemo(() => {
    const revenue = activeSales.reduce((sum, item) => sum + item.total, 0);
    const profit = activeSales.reduce((sum, item) => sum + item.profit, 0);
    const customerDebt = customers.reduce((sum, c) => sum + Math.max(c.debit - c.credit, 0), 0);
    const stockValue = products.reduce(
      (sum, p) => sum + p.batches.reduce((bSum, b) => bSum + Math.max(b.bought - getBatchSoldQty(p.name, b.batch), 0) * b.buyPrice, 0),
      0
    );
    const lowStock = products.filter((p) => !p.passive && getProductStock(p) <= p.minStock).length;
    const cash = activeSales.filter((item) => item.paid).reduce((sum, item) => sum + item.total, 0);
    return { revenue, profit, customerDebt, stockValue, lowStock, cash };
  }, [products, customers, activeSales]);

  const addProductDefinition = () => {
    const name = newProduct.name.trim();
    if (!name || name.length > 50) return setMessage("Ürün adı zorunlu ve en fazla 50 karakter olmalı.");
    if (products.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setMessage("Bu kaynak ürün zaten kayıtlı.");

    const id = Date.now();
    setProducts([
      ...products,
      {
        id,
        name,
        code: `URN-${String(id).slice(-4)}`,
        genderCategory: newProduct.genderCategory,
        image: newProduct.image,
        stock: 0,
        minStock: Number(newProduct.minStock || 5),
        batches: [],
      },
    ]);
    setNewProduct({ name: "", genderCategory: "Kadın", image: "", minStock: "5" });
    setMessage("Kaynak ürün kaydedildi.");
  };

  const deleteProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const hasSales = sales.some((sale) => sale.product === product.name && !sale.cancelled);
    if (hasSales) {
      setProducts(products.map((p) => (p.id === productId ? { ...p, passive: true } : p)));
      setMessage("Ürün satışlarda kullanıldığı için silinmedi, pasife alındı.");
      return;
    }
    setProducts(products.filter((p) => p.id !== productId));
    setMessage("Ürün silindi.");
  };

  const updateProduct = (productId: number, patch: Partial<Product>) => {
    setProducts(products.map((p) => (p.id === productId ? { ...p, ...patch } : p)));
  };

  const addCustomer = () => {
    const name = newCustomerName.trim();
    if (!name || name.length > 50) return setMessage("Cari adı zorunlu ve en fazla 50 karakter olmalı.");
    if (customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) return setMessage("Bu cari zaten kayıtlı.");
    setCustomers([...customers, { id: Date.now(), name, debit: 0, credit: 0 }]);
    setNewCustomerName("");
  };

  const deleteCustomer = (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    const hasSales = sales.some((sale) => sale.customer === customer.name && !sale.cancelled);
    if (hasSales || customer.debit > 0 || customer.credit > 0) {
      setCustomers(customers.map((c) => (c.id === customerId ? { ...c, passive: true } : c)));
      setMessage("Cari hareket gördüğü için silinmedi, pasife alındı.");
      return;
    }
    setCustomers(customers.filter((c) => c.id !== customerId));
    setMessage("Cari silindi.");
  };

  const updateCustomerName = (customerId: number, name: string) => {
    if (name.length > 50) return;
    setCustomers(customers.map((c) => (c.id === customerId ? { ...c, name } : c)));
  };

  const addBatchName = () => {
    const name = newBatchName.trim();
    if (!name) return setMessage("Parti adı boş olamaz.");
    if (batches.includes(name)) return setMessage("Bu parti zaten kayıtlı.");
    setBatches([...batches, name]);
    setBatchForm({ ...batchForm, batch: name });
    setNewBatchName("");
    setMessage("Yeni parti adı kaynak listeye eklendi.");
  };

  const deleteBatchName = (batch: string) => {
    const used = products.some((p) => p.batches.some((b) => b.batch === batch));
    if (used) return setMessage("Bu parti ürün girişlerinde kullanıldığı için silinemez.");
    setBatches(batches.filter((b) => b !== batch));
  };

  const renameBatchName = (oldName: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || clean === oldName) return;
    if (batches.includes(clean)) return setMessage("Bu parti adı zaten var.");
    setBatches(batches.map((b) => (b === oldName ? clean : b)));
    setProducts(products.map((p) => ({ ...p, batches: p.batches.map((b) => (b.batch === oldName ? { ...b, batch: clean } : b)) })));
    setSales(sales.map((s) => (s.batch === oldName ? { ...s, batch: clean } : s)));
  };

  const addBatchProduct = () => {
    const productId = Number(batchForm.productId);
    const bought = Number(batchForm.bought || 0);
    const buyPrice = Number(batchForm.buyPrice || 0);
    const salePrice = Number(batchForm.salePrice || 0);
    if (!productId) return setMessage("Parti kaydı için kaynak ürün seçmelisiniz.");
    if (!batchForm.batch.trim()) return setMessage("Parti adı zorunlu.");
    if (bought <= 0 || buyPrice <= 0) return setMessage("Adet ve alış fiyatı 0'dan büyük olmalı.");

    const selectedProduct = products.find((p) => p.id === productId);
    if (!selectedProduct) return setMessage("Seçilen kaynak ürün bulunamadı.");

    setProducts((currentProducts) =>
      currentProducts.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          stock: p.stock + bought,
          minStock: Number(batchForm.minStock || p.minStock),
          batches: [...p.batches, { batch: batchForm.batch.trim(), bought, sold: 0, buyPrice, salePrice }],
        };
      })
    );
    setBatchForm({ batch: batchForm.batch, productId: "", bought: "", buyPrice: "", salePrice: "", minStock: "5" });
    setMessage(`${selectedProduct.name} için ${batchForm.batch} parti kaydı eklendi.`);
  };

  const updateBatchRow = (productId: number, batchIndex: number, patch: Partial<BatchRow>) => {
    setProducts(
      products.map((p) => {
        if (p.id !== productId) return p;
        const batches = p.batches.map((b, i) => (i === batchIndex ? { ...b, ...patch } : b));
        const stock = batches.reduce((sum, b) => sum + Math.max(b.bought - getBatchSoldQty(p.name, b.batch), 0), 0);
        return { ...p, batches, stock };
      })
    );
  };

  const deleteBatchRow = (productId: number, batchIndex: number) => {
    setProducts(
      products.map((p) => {
        if (p.id !== productId) return p;
        const target = p.batches[batchIndex];
        const soldFromSales = target ? getBatchSoldQty(p.name, target.batch) : 0;
        if (!target || soldFromSales > 0) {
          setMessage("Bu parti satırına bağlı aktif satış var. Önce ilgili satışları iptal edin, sonra parti satırını silebilirsiniz.");
          return p;
        }
        const remaining = p.batches.filter((_, index) => index !== batchIndex);
        return { ...p, batches: remaining, stock: remaining.reduce((sum, b) => sum + Math.max(b.bought - getBatchSoldQty(p.name, b.batch), 0), 0) };
      })
    );
  };

  const addSaleFromForm = () => {
    const customer = customers.find((c) => c.id === Number(saleForm.customerId));
    const product = products.find((p) => p.id === Number(saleForm.productId));
    const qty = Number(saleForm.qty || 0);
    if (!customer || !product || qty <= 0) return setMessage("Cari, ürün ve adet zorunlu.");
    if (getProductStock(product) < qty) return setMessage("Yetersiz stok.");

    let remainingQty = qty;
    let total = 0;
    let totalCost = 0;
    const usedBatchNames: string[] = [];

    const updatedBatches = product.batches.map((batch) => {
      if (remainingQty <= 0) return batch;
      const available = Math.max(batch.bought - getBatchSoldQty(product.name, batch.batch), 0);
      const take = Math.min(available, remainingQty);
      if (take <= 0) return batch;
      usedBatchNames.push(batch.batch);
      const unitSalePrice = saleForm.saleType === "Hibe" ? 0 : Number(saleForm.customSalePrice || batch.salePrice || 0);
      total += unitSalePrice * take;
      totalCost += batch.buyPrice * take;
      remainingQty -= take;
      return { ...batch, sold: batch.sold + take };
    });

    if (remainingQty > 0) return setMessage("Parti stokları yetersiz.");

    const isPaid = saleForm.paid === "true" || saleForm.saleType === "Hibe";
    const sale: Sale = {
      id: Date.now(),
      customer: customer.name,
      product: product.name,
      batch: usedBatchNames.join(", "),
      qty,
      total,
      cost: totalCost,
      profit: total - totalCost,
      paid: isPaid,
      date: today(),
      seller: saleForm.seller,
      enteredBy: "Aktif Kullanıcı",
      saleType: saleForm.saleType,
    };

    setSales([sale, ...sales]);
    setProducts(products.map((p) => (p.id === product.id ? { ...p, stock: getProductStock(p) - qty, batches: updatedBatches } : p)));
    if (!isPaid) setCustomers(customers.map((c) => (c.id === customer.id ? { ...c, debit: c.debit + total } : c)));
    setSaleForm({ customerId: "", productId: "", qty: "1", seller: "Aslı", saleType: "Normal satış", paid: "false", customSalePrice: "" });
  };

  const deleteSale = (saleId: number) => {
    setSales(sales.map((s) => (s.id === saleId ? { ...s, cancelled: true } : s)));
    setMessage("Satış iptal edildi. Gerçek sistemde bu kayıt silinmez, iptal olarak saklanır.");
  };

  const updateSale = (saleId: number, patch: Partial<Sale>) => {
    setSales(sales.map((s) => (s.id === saleId ? { ...s, ...patch } : s)));
  };

  const addCustomerPayment = (customerId: number) => {
    const amount = Number(paymentInputs[customerId] || 0);
    if (!amount || amount <= 0) return;
    setCustomers(
      customers.map((c) => {
        if (c.id !== customerId) return c;
        return { ...c, credit: Math.min(c.credit + amount, c.debit) };
      })
    );
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
  };

  const markPayment = (customerId: number) => {
    setCustomers(customers.map((c) => (c.id === customerId ? { ...c, credit: c.debit } : c)));
    setPaymentInputs({ ...paymentInputs, [customerId]: "" });
  };

  const updatePartner = (name: keyof PartnerLedger, field: keyof PartnerLedger["Veli"], value: number) => {
    setPartnerLedger({ ...partnerLedger, [name]: { ...partnerLedger[name], [field]: value } });
  };

  const applyPeriodOpening = () => {
    const productCost = Number(periodForm.productCost || 0);
    const shippingCost = Number(periodForm.shippingCost || 0);
    const sponsor = Number(periodForm.sponsor || 0);
    const asliContribution = Number(periodForm.asli || 0);
    const mihrimahContribution = Number(periodForm.mihrimah || 0);
    const eachResponsibility = productCost / 2 + shippingCost / 2;

    setPartnerLedger({
      Veli: {
        ...partnerLedger.Veli,
        contribution: partnerLedger.Veli.contribution + sponsor,
        receivable: partnerLedger.Veli.receivable + sponsor,
      },
      Aslı: {
        ...partnerLedger.Aslı,
        contribution: partnerLedger.Aslı.contribution + asliContribution,
        debt: Math.max(partnerLedger.Aslı.debt + eachResponsibility - asliContribution, 0),
      },
      Mihrimah: {
        ...partnerLedger.Mihrimah,
        contribution: partnerLedger.Mihrimah.contribution + mihrimahContribution,
        debt: Math.max(partnerLedger.Mihrimah.debt + eachResponsibility - mihrimahContribution, 0),
      },
    });
    setMessage("Yeni dönem açılışı ve sponsor/ortak katkıları işlendi.");
  };

  const closePeriod = () => {
    const half = totals.cash / 2;
    setPartnerLedger({
      ...partnerLedger,
      Aslı: { ...partnerLedger.Aslı, debt: Math.max(partnerLedger.Aslı.debt - half, 0), profitShare: partnerLedger.Aslı.profitShare + half },
      Mihrimah: { ...partnerLedger.Mihrimah, debt: Math.max(partnerLedger.Mihrimah.debt - half, 0), profitShare: partnerLedger.Mihrimah.profitShare + half },
    });
    setMessage("Dönem kapatıldı; kasa Aslı ve Mihrimah arasında %50/%50 mahsuplaştırıldı.");
  };

  const menu = [
    ["dashboard", "Dashboard"],
    ["products", "Ürünler"],
    ["batchEntry", "Parti/Ürün Girişi"],
    ["customers", "Müşteriler / Cari"],
    ["sales", "Satışlar"],
    ["partners", "Ortaklık Muhasebesi"],
    ["period", "Dönem Açılış/Kapanış"],
  ];

  const filteredProducts = products.filter((p) => `${p.name} ${p.code} ${p.genderCategory}`.toLowerCase().includes(search.toLowerCase()));
  const shownSales = sales.filter((sale) => !sale.cancelled);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r bg-white p-5 lg:block">
        <div className="mb-8">
          <h1 className="text-lg font-bold">Ticari Takip</h1>
          <p className="text-xs text-slate-500">MVP Prototip</p>
        </div>
        <nav className="space-y-2">
          {menu.map(([key, label]) => (
            <button key={key} onClick={() => setActive(key)} className={`w-full rounded-xl px-4 py-3 text-left ${active === key ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="p-5 lg:ml-72 lg:p-8">
        {message ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm shadow-sm">
            <span>{message}</span>
            <button className="btn-secondary" onClick={() => setMessage("")}>Kapat</button>
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">{menu.find((m) => m[0] === active)?.[1]}</h2>
            <p className="text-slate-500">Ürün satış, cari, stok ve dönem bazlı ortaklık takibi</p>
          </div>

        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 lg:hidden">
          {menu.map(([key, label]) => (
            <button key={key} onClick={() => setActive(key)} className={`rounded-xl px-3 py-2 ${active === key ? "bg-slate-900 text-white" : "bg-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {active === "dashboard" && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Toplam Satış" value={money(totals.revenue)} note="Kayıtlı satış toplamı" />
            <StatCard title="Kasadaki Nakit" value={money(totals.cash)} note="Ödemesi alınan satışlar" />
            <StatCard title="Müşteri Borcu" value={money(totals.customerDebt)} note="Tahsil edilmemiş cari" />
            <StatCard title="Düşük Stok" value={totals.lowStock} note="Minimum seviyenin altında" />
          </div>
        )}

        {active === "products" && (
          <div className="space-y-4">
            <Card title="Kaynak Ürün Ekle">
              <div className="grid gap-3 md:grid-cols-4">
                <input className="input" maxLength={50} placeholder="Ürün adı (max 50)" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                <select className="input" value={newProduct.genderCategory} onChange={(e) => setNewProduct({ ...newProduct, genderCategory: e.target.value as GenderCategory })}>
                  <option>Kadın</option><option>Erkek</option><option>Unisex</option>
                </select>
                <label className="input cursor-pointer text-center">
                  Resim Seç
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setNewProduct((prev) => ({ ...prev, image: String(reader.result || "") }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <button className="btn" onClick={addProductDefinition}>Kaynak Ürün Ekle</button>
              </div>
              {newProduct.image ? <img src={newProduct.image} alt="Önizleme" className="mt-4 h-24 w-24 rounded-xl border object-cover" /> : null}
            </Card>

            <Card title="Kaynak Ürünler Tablosu">
              <Table
                headers={["Ürün Kodu", "Ürün Adı", "Kategori", "Resim", "Durum", "İşlem"]}
                rows={products.map((p) => [
                  p.code,
                  editingProductId === p.id ? <input className="input" maxLength={50} value={p.name} onChange={(e) => updateProduct(p.id, { name: e.target.value })} /> : p.name,
                  editingProductId === p.id ? (
                    <select className="input" value={p.genderCategory} onChange={(e) => updateProduct(p.id, { genderCategory: e.target.value as GenderCategory })}>
                      <option>Kadın</option><option>Erkek</option><option>Unisex</option>
                    </select>
                  ) : p.genderCategory,
                  p.image ? "Var" : "Yok",
                  p.passive ? "Pasif" : "Aktif",
                  <div key={p.id} className="flex gap-2">
                    <button className="btn-secondary" onClick={() => setEditingProductId(editingProductId === p.id ? null : p.id)}>Değiştir</button>
                    <button className="btn-danger" onClick={() => deleteProduct(p.id)}>Sil</button>
                  </div>,
                ])}
              />
            </Card>

            <Card title="Ürün Özet Raporu">
              <Table
                headers={["Ürün Adı", "Toplam Sipariş", "Toplam Satış", "Kalan Stok"]}
                rows={products.map((p) => [
                  p.name,
                  p.batches.reduce((sum, b) => sum + b.bought, 0),
                  getProductSoldQty(p),
                  getProductStock(p),
                ])}
              />
            </Card>

            <input className="input" placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((p) => (
                <Card key={p.id}>
                  <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-slate-200">
                    {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-slate-400">Resim yok</span>}
                  </div>
                  <div className="flex justify-between gap-3">
                    <button className="font-semibold text-left underline" onClick={() => setExpandedProductId(expandedProductId === p.id ? null : p.id)}>{p.name}</button>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{p.code}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{p.genderCategory} • Kod: {p.code}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>Toplam Alınan: <b>{p.batches.reduce((sum, b) => sum + b.bought, 0)}</b></div>
                    <div>Toplam Satılan: <b>{getProductSoldQty(p)}</b></div>
                    <div>Stok: <b>{getProductStock(p)}</b></div>
                    <div className={getProductStock(p) <= p.minStock ? "text-red-600" : ""}>Min: <b>{p.minStock}</b></div>
                  </div>
                  {expandedProductId === p.id ? (
                    <div className="mt-4">
                      <Table headers={["Parti", "Alındı", "Satıldı", "Kalan", "Alış", "Satış"]} rows={p.batches.map((b) => [b.batch, b.bought, getBatchSoldQty(p.name, b.batch), b.bought - getBatchSoldQty(p.name, b.batch), money(b.buyPrice), money(b.salePrice)])} />
                    </div>
                  ) : <p className="mt-4 text-xs text-slate-500">Parti detayları için ürün adına tıklayın.</p>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {active === "batchEntry" && (
          <div className="space-y-4">
            <Card title="Parti Bazlı Ürün Girişi">
              <p className="mb-5 text-slate-500">Önce kaynak ürün ve parti adı oluşturulur. Sonra partiye ürün, adet, alış fiyatı ve hedef satış fiyatı girilir.</p>
              <div className="mb-5 flex flex-wrap gap-3">
                <input className="input max-w-sm" placeholder="Yeni parti adı" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} />
                <button className="btn-secondary" onClick={addBatchName}>Parti Adı Ekle</button>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {batches.map((batch) => (
                  <div key={batch} className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                    <span>{batch}</span>
                    <button className="text-red-600" onClick={() => deleteBatchName(batch)}>Sil</button>
                    <button className="underline" onClick={() => {
                      const next = prompt("Yeni parti adı", batch);
                      if (next) renameBatchName(batch, next);
                    }}>Değiştir</button>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <select className="input" value={batchForm.batch} onChange={(e) => setBatchForm({ ...batchForm, batch: e.target.value })}>
                  <option value="">Parti seçin</option>
                  {batches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
                </select>
                <select className="input" value={batchForm.productId} onChange={(e) => setBatchForm({ ...batchForm, productId: e.target.value })}>
                  <option value="">Kaynak ürün seçin</option>
                  {products.filter((p) => !p.passive).map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
                <input className="input" type="number" placeholder="Toplam sipariş/adet" value={batchForm.bought} onChange={(e) => setBatchForm({ ...batchForm, bought: e.target.value })} />
                <input className="input" type="number" placeholder="Alış fiyatı" value={batchForm.buyPrice} onChange={(e) => setBatchForm({ ...batchForm, buyPrice: e.target.value })} />
                <input className="input" type="number" placeholder="Hedef satış fiyatı" value={batchForm.salePrice} onChange={(e) => setBatchForm({ ...batchForm, salePrice: e.target.value })} />
                <input className="input" type="number" placeholder="Min stok" value={batchForm.minStock} onChange={(e) => setBatchForm({ ...batchForm, minStock: e.target.value })} />
                <button className="btn" onClick={addBatchProduct}>Partiye Ürün Ekle</button>
              </div>
            </Card>

            <Card title="Parti Bazlı Ürün / Stok Raporu">
              <select className="input mb-4 max-w-xs" value={batchReportFilter} onChange={(e) => setBatchReportFilter(e.target.value)}>
                <option value="Tümü">Tüm Partiler</option>
                {batches.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
              </select>
              <Table
                headers={["Parti", "Ürün", "Alınan", "Satılan", "Kalan", "Alış", "Satış", "İşlem"]}
                rows={products.flatMap((p) => p.batches.filter((b) => batchReportFilter === "Tümü" || b.batch === batchReportFilter).map((b, index) => {
                  const key = `${p.id}-${index}`;
                  return [
                    editingBatchKey === key ? (
                      <select className="input" value={b.batch} onChange={(e) => updateBatchRow(p.id, index, { batch: e.target.value })}>
                        {batches.map((batch) => <option key={batch}>{batch}</option>)}
                      </select>
                    ) : b.batch,
                    p.name,
                    editingBatchKey === key ? <input className="input w-24" type="number" value={b.bought} onChange={(e) => updateBatchRow(p.id, index, { bought: Number(e.target.value || 0) })} /> : b.bought,
                    getBatchSoldQty(p.name, b.batch),
                    b.bought - getBatchSoldQty(p.name, b.batch),
                    editingBatchKey === key ? <input className="input w-24" type="number" value={b.buyPrice} onChange={(e) => updateBatchRow(p.id, index, { buyPrice: Number(e.target.value || 0) })} /> : money(b.buyPrice),
                    editingBatchKey === key ? <input className="input w-24" type="number" value={b.salePrice} onChange={(e) => updateBatchRow(p.id, index, { salePrice: Number(e.target.value || 0) })} /> : money(b.salePrice),
                    <div key={key} className="flex gap-2">
                      <button className="btn-secondary" onClick={() => setEditingBatchKey(editingBatchKey === key ? null : key)}>Değiştir</button>
                      <button className="btn-danger" onClick={() => deleteBatchRow(p.id, index)}>Sil</button>
                    </div>,
                  ];
                }))}
              />
            </Card>
          </div>
        )}

        {active === "customers" && (
          <div className="space-y-4">
            <Card title="Cari Ekle">
              <div className="flex flex-wrap gap-3">
                <input className="input max-w-md" maxLength={50} placeholder="Cari adı (max 50 karakter)" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                <button className="btn" onClick={addCustomer}>Cari Ekle</button>
              </div>
            </Card>

            <Card title="Cari Liste Raporu">
              <Table
                headers={["Cari Adı", "Toplam Sipariş", "Toplam Ödeme", "Kalan Borç", "Durum", "İşlem"]}
                rows={customers.map((c) => [
                  editingCustomerId === c.id ? <input className="input" maxLength={50} value={c.name} onChange={(e) => updateCustomerName(c.id, e.target.value)} /> : c.name,
                  money(c.debit),
                  money(c.credit),
                  money(c.debit - c.credit),
                  c.passive ? "Pasif" : c.debit - c.credit <= 0 ? "Ödendi" : "Borç Açık",
                  <div key={c.id} className="flex gap-2">
                    <button className="btn-secondary" onClick={() => setEditingCustomerId(editingCustomerId === c.id ? null : c.id)}>Değiştir</button>
                    <button className="btn-danger" onClick={() => deleteCustomer(c.id)}>Sil</button>
                  </div>,
                ])}
              />
            </Card>

            {customers.map((c) => {
              const balance = c.debit - c.credit;
              const customerSales = shownSales.filter((sale) => sale.customer === c.name);
              return (
                <Card key={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{c.name}</h3>
                      <p className="text-sm text-slate-500">Cari kart</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>Satış/Borç<br /><b>{money(c.debit)}</b></div>
                      <div>Ödeme<br /><b>{money(c.credit)}</b></div>
                      <div>Kalan<br /><b className={balance > 0 ? "text-red-600" : "text-emerald-600"}>{money(balance)}</b></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="input w-40" type="number" min="0" placeholder="Ödeme tutarı" value={paymentInputs[c.id] || ""} onChange={(e) => setPaymentInputs({ ...paymentInputs, [c.id]: e.target.value })} />
                      <button className="btn-secondary" onClick={() => addCustomerPayment(c.id)}>Ödeme Ekle</button>
                      <button className="btn-secondary" onClick={() => markPayment(c.id)}>Tamamı Ödendi</button>
                      <button className="btn-secondary" onClick={() => setExpandedCustomerId(expandedCustomerId === c.id ? null : c.id)}>Satışları Listele</button>
                      <span className={`rounded-full px-3 py-2 text-xs ${balance <= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{balance <= 0 ? "Ödendi" : "Borç Açık"}</span>
                    </div>
                  </div>
                  {expandedCustomerId === c.id ? (
                    <div className="mt-4">
                      <Table
                        headers={["Tarih", "Ürün", "Parti", "Satıcı", "Adet", "Tutar", "Durum"]}
                        rows={customerSales.map((sale) => [sale.date, sale.product, sale.batch, sale.seller, sale.qty, money(sale.total), sale.paid ? "Ödendi" : "Cari borç"])}
                      />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}

        {active === "sales" && (
          <div className="space-y-4">
            <Card title="Yeni Satış Girişi">
              <p className="mb-5 text-slate-500">Satış girebilmek için önce cari kaydı ve ürün kaydı var olmalıdır.</p>
              <div className="grid gap-3 md:grid-cols-4">
                <select className="input" value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })}>
                  <option value="">Cari seçin</option>
                  {customers.filter((c) => !c.passive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="input" value={saleForm.productId} onChange={(e) => setSaleForm({ ...saleForm, productId: e.target.value })}>
                  <option value="">Ürün seçin</option>
                  {products.filter((p) => !p.passive).map((p) => <option key={p.id} value={p.id}>{p.name} - Stok: {getProductStock(p)}</option>)}
                </select>
                <input className="input" type="number" min="1" placeholder="Adet" value={saleForm.qty} onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })} />
                <select className="input" value={saleForm.seller} onChange={(e) => setSaleForm({ ...saleForm, seller: e.target.value as Seller })}><option>Aslı</option><option>Mihrimah</option></select>
                <select className="input" value={saleForm.saleType} onChange={(e) => setSaleForm({ ...saleForm, saleType: e.target.value as SaleType })}>
                  <option>Normal satış</option><option>İndirimli satış</option><option>Kârsız satış</option><option>Zararına satış</option><option>Hibe</option>
                </select>
                <input className="input" type="number" min="0" placeholder="Özel satış fiyatı (opsiyonel)" value={saleForm.customSalePrice} onChange={(e) => setSaleForm({ ...saleForm, customSalePrice: e.target.value })} />
                <select className="input" value={saleForm.paid} onChange={(e) => setSaleForm({ ...saleForm, paid: e.target.value })}><option value="false">Cari borç olarak yaz</option><option value="true">Ödeme alındı</option></select>
                <button className="btn" onClick={addSaleFromForm}>Satışı Kaydet</button>
              </div>
            </Card>

            <Card title="Satış Listesi">
              <Table
                headers={["Tarih", "Müşteri", "Ürün", "Parti", "Satıcı", "Giren", "Tip", "Adet", "Tutar", "Maliyet", "Kâr/Zarar", "Durum", "İşlem"]}
                rows={shownSales.map((sale) => [
                  sale.date,
                  sale.customer,
                  sale.product,
                  sale.batch,
                  editingSaleId === sale.id ? <select className="input" value={sale.seller} onChange={(e) => updateSale(sale.id, { seller: e.target.value as Seller })}><option>Aslı</option><option>Mihrimah</option></select> : sale.seller,
                  sale.enteredBy,
                  editingSaleId === sale.id ? <select className="input" value={sale.saleType} onChange={(e) => updateSale(sale.id, { saleType: e.target.value as SaleType })}><option>Normal satış</option><option>İndirimli satış</option><option>Kârsız satış</option><option>Zararına satış</option><option>Hibe</option></select> : sale.saleType,
                  sale.qty,
                  money(sale.total),
                  money(sale.cost),
                  <span key={sale.id} className={sale.profit < 0 ? "text-red-600" : ""}>{money(sale.profit)}</span>,
                  sale.paid ? "Ödendi" : "Cari borç",
                  <div key={sale.id} className="flex gap-2">
                    <button className="btn-secondary" onClick={() => setEditingSaleId(editingSaleId === sale.id ? null : sale.id)}>Değiştir</button>
                    <button className="btn-danger" onClick={() => deleteSale(sale.id)}>Sil</button>
                  </div>,
                ])}
              />
            </Card>
          </div>
        )}

        {active === "partners" && (
          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(partnerLedger).map(([name, row]) => {
              const partnerName = name as keyof PartnerLedger;
              return (
                <Card key={name}>
                  <h3 className="text-xl font-bold">{name}</h3>
                  <p className="mb-4 text-sm text-slate-500">{row.role}</p>
                  <div className="space-y-2 text-sm">
                    {(["contribution", "receivable", "debt", "profitShare"] as const).map((field) => (
                      <div className="flex items-center justify-between gap-3" key={field}>
                        <span>{field === "contribution" ? "Katılım" : field === "receivable" ? "Alacak" : field === "debt" ? "Borç" : "Kâr Payı/Mahsup"}</span>
                        {editingPartner === partnerName ? (
                          <input className="input w-32" type="number" value={row[field]} onChange={(e) => updatePartner(partnerName, field, Number(e.target.value || 0))} />
                        ) : (
                          <b className={field === "debt" && row.debt > 0 ? "text-red-600" : ""}>{money(row[field])}</b>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="btn-secondary mt-4" onClick={() => setEditingPartner(editingPartner === partnerName ? null : partnerName)}>Değiştir</button>
                </Card>
              );
            })}
          </div>
        )}

        {active === "period" && (
          <div className="space-y-4">
            <Card title="Yeni Dönem Açılışı">
              <p className="mb-4 text-sm text-slate-500">Yeni parti alımında sponsor ve ortak katkılarını girin. Ürün maliyeti ve kargo Aslı/Mihrimah arasında %50/%50 sorumluluk olarak hesaplanır.</p>
              <div className="grid gap-3 md:grid-cols-5">
                <label className="field-label">
                  <span>Veli sponsor katkısı</span>
                  <input className="input" type="number" placeholder="0" value={periodForm.sponsor} onChange={(e) => setPeriodForm({ ...periodForm, sponsor: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>Aslı katkısı</span>
                  <input className="input" type="number" placeholder="0" value={periodForm.asli} onChange={(e) => setPeriodForm({ ...periodForm, asli: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>Mihrimah katkısı</span>
                  <input className="input" type="number" placeholder="0" value={periodForm.mihrimah} onChange={(e) => setPeriodForm({ ...periodForm, mihrimah: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>Ürün toplam maliyeti</span>
                  <input className="input" type="number" placeholder="0" value={periodForm.productCost} onChange={(e) => setPeriodForm({ ...periodForm, productCost: e.target.value })} />
                </label>
                <label className="field-label">
                  <span>Kargo gideri</span>
                  <input className="input" type="number" placeholder="0" value={periodForm.shippingCost} onChange={(e) => setPeriodForm({ ...periodForm, shippingCost: e.target.value })} />
                </label>
                <button className="btn" onClick={applyPeriodOpening}>Dönem Açılışını İşle</button>
              </div>
            </Card>

            <Card title="Dönem Kapatma Simülasyonu">
              <p className="mb-5 text-slate-500">Yeni parti alımından önce kasa eşit dağıtılır; borcu olan ortağın payı önce borcundan düşülür.</p>
              <div className="mb-5 grid gap-4 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-slate-100 p-4">Kasadaki para<br /><b>{money(totals.cash)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Aslı payı<br /><b>{money(totals.cash / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Mihrimah payı<br /><b>{money(totals.cash / 2)}</b></div>
                <div className="rounded-xl bg-slate-100 p-4">Müşteri cari<br /><b>{money(totals.customerDebt)}</b></div>
              </div>
              <button className="btn" onClick={closePeriod}>Dönemi Kapat ve Mahsuplaştır</button>
            </Card>
          </div>
        )}
      </section>

      <style jsx global>{`
        .field-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 0.75rem;
          background: white;
          padding: 0.625rem 0.75rem;
          outline: none;
        }
        .input:focus {
          border-color: #0f172a;
        }
        .btn {
          border-radius: 0.75rem;
          background: #0f172a;
          color: white;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
        }
        .btn-secondary {
          border: 1px solid #cbd5e1;
          border-radius: 0.75rem;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .btn-danger {
          border-radius: 0.75rem;
          background: #ef4444;
          color: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return <main className="p-8">Yükleniyor...</main>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="mb-2 text-2xl font-bold">Giriş Yap</h1>
          <p className="mb-6 text-slate-500">Satış / stok / cari paneli</p>

          <div className="space-y-3">
            <input
              className="w-full rounded-xl border p-3"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="w-full rounded-xl border p-3"
              placeholder="Şifre"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") login();
              }}
            />

            <button
              type="button"
              onClick={login}
              className="w-full rounded-xl bg-slate-900 p-3 font-semibold text-white"
            >
              Giriş Yap
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="fixed right-6 top-6 z-[9999]">
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border-2 border-slate-400 bg-white px-5 py-3 text-sm font-bold text-black shadow-2xl"
        >
          Çıkış
        </button>
      </div>
      <AppContent />
    </>
  );
}
