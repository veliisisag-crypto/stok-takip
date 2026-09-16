"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  gender_category: string;
  image_url: string | null;
  passive: boolean;
  manual_price: number | null;
};

type BatchItem = {
  id: string;
  product_id: string;
  bought: number;
  sale_price: number | null;
  variant: "ana" | "cep_boy" | null;
  created_at: string;
};

export default function GaleriPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [soldByBatchItem, setSoldByBatchItem] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name,gender_category,image_url,passive,manual_price")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setProducts(data as Product[]);
      });

    supabase
      .from("batch_items")
      .select("id,product_id,bought,sale_price,variant,created_at")
      .then(({ data, error }) => {
        if (error) { console.warn("batch_items okunamadı", error); return; }
        if (data) setBatchItems(data as BatchItem[]);
      });

    supabase
      .rpc("get_sold_qty_by_batch_item")
      .then(({ data, error }) => {
        if (error) { console.warn("get_sold_qty_by_batch_item hata", error); return; }
        const map: Record<string, number> = {};
        for (const row of (data || []) as { batch_item_id: string; toplam_satilan: number }[]) {
          map[row.batch_item_id] = Number(row.toplam_satilan || 0);
        }
        setSoldByBatchItem(map);
      });
  }, []);

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  // Ürünün belirli bir varyanttaki (ana / cep_boy) stok ve fiyat bilgisi.
  const getVariantInfo = (productId: string, variant: "ana" | "cep_boy") => {
    const items = batchItems.filter((bi) => bi.product_id === productId && (bi.variant || "ana") === variant);
    if (!items.length) return null; // bu varyanttan hiç girilmemiş
    const stock = items.reduce((sum, bi) => sum + Number(bi.bought || 0) - (soldByBatchItem[bi.id] || 0), 0);
    const priced = items.filter((bi) => Number(bi.sale_price) > 0).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const price = priced.length ? Number(priced[0].sale_price) : 0;
    return { stock, price };
  };

  const groups: { gender: string }[] = [
    { gender: "Erkek" },
    { gender: "Kadın" },
    { gender: "Unisex" },
  ];

  const visibleProducts = products
    .filter((p) => !p.passive && p.image_url)
    .map((p) => {
      const ana = getVariantInfo(p.id, "ana");
      const cep = getVariantInfo(p.id, "cep_boy");
      const fallbackPrice = Number(p.manual_price || 0);
      const hasStock = (ana?.stock || 0) > 0 || (cep?.stock || 0) > 0;
      return { product: p, ana, cep, fallbackPrice, hasStock };
    });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      padding: "12px",
    }}>
      {groups.map(({ gender }) => {
        const group = visibleProducts
          .filter((row) => row.product.gender_category === gender)
          .sort((a, b) => (b.hasStock ? 1 : 0) - (a.hasStock ? 1 : 0));
        if (!group.length) return null;
        return (
          <div key={gender} style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}>
              <div style={{
                color: "#ffffff",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.5,
                whiteSpace: "nowrap",
              }}>{gender}</div>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 4,
            }}>
              {group.map(({ product: p, ana, cep, fallbackPrice }) => {
                const anaPrice = ana ? (ana.price || fallbackPrice) : fallbackPrice;
                const anaStock = ana?.stock || 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => setLightbox(p.image_url)}
                    style={{
                      position: "relative",
                      aspectRatio: "1/1",
                      borderRadius: 6,
                      overflow: "hidden",
                      cursor: "pointer",
                      background: "#1a1a1a",
                    }}
                  >
                    <img
                      src={p.image_url!}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    <div style={{
                      position: "absolute",
                      top: 5,
                      right: 5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      alignItems: "flex-end",
                    }}>
                      <div style={{
                        background: anaStock > 0 ? "#16a34a" : "#dc2626",
                        color: "#ffffff",
                        fontSize: "0.5rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                      }}>
                        Büyük Boy · {anaStock > 0 ? "Stokta" : "Tükendi"} · {anaPrice ? Math.round(anaPrice).toLocaleString("tr-TR") : "-"}
                      </div>
                      {cep && (
                        <div style={{
                          background: cep.stock > 0 ? "#16a34a" : "#dc2626",
                          color: "#ffffff",
                          fontSize: "0.5rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                        }}>
                          Çanta Boy · {cep.stock > 0 ? "Stokta" : "Tükendi"} · {cep.price ? Math.round(cep.price).toLocaleString("tr-TR") : "-"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "95vw",
              maxHeight: "92vh",
              borderRadius: 10,
              objectFit: "contain",
              boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
            }}
          />
          <button
            onClick={close}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              color: "white",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
