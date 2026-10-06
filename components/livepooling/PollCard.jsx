"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import { formatRupees, getPaidStatus, offerUrl, triggerOptionText } from "@/lib/paidPolls";

/**
 * PollCard
 * Props:
 * - card
 * - onVote: function({ pollId, optionId })
 * - votedMap: { [pollId]: optionId }
 * - busyMap: { [pollId]: bool }
 * - width: number (optional)
 * - onPay: function({ pollId }) — opens the entry-fee flow (paid polls only)
 * - paymentStatus: "checking" | "timeout" | null — set while we wait for the
 *   payment webhook after returning from the payment page
 * - onRecheckPayment: function({ pollId })
 */

export default function PollCard({ card, onVote, votedMap = {}, busyMap = {}, width = 760, region = "", onPay, paymentStatus = null, onRecheckPayment }) {
  const { product = {}, poll = {} } = card || {};
  const pollIdStr = String(poll?.id ?? poll?.pollId ?? card?._metaIndex ?? "");
  const userVote = votedMap?.[pollIdStr] ?? poll?.isVoted ?? poll?.isvoted ?? null;
  const hasVoted = Boolean(userVote);
  const clickLockRef = useRef(false);

  const options = Array.isArray(poll?.options) ? poll.options : [];
  const total = options.reduce((s, o) => s + Number(o.count || 0), 0) || 0;

  // ----- paid-poll state (all "free"/no-op for ordinary polls) -----
  const paidStatus = getPaidStatus(poll);
  const isPaid = paidStatus !== "free";
  const entryFee = Number(poll?.entryFee || 0);
  const targetVotes = Number(poll?.targetVotes || 0);
  const paidVotes = Number(poll?.paidVotes || 0);
  const triggerText = triggerOptionText(poll);
  // options stay on the card except where they're replaced by a pay / "offer is live" panel
  const showOptions = paidStatus === "free" || paidStatus === "open" || paidStatus === "closed";
  const votingLocked = paidStatus === "closed";

  // ----- Animated counts state -----
  const [animatedCounts, setAnimatedCounts] = useState(() => {
    const initial = {};
    (options || []).forEach((o) => {
      if (o?.id != null) initial[o.id] = 0;
    });
    return initial;
  });
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const rafRef = useRef(null);
  const animationStartRef = useRef(null);
  const animationDuration = 700; // ms

  const [copied, setCopied] = useState(false);

  const targetCounts = useMemo(() => {
    const t = {};
    (options || []).forEach((o) => {
      if (o?.id != null) t[o.id] = Number(o.count || 0);
    });
    return t;
  }, [options]);

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Animate counts when user has voted or when targetCounts change
  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animationStartRef.current = null;

    if (!hasVoted) {
      setAnimatedCounts(() => {
        const reset = {};
        Object.keys(targetCounts).forEach((id) => {
          reset[id] = 0;
        });
        return reset;
      });
      setAnimatedTotal(0);
      return;
    }

    const startCounts = {};
    Object.keys(targetCounts).forEach((id) => {
      startCounts[id] = animatedCounts[id] ?? 0;
    });
    const startTotal = animatedTotal ?? 0;
    const finalTotal = Object.values(targetCounts).reduce((s, v) => s + v, 0);

    const step = (ts) => {
      if (!animationStartRef.current) animationStartRef.current = ts;
      const elapsed = ts - animationStartRef.current;
      const t = Math.min(1, elapsed / animationDuration);
      const eased = easeOutCubic(t);

      const next = {};
      Object.keys(targetCounts).forEach((id) => {
        const target = targetCounts[id] || 0;
        const start = startCounts[id] || 0;
        const val = Math.round(start + (target - start) * eased);
        next[id] = val;
      });
      setAnimatedCounts(next);

      const nextTotal = Math.round(startTotal + (finalTotal - startTotal) * eased);
      setAnimatedTotal(nextTotal);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        animationStartRef.current = null;
        setAnimatedCounts(() => {
          const finalObj = {};
          Object.keys(targetCounts).forEach((id) => {
            finalObj[id] = targetCounts[id];
          });
          return finalObj;
        });
        setAnimatedTotal(finalTotal);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animationStartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVoted, JSON.stringify(targetCounts)]);

  // ----- Clipboard / share helpers -----
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return true;
    } catch (e) { }
    try {
      // eslint-disable-next-line no-alert
      window.prompt("Copy this link:", text);
    } catch (e) { }
    return false;
  };

  const makeShareUrl = () => {
    const suffix = region ? `&category=${encodeURIComponent(region)}` : "";
    try {
      const origin = typeof location !== "undefined" ? location.origin || "" : "";
      return `${origin}/polling/?pollId=${encodeURIComponent(String(pollIdStr))}${suffix}`;
    } catch {
      return `/polling/?pollId=${encodeURIComponent(String(pollIdStr))}${suffix}`;
    }
  };

  const canUseNavigatorShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const isTouchDevice =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 0 ||
      (typeof window !== "undefined" && "ontouchstart" in window));

  const handleShareCopy = async (e) => {
    e?.stopPropagation?.();
    const url = makeShareUrl();
    const isUserPoll = card?.source === "USER";
    const pName = product?.productName || "Product";

    let shareTitle = pName;
    let shareText = "";

    if (isUserPoll) {
      // USER template
      shareText = `Hey!
I’m checking interest for this product on *Picapool  it’s a platform which connect people nearby*
I’m personally interested in this and wanted to see if others around us are too.
If this makes sense to you, *just vote  it helps decide whether it’s worth bringing locally.*
It takes under 30 seconds 👍

${pName}
${url}`;
    } else {
      // ADMIN template
      shareText = `Hello 
Picapool is checking local interest for this product before bringing it in.
*We launch only if enough people nearby want it.*
If you’re interested to pool *this product in coming few days, please vote.*
It takes under 30 seconds.

${pName}
${url}`;
    }

    if (canUseNavigatorShare && isTouchDevice) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          // Some apps ignore 'text' if 'url' is present, or append it. 
          // But our template INCLUDES the url in the text.
          // To be safe for most social apps, we might strictly rely on text 
          // or pass url separately. 
          // However, if we put URL in text, passing it again in 'url' might duplicate it.
          // Let's try passing just text + empty url or let the specific app handle it.
          // Common behavior: 'url' field is often appended. 
          // Let's adhere to the user request strictly which shows the URL inside the text block.
          // So we might NOT pass 'url' field to navigator.share if it's already in text?
          // Actually, standard Web Share API usually prefers 'url' field for the link.
          // But if the User specifically wants that EXACT format with newlines, 
          // putting everything in 'text' is safer.
          // Let's pass url: "" or null to avoid duplication if we already embedded it.
          // BUT, some apps need the 'url' field to treat it as a link share.
          // Let's stick to the requested text format which includes the link at the bottom.
          // If we pass 'url' param, it might appear AFTER our text.
          // We will try sending EVERYTHING in 'text' and no 'url' param for precise control,
          // OR if that fails, we accept the duplication.
          // Let's go with embedding URL in text for the copy logic, 
          // and for navigator.share, we'll try to match it.
        });
        // Note: navigator.share with large text + url can be tricky.
        // Re-reading user request: "when pressed on share button...".
        // It's likely they want this text copied or shared.
        // Let's prioritize the text content.

        // Refined approach for navigator.share:
        // Use the constructed shareText which HAS the url.
        // Don't pass 'url' property to avoid double-link.
        await navigator.share({
          title: shareTitle,
          text: shareText,
        });

        setCopied(true);
        setTimeout(() => setCopied(false), 1100);
        return;
      } catch (err) {
        // user cancelled or share failed -> fallback
      }
    }

    const ok = await copyToClipboard(shareText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    }
  };

  // ----- productUrls parsing -----
  const parseProductUrls = (raw) => {
    if (!raw) return [];
    const entries = [];

    if (Array.isArray(raw)) {
      raw.forEach((r) => {
        if (r && String(r).trim()) entries.push(String(r).trim());
      });
    } else {
      const s = String(raw).trim();
      if (s.includes("|")) s.split("|").forEach((x) => x.trim() && entries.push(x.trim()));
      else if (s.includes(";"))
        s.split(";").forEach((x) => x.trim() && entries.push(x.trim()));
      else if (s.includes("\n"))
        s.split("\n").forEach((x) => x.trim() && entries.push(x.trim()));
      else entries.push(s);
    }

    const parsed = entries
      .map((entry) => {
        const trimmed = entry.trim();
        const urlNameMatch = trimmed.match(/^(.+?)\s*\(\s*([^)]+?)\s*\)\s*$/);
        if (urlNameMatch) {
          return { url: urlNameMatch[1].trim(), label: urlNameMatch[2].trim() };
        }
        return { url: trimmed, label: null };
      })
      .filter((p) => p.url);

    return parsed;
  };

  const productLinks = useMemo(
    () => parseProductUrls(product?.productUrls || product?.productUrl || ""),
    [product?.productUrls, product?.productUrl]
  );

  const isBusy = Boolean(busyMap && busyMap[pollIdStr]);
  const totalToDisplay = hasVoted ? animatedTotal : total;

  const handleOptionClick = (optId) => {
    if (isBusy) {
      console.log("[PollCard] click ignored - busy", pollIdStr);
      return;
    }
    if (votingLocked) return;
    if (String(userVote) === String(optId)) {
      console.log("[PollCard] click ignored - same option as current vote");
      return;
    }
    if (clickLockRef.current) return;
    clickLockRef.current = true;
    setTimeout(() => {
      clickLockRef.current = false;
    }, 400);

    if (typeof onVote === "function") onVote({ pollId: pollIdStr, optionId: optId });
  };

  // ----- question truncation + fixed desktop height -----
  const MAX_QUESTION_CHARS = 140;
  const CARD_FIXED_HEIGHT = 460; // for desktop

  let rawQuestion = String(poll?.question ?? "");

  // If source is USER, strictly show "Do you want to pool this product ?"
  // or at least strip the appended info if it matches the pattern
  if (card?.source === "USER") {
    // Check if it starts with the standard question
    const standardQ = "Do you want to pool this product ?";
    if (rawQuestion.startsWith(standardQ)) {
      rawQuestion = standardQ;
    }
  }

  const questionTooLong = rawQuestion.length > MAX_QUESTION_CHARS;
  const displayQuestion = questionTooLong
    ? `${rawQuestion.slice(0, MAX_QUESTION_CHARS - 1)}…`
    : rawQuestion;

  // ----- SAFE IMAGE & LINK NORMALIZATION -----
  const DEFAULT_IMG = "/assets/logo.png";

  const normalizeSrc = (src) => {
    try {
      if (!src) return DEFAULT_IMG;
      const s = String(src).trim();
      if (!s) return DEFAULT_IMG;
      if (/^data:/.test(s) || /^https?:\/\//i.test(s)) return s;
      if (s.startsWith("/")) return s;
      if (/^[./]/.test(s) || s.includes("/")) return s.startsWith("/") ? s : `/${s}`;
      console.warn("[PollCard] suspicious image src detected, falling back to default:", s);
      return DEFAULT_IMG;
    } catch (e) {
      console.warn("[PollCard] normalizeSrc error", e);
      return DEFAULT_IMG;
    }
  };

  const normalizeUrlForLink = (href) => {
    try {
      if (!href) return null;
      const s = String(href).trim();
      if (!s) return null;
      if (/^data:/.test(s) || /^https?:\/\//i.test(s)) return s;
      if (s.startsWith("/")) return s;
      if (s.includes(".") && !s.includes(" ")) return `https://${s}`;
      return s.startsWith("/") ? s : `/${s}`;
    } catch (e) {
      console.warn("[PollCard] normalizeUrlForLink error", e);
      return null;
    }
  };

  const [imgSrc, setImgSrc] = useState(() => normalizeSrc(product?.imageUrl));
  useEffect(() => {
    setImgSrc(normalizeSrc(product?.imageUrl));
  }, [product?.imageUrl]);

  const handleImgError = (e) => {
    const cur = e?.currentTarget?.src ?? imgSrc;
    if (!cur) return;
    console.warn("[PollCard] image failed to load, switching to default:", cur);
    setImgSrc(DEFAULT_IMG);
  };

  const normalizedProductLinks = useMemo(() => {
    try {
      return (productLinks || [])
        .map((p) => {
          const url = normalizeUrlForLink(p.url);
          if (!url) {
            console.warn("[PollCard] skipping invalid product link:", p.url);
            return null;
          }
          return { url, label: p.label || null };
        })
        .filter(Boolean);
    } catch (e) {
      console.warn("[PollCard] normalize product links failed", e);
      return [];
    }
  }, [productLinks]);

  return (
    <article
      className="poll-card"
      style={{
        width: `min(${width}px, 100%)`,
        flex: `0 0 min(${width}px, 100%)`,
        borderRadius: 12,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.06)",
        boxShadow: "0 12px 34px rgba(15,23,42,0.08)",
        position: "relative",
        // Paid cards carry a fee chip, progress bar and pay/offer panel, so they
        // size to their content instead of the fixed free-card height.
        ...(isPaid
          ? { height: "auto", minHeight: 0, maxHeight: "none" }
          : { height: CARD_FIXED_HEIGHT, minHeight: CARD_FIXED_HEIGHT, maxHeight: CARD_FIXED_HEIGHT }),
        transition: "transform 220ms cubic-bezier(.2,.9,.2,1), box-shadow 220ms ease",
        overflow: "hidden",
      }}
    >
      {/* Share button with your Android SVG */}
      <button
        aria-label={
          copied
            ? "Link copied"
            : canUseNavigatorShare && isTouchDevice
              ? "Share poll"
              : "Copy poll link"
        }
        title={
          copied
            ? "Copied"
            : canUseNavigatorShare && isTouchDevice
              ? "Share poll"
              : "Copy poll link"
        }
        onClick={handleShareCopy}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 40,
          border: "none",
          background: "rgba(255,255,255,0.95)",
          padding: 8,
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(2,6,23,0.06)",
          cursor: "pointer",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6L9 17l-5-5"
              stroke="#10B981"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <img
            src="/assets/share-android-svgrepo-com.svg"
            alt="Share poll"
            style={{ width: 18, height: 18, display: "block" }}
          />
        )}
      </button>

      <div
        className="poll-card-inner"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
        }}
      >
        {/* LEFT: image + product info */}
        <div
          className="poll-card-left"
          style={{
            width: 300,
            minWidth: 160,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 220,
              borderRadius: 8,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              flexShrink: 0,
            }}
          >
            <img
              src={imgSrc}
              alt={product?.productName || "product"}
              onError={handleImgError}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              fontWeight: 700,
              color: "#0f172a",
              fontSize: 15,
            }}
          >
            {product?.productName || "Product"}
          </div>

          {normalizedProductLinks.length > 0 && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {normalizedProductLinks.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#ec8422",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    minHeight: 36,
                    lineHeight: "18px",
                  }}
                >
                  {p.label ? p.label : `Link ${i + 1}`}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: question + options + footer */}
        <div
          className="poll-card-right"
          style={{
            flex: 1,
            padding: 16,
            paddingTop: 40, // avoids overlapping with share button
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                maxHeight: 44,
                lineHeight: "22px",
                wordBreak: "break-word",
              }}
              title={rawQuestion}
            >
              {displayQuestion || " "}
            </div>

            {isPaid && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                <span style={chipStyle("#fff7ed", "#c2410c", "#fed7aa")}>Paid poll · {formatRupees(entryFee)} entry</span>
                {poll?.hasPaidEntry === true && paidStatus !== "launched" && (
                  <span style={chipStyle("#ecfdf5", "#047857", "#a7f3d0")}>✓ You&apos;re in</span>
                )}
                {paidStatus === "closed" && (
                  <span style={chipStyle("#f3f4f6", "#4b5563", "#e5e7eb")}>Poll closed</span>
                )}
              </div>
            )}

            {paidStatus === "needs-entry" && (
              <EntryPanel
                entryFee={entryFee}
                triggerText={triggerText}
                paymentStatus={paymentStatus}
                onPay={() => onPay?.({ pollId: pollIdStr })}
                onRecheck={() => onRecheckPayment?.({ pollId: pollIdStr })}
              />
            )}

            {paidStatus === "launched" && <OfferLivePanel offerId={poll?.offerId} />}

            {showOptions && (
            <div
              className="options-vertical"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: options.length <= 2 ? 14 : 10,
              }}
            >
              {options.map((opt) => {
                const displayed = hasVoted ? animatedCounts[opt.id] ?? 0 : 0;
                const active = hasVoted && String(userVote) === String(opt.id);
                const buttonDisabled = Boolean(isBusy) || votingLocked || String(userVote) === String(opt.id);
                const countsTowardTarget = isPaid && String(opt.id) === String(poll?.triggerOptionId);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={(e) => {
                      e?.stopPropagation?.();
                      if (buttonDisabled) return;
                      handleOptionClick(opt.id);
                    }}
                    className="option-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 10,
                      border: active
                        ? "1px solid rgba(79,70,229,0.12)"
                        : "1px solid rgba(15,23,42,0.04)",
                      background: active ? "rgba(99,102,241,0.06)" : "#fff",
                      cursor: buttonDisabled ? "default" : "pointer",
                      opacity: buttonDisabled ? 0.85 : 1,
                      textAlign: "left",
                    }}
                    aria-disabled={buttonDisabled}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 18,
                        border: active ? "2px solid #4f46e5" : "2px solid #d1d5db",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: active ? "#4f46e5" : "#fff",
                      }}
                    >
                      {active ? (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 8,
                            background: "#fff",
                          }}
                        />
                      ) : null}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "#0f172a",
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {opt.label ?? opt.text}
                        {countsTowardTarget && (
                          <span style={chipStyle("#eef2ff", "#4338ca", "#c7d2fe")}>Counts toward target</span>
                        )}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        {hasVoted ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <ProgressBar value={displayed} max={total || 1} />
                            </div>
                            <div
                              style={{
                                color: "#6b7280",
                                fontSize: 13,
                                minWidth: 36,
                                textAlign: "right",
                              }}
                            >
                              {displayed}
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: 8 }} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div style={{ height: 8 }} />
            </div>
            )}

            {isPaid && targetVotes > 0 && (
              <PaidProgress paidVotes={paidVotes} targetVotes={targetVotes} triggerText={triggerText} launched={paidStatus === "launched"} />
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#6b7280",
              fontSize: 13,
            }}
          >
            <div>Votes: {totalToDisplay}</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .poll-card {
          width: min(760px, 100%);
          flex: 0 0 min(760px, 100%);
        }
        .poll-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 22px 48px rgba(15, 23, 42, 0.12);
        }
        .option-btn {
          transition: background 160ms ease, border-color 160ms ease,
            transform 140ms ease;
        }
        .option-btn:active {
          transform: translateY(1px);
        }

        /* Mobile: vertical layout, no fixed height, no inner scroll */
        @media (max-width: 900px) {
          .poll-card {
            height: auto !important;
            min-height: unset !important;
            max-height: unset !important;
            overflow: visible !important;
          }
          .poll-card-inner {
            flex-direction: column !important;
            height: auto !important;
          }
          .poll-card-right {
            padding-top: 20px !important; /* slightly less padding on mobile */
          }
        }
      `}</style>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Paid-poll pieces
// ---------------------------------------------------------------------------

function chipStyle(background, color, border) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    background,
    color,
    border: `1px solid ${border}`,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: "16px",
    whiteSpace: "nowrap",
  };
}

const panelStyle = {
  borderRadius: 10,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const ctaStyle = (disabled) => ({
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  background: disabled ? "#fdba74" : "#ec8422",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  cursor: disabled ? "default" : "pointer",
  boxShadow: disabled ? "none" : "0 6px 16px rgba(236,132,34,0.28)",
  textAlign: "center",
  textDecoration: "none",
});

const linkButtonStyle = {
  border: "none",
  background: "none",
  padding: 0,
  color: "#6b7280",
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  textAlign: "left",
};

/** Shown instead of the options until the caller has paid the entry fee. */
function EntryPanel({ entryFee, triggerText, paymentStatus, onPay, onRecheck }) {
  const checking = paymentStatus === "checking";
  const timedOut = paymentStatus === "timeout";

  return (
    <div style={{ ...panelStyle, background: "#fffaf5", border: "1px solid #fed7aa" }}>
      {checking ? (
        <>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>Confirming your payment…</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            This usually takes a few seconds. Please don&apos;t pay again.
          </div>
        </>
      ) : timedOut ? (
        <>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>Payment processing — check back shortly</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            We haven&apos;t received confirmation yet. If you completed the payment, it can take a few minutes.
          </div>
          <button type="button" onClick={onRecheck} style={ctaStyle(false)}>Check again</button>
          <button type="button" onClick={onPay} style={linkButtonStyle}>Payment didn&apos;t go through? Try again</button>
        </>
      ) : (
        <>
          <button type="button" onClick={onPay} style={ctaStyle(false)}>
            Pay {formatRupees(entryFee)} to vote
          </button>
          <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: "18px" }}>
            One-time, non-refundable entry fee. Pay once, then vote on any option and change it until the poll closes
            {triggerText ? <> — only paid <b>&ldquo;{triggerText}&rdquo;</b> votes count toward the target</> : null}.
          </div>
        </>
      )}
    </div>
  );
}

/** Replaces the options once the target is reached and the offer is live. */
function OfferLivePanel({ offerId }) {
  const href = offerUrl(offerId);
  return (
    <div style={{ ...panelStyle, background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
      <div style={{ fontWeight: 700, color: "#047857", fontSize: 16 }}>🎉 Offer is live</div>
      <div style={{ fontSize: 13, color: "#065f46" }}>The target was reached and the offer is now open.</div>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" style={{ ...ctaStyle(false), background: "#059669", boxShadow: "0 6px 16px rgba(5,150,105,0.25)" }}>
          View the offer →
        </a>
      )}
    </div>
  );
}

/**
 * Progress toward the launch target. Driven by `paidVotes` (paid users
 * currently on the trigger option), NOT by options[].count, which includes
 * everyone.
 */
function PaidProgress({ paidVotes, targetVotes, triggerText, launched }) {
  const shown = launched ? targetVotes : Math.min(paidVotes, targetVotes);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#4b5563", marginBottom: 6 }}>
        <span>Paid {triggerText ? <>&ldquo;{triggerText}&rdquo; </> : null}votes needed</span>
        <span style={{ fontWeight: 700, color: "#0f172a" }}>{paidVotes} / {targetVotes}</span>
      </div>
      <ProgressBar value={shown} max={targetVotes} />
    </div>
  );
}
