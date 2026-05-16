// src/App.tsx
import React, { useState } from "react";
import RevenuePage from "./components/RevenuePage";
import ProductDashboard from "./components/ProductDashboard";
import "./App.css";

export default function App(): JSX.Element {
  const [view, setView] = useState<"revenue" | "product">("revenue");

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Inter, Arial, sans-serif" }}>
      <aside
        style={{
          width: 220,
          background: "#0f1720",
          color: "#fff",
          padding: 18,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Analytics</div>

        <button
          onClick={() => setView("revenue")}
          style={{
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 8,
            background: view === "revenue" ? "rgba(255,255,255,0.06)" : "transparent",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          <div style={{ fontWeight: 700 }}>Revenue</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Revenue view & KPIs</div>
        </button>

        <button
          onClick={() => setView("product")}
          style={{
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 8,
            background: view === "product" ? "rgba(255,255,255,0.06)" : "transparent",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          <div style={{ fontWeight: 700 }}>Product</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Product analytics</div>
        </button>

        <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.7 }}>Sample dashboard • Local CSV</div>
      </aside>

      <main style={{ flex: 1, padding: 18, boxSizing: "border-box", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 980 }}>
          {view === "revenue" && <RevenuePage />}
          {view === "product" && <ProductDashboard />}
        </div>
      </main>
    </div>
  );
}
