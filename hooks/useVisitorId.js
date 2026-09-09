// hooks/useVisitorId.js
"use client";

import { useEffect, useState } from "react";

const LOCAL_VISITOR_KEY = "picapool_visitorId";

/**
 * useVisitorId
 * - Client-only hook.
 * - Tries to load @fingerprintjs/fingerprintjs dynamically.
 * - Falls back to a stable UUID stored in localStorage.
 * - Returns { visitorId, loading, error }.
 */
export default function useVisitorId() {
  const [visitorId, setVisitorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // If we already have a stored ID, use that (avoid re-fetching FP each time).
        const stored = typeof window !== "undefined" ? localStorage.getItem(LOCAL_VISITOR_KEY) : null;
        if (stored) {
          if (!cancelled) {
            setVisitorId(stored);
            setLoading(false);
          }
          return;
        }

        try {
          // Dynamically import the npm package (works with Next.js/webpack)
          const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
          const fp = await FingerprintJS.load();
          const res = await fp.get();
          const id = res?.visitorId ?? null;
          if (id) {
            // Do not force persisting FP id if you don't want to; persisting helps consistent votes across reloads
            try { localStorage.setItem(LOCAL_VISITOR_KEY, id); } catch {}
            if (!cancelled) setVisitorId(id);
            return;
          }
          // fallthrough to fallback
        } catch (fpErr) {
          // fingerprint failed (adblock, CSP, network, etc.)
          // continue to fallback
          console.warn("FingerprintJS load failed, falling back:", fpErr);
        }

        // fallback: stable UUID
        const fallback = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `visitor_${Math.random().toString(36).slice(2, 12)}`;
        try { localStorage.setItem(LOCAL_VISITOR_KEY, fallback); } catch {}
        if (!cancelled) setVisitorId(fallback);
      } catch (err) {
        console.warn("useVisitorId init error", err);
        if (!cancelled) setError(err?.message ?? String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { visitorId, loading, error };
}
