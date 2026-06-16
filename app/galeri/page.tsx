"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  gender_category: string;
  image_url: string | null;
  passive: boolean;
};

export default function GaleriPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id,name,gender_category,image_url,passive")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setProducts(data as Product[]);
      });
  }, []);

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

  const groups: { gender: string }[] = [
    { gender: "Erkek" },
    { gender: "Kadın" },
    { gender: "Unisex" },
  ];

  const visibleProducts = products.filter((p) => !p.passive && p.image_url);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      padding: "12px",
    }}>
      {groups.map(({ gender }) => {
        const group = visibleProducts.filter((p) => p.gender_category === gender);
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
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 4,
            }}>
              {group.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setLightbox(p.image_url)}
                  style={{
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
                </div>
              ))}
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
