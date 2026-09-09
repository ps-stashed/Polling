// components/livepooling/ProgressBar.jsx
"use client";
import React from "react";

export default function ProgressBar({ value = 0, max = 1 }) {
  const pct = Math.round((value / (max || 1)) * 100);
  return (
    <div style={{ width: "100%", height: 8, background: "#f3f4f6", borderRadius: 999 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#4f46e5,#4f46e5" , transition: "width 300ms ease" }} />
    </div>
  );
}
