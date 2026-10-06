"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { formatRupees, triggerOptionText } from "@/lib/paidPolls";

/**
 * PaidEntryModal — the explicit "yes, charge me" step before we send anyone to
 * the payment page. Presentational: LivePooling owns the network call.
 *
 * Props:
 * - open: boolean
 * - poll: the paid poll being entered (entryFee, targetVotes, paidVotes, options…)
 * - busy: true once the payment link is being created / the browser is redirecting
 * - error: message from a failed attempt ("" when none)
 * - onConfirm / onClose
 */
export default function PaidEntryModal({ open, poll, busy = false, error = "", onConfirm, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !poll) return null;

  const fee = formatRupees(poll.entryFee);
  const trigger = triggerOptionText(poll);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4 gap-3">
            <h3 className="text-xl font-bold text-slate-800">Pay {fee} to vote</h3>
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              ✕
            </button>
          </div>

          {poll.question && (
            <p className="text-sm text-slate-500 mb-4 line-clamp-3">{poll.question}</p>
          )}

          <ul className="text-sm text-slate-700 space-y-2 mb-5">
            <li className="flex gap-2"><span aria-hidden>•</span><span>A one-time entry fee of <b>{fee}</b>. It is <b>non-refundable</b>.</span></li>
            <li className="flex gap-2"><span aria-hidden>•</span><span>Once you&apos;ve paid you can pick any option, and change it until the poll closes.</span></li>
            {trigger && (
              <li className="flex gap-2">
                <span aria-hidden>•</span>
                <span>Only paid <b>&ldquo;{trigger}&rdquo;</b> votes count toward the target
                  {Number(poll.targetVotes) > 0 ? ` (${Number(poll.paidVotes || 0)} of ${poll.targetVotes} so far)` : ""}.</span>
              </li>
            )}
          </ul>

          {error && (
            <div className="text-red-600 text-sm font-medium text-center bg-red-50 py-2 px-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
            >
              {busy ? "Opening payment…" : error ? `Try again · ${fee}` : `Pay ${fee}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
