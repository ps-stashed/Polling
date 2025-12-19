"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * FAB.jsx (fixed)
 *
 * - targetRef: ref to the inline button (ex: inlineCreateRef)
 * - onClick: click handler
 * - size: diameter in px
 */
export default function FAB({ targetRef, onClick, size = 52, className = "" }) {
  const fabRef = useRef(null);

  // minimal state - only what's necessary to control render
  const [hidden, setHidden] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  // visual transform stored in ref to avoid re-renders; setState only when needed
  const styleRef = useRef({ transform: "translate(0px,0px) scale(1)", opacity: 1, pointerEvents: "auto" });
  const [, forceRerender] = useState(0); // used only when we actually want to repaint once

  // compute transform from fab to target center
  const computeTransformToTarget = useCallback(() => {
    const fab = fabRef.current;
    const t = targetRef?.current;
    if (!fab || !t) return null;

    const fabRect = fab.getBoundingClientRect();
    const tgtRect = t.getBoundingClientRect();

    const fabCx = fabRect.left + fabRect.width / 2;
    const fabCy = fabRect.top + fabRect.height / 2;
    const tgtCx = tgtRect.left + tgtRect.width / 2;
    const tgtCy = tgtRect.top + tgtRect.height / 2;

    const dx = Math.round(tgtCx - fabCx);
    const dy = Math.round(tgtCy - fabCy);

    // scale a little so it visually merges
    const scale = Math.min(0.98, Math.max(0.6, (tgtRect.width / fabRect.width) * 0.95));

    return { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.03, pointerEvents: "none" };
  }, [targetRef]);

  // set style only when changed (shallow)
  const setStyleIfChanged = (next) => {
    const cur = styleRef.current;
    if (!next) return;
    if (cur.transform === next.transform && cur.opacity === next.opacity && cur.pointerEvents === next.pointerEvents) return;
    styleRef.current = next;
    // force one render so style gets applied (cheap)
    forceRerender(n => n + 1);
  };

  // observe target visibility
  useEffect(() => {
    const target = targetRef?.current;
    if (!target) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const visible = entry.intersectionRatio > 0.55 || entry.isIntersecting;
        if (visible) {
          setHidden(false);        // visible while animating
          setIsMerging(true);
          const style = computeTransformToTarget();
          setStyleIfChanged(style);
          // hide after the animation duration (allow transition)
          setTimeout(() => setHidden(true), 260);
        } else {
          // restore FAB
          setHidden(false);
          setIsMerging(false);
          setStyleIfChanged({ transform: "translate(0px, 0px) scale(1)", opacity: 1, pointerEvents: "auto" });
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef, computeTransformToTarget]);

  // update transform while merging on scroll/resize (throttled)
  useEffect(() => {
    if (!isMerging) return;
    let scheduled = false;
    const handler = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const style = computeTransformToTarget();
        setStyleIfChanged(style);
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, [isMerging, computeTransformToTarget]);

  // fallback: if IO somehow misses, ensure we bring FAB back when target is out of view
  useEffect(() => {
    const check = () => {
      const t = targetRef?.current;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!inView) {
        setHidden(false);
        setIsMerging(false);
        setStyleIfChanged({ transform: "translate(0px, 0px) scale(1)", opacity: 1, pointerEvents: "auto" });
      }
    };
    const id = setInterval(check, 600); // cheap poll
    return () => clearInterval(id);
  }, [targetRef]);

  // final style for render taken from styleRef
  const currentStyle = styleRef.current;

  return (
    <div
      ref={fabRef}
      role="button"
      aria-label="Create"
      onClick={(e) => { if (hidden) return; if (typeof onClick === "function") onClick(e); }}
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 70,
        width: size,
        height: size,
        borderRadius: 9999,
        display: hidden ? "none" : "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: "linear-gradient(180deg,#ff8a00,#ff7a00)",
        color: "white",
        boxShadow: "0 10px 30px rgba(255,122,0,0.18)",
        border: "1px solid rgba(255,255,255,0.12)",
        transition: "transform 220ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease",
        transform: currentStyle.transform,
        opacity: currentStyle.opacity,
        pointerEvents: currentStyle.pointerEvents,
      }}
      className={className}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
