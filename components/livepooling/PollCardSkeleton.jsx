"use client";
import React from "react";

/**
 * Placeholder shown in the exact shape/size of a real PollCard (same
 * 760x460 footprint) while polls are loading, so there's zero layout shift
 * when real content swaps in and the page never shows a blank gap.
 */
export default function PollCardSkeleton({ width = 760 }) {
  return (
    <article
      style={{
        width: `min(${width}px, 100%)`,
        flex: `0 0 min(${width}px, 100%)`,
        borderRadius: 12,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.06)",
        boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
        height: 460,
        minHeight: 460,
        maxHeight: 460,
        overflow: "hidden",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div className="skeleton-shimmer" style={{ width: "100%", height: 180, borderRadius: 10 }} />
      <div className="skeleton-shimmer" style={{ width: "70%", height: 20, borderRadius: 6 }} />
      <div className="skeleton-shimmer" style={{ width: "45%", height: 14, borderRadius: 6 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <div className="skeleton-shimmer" style={{ width: "100%", height: 44, borderRadius: 10 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 44, borderRadius: 10 }} />
      </div>
    </article>
  );
}
