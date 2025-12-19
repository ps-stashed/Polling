"use client";

import React, { useEffect, useMemo } from "react";
import PollCard from "./PollCard";

/**
 * AllPollsModal.jsx
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - source: "ADMIN" | "USER"
 * - cards: array of all cards (passed from LivePooling)
 * - onVote: function({ pollId, optionId }) -> handles vote (passed from LivePooling)
 * - votedMap: object mapping pollId -> optionId (local votes)
 * - busyMap: object mapping pollId -> boolean
 *
 * Notes:
 * - Modal width increased by ~20% (max-w-7xl), and PollCard width bumped from 720 -> 864.
 */

export default function AllPollsModal({
  open,
  onClose,
  source = "ADMIN",
  cards = [],
  onVote,
  votedMap = {},
  busyMap = {},
}) {
  // keep hooks order stable
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev || "";
    };
  }, [open, onClose]);

  // compute filtered before early return to avoid hook-order issues
  const filtered = useMemo(
    () =>
      (cards || []).filter(
        (c) => String((c.source || "").toUpperCase()) === String((source || "ADMIN").toUpperCase())
      ),
    [cards, source]
  );

  if (!open) return null;

  // increasedCardWidth is 20% larger than previous 720
  const increasedCardWidth = 864;

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* modal panel: increased max width (7xl) for ~20% more room */}
      <div
        className="relative w-full max-w-7xl mx-4 mt-16 md:mt-0 md:rounded-xl bg-white shadow-xl overflow-hidden"
        role="document"
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{source === "ADMIN" ? "All Admin Polls" : "All User Polls"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{filtered.length} booths</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={onClose} aria-label="Close" className="px-3 py-2 rounded-md hover:bg-gray-100">
              ✕
            </button>
          </div>
        </div>

        {/* body: vertically scrollable on small screens, 2-column grid on md+ */}
        <div
          className="p-6"
          style={{
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              No booths found. Make sure the home page has fetched polls (the modal uses the same in-memory list).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 auto-rows-fr">
              {filtered.map((c) => {
                const key = `${c.source}__${c.product?.id}__${c.poll?.id ?? c._metaIndex}`;
                return (
                  <div
                    key={key}
                    className="w-full flex justify-center"
                    style={{ padding: 8 }}
                  >
                    <div style={{ width: "100%", maxWidth: increasedCardWidth }}>
                      <PollCard
                        card={c}
                        onVote={({ pollId, optionId }) => {
                          if (typeof onVote === "function") onVote({ pollId, optionId });
                        }}
                        votedMap={votedMap}
                        busyMap={busyMap}
                        width={increasedCardWidth}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
