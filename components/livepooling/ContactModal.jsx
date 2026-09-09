// components/livepooling/ContactModal.jsx
"use client";

import React, { useEffect, useRef } from "react";

const LOCAL_CONTACT_KEY = "picapool_user_contact";

/**
 * ContactModal (minimal, top-most)
 * Props:
 * - open, onlyAskReason, name, number, reason
 * - setName, setNumber, setReason
 * - error
 * - onSubmit({ skip })
 * - onClose()
 */
export default function ContactModal({
  open,
  onlyAskReason = false,
  name = "",
  number = "",
  reason = "",
  setName = () => {},
  setNumber = () => {},
  setReason = () => {},
  error = "",
  onSubmit = () => {},
  onClose = () => {},
}) {
  const taRef = useRef(null);

  // read storage on open if props empty (defensive — handles parent timing)
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(LOCAL_CONTACT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!name && parsed.name) setName(parsed.name);
        if (!number && parsed.number) setNumber(parsed.number);
      }
    } catch (e) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // lock body scroll while modal open, focus textarea only on non-mobile
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Only focus when we believe it's not a small mobile (avoid triggering mobile zoom)
    try {
      const width = window.innerWidth || document.documentElement.clientWidth;
      if (width >= 768) {
        // desktop / large tablet: safe to focus
        setTimeout(() => { taRef.current?.focus(); }, 80);
      } else {
        // small mobile: do not focus to avoid zooming in; keep caret unfocused
      }
    } catch (e) {
      // ignore
    }

    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  // inline style to ensure font-size >=16px to prevent mobile zoom
  const inputStyle = { fontSize: 16 };

  return (
    // top-most container: uses Tailwind z-9999 (supported)
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      {/* Backdrop: full-screen and blocks clicks */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => onClose()}
      />

      {/* Panel */}
      <div className="relative z-50 w-full max-w-md mx-auto rounded-xl bg-white ring-1 ring-black/5 shadow-lg">
        {/* Header (tiny) */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Quick contact</h4>
            <p className="text-xs text-gray-500 mt-0.5">Optional — we may contact you if your option goes live.</p>
          </div>
          <button
            onClick={() => onClose()}
            aria-label="Close"
            className="p-1 rounded hover:bg-gray-100 text-gray-600"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit({ skip: false }); }}
          className="px-4 py-4 space-y-3"
        >
          {/* Name & Number are always editable — keep prefilled but allow edits */}
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white text-gray-900 border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="Your name"
              aria-label="Name"
              style={inputStyle}
              autoComplete="name"
            />

            <label className="text-xs text-gray-600">Number</label>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-white text-gray-900 border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="+91 98..."
              aria-label="Phone number"
              inputMode="tel"
              style={inputStyle}
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">Reason (Optional)</label>
            <textarea
              ref={taRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full min-h-[86px] rounded-md border px-3 py-2 text-sm bg-white border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              placeholder="Why is this option helpful?"
              rows={3}
              aria-label="Reason"
              style={inputStyle}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSubmit({ skip: true })}
              className="text-sm px-3 py-2 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            >
              Skip
            </button>

            <button
              type="submit"
              className="text-sm px-3 py-2 rounded-md bg-indigo-600 text-white hover:brightness-105"
            >
              Submit
            </button>
          </div>
        </form>

        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 rounded-b-xl">
          We will only contact you about this option.
        </div>
      </div>
    </div>
  );
}
