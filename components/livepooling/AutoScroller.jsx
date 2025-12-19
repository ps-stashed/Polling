"use client";
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

/**
 * AutoScroller (forwardRef)
 * - automatic smooth transform-based motion
 * - exposes: next(), prev(), pause(ms), resume(), centerIndex(index), centerCurrent()
 */
const AutoScroller = forwardRef(function AutoScroller({
  children,
  speed = 30,           // px/sec
  HOLD_MS = 5000,
  resumeAfterMs = 5000, // default resume after pointer leave
  WHEEL_PAUSE_MS = 900
}, ref) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(0);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const holdTimerRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const wheelTimerRef = useRef(null);
  const [measured, setMeasured] = useState(false);

  const normalized = React.Children.toArray(children);
  const duplicate = normalized.length > 1;
  // mark originals with data-orig-index so callers can detect original index
  const originals = normalized.map((c, i) => React.cloneElement(c, { key: `${c.key ?? i}__orig`, "data-orig-index": i }));
  const copies = duplicate ? normalized.map((c, i) => React.cloneElement(c, { key: `${c.key ?? i}__dup`, "data-dup-index": i })) : [];

  useEffect(() => setMeasured(true), [children]);

  // utility: get positions (left, width) of original cards (first set)
  const getOriginalPositions = () => {
    const content = contentRef.current;
    if (!content) return [];
    const nodes = Array.from(content.children).slice(0, normalized.length);
    return nodes.map(n => ({ left: n.offsetLeft, width: n.clientWidth }));
  };

  // compute offset that centers card at index i (index relative to originals)
  const computeCenterOffsetForIndex = (i) => {
    const container = containerRef.current;
    const positions = getOriginalPositions();
    const content = contentRef.current;
    if (!container || !positions.length || i < 0 || i >= positions.length) return 0;
    const pos = positions[i];
    const halfWidth = content.scrollWidth / 2;
    const logicalCenterTarget = pos.left + pos.width / 2 - container.clientWidth / 2;

    if (!duplicate || halfWidth <= container.clientWidth) {
      const max = Math.max(0, content.scrollWidth - container.clientWidth);
      return Math.max(0, Math.min(Math.round(logicalCenterTarget), max));
    }

    // when looping: pick the half anchored to current offset
    const current = offsetRef.current % halfWidth;
    const halfIndex = Math.floor(offsetRef.current / halfWidth);
    const base = halfIndex * halfWidth;
    let absoluteTarget = base + logicalCenterTarget;
    const maxTranslate = Math.max(0, content.scrollWidth - container.clientWidth);
    if (absoluteTarget < 0) absoluteTarget = 0;
    if (absoluteTarget > maxTranslate) absoluteTarget = maxTranslate;
    return Math.round(absoluteTarget);
  };

  // apply transform with optional animation
  const applyTransform = (targetOffset = null, { animate = false, duration = 420 } = {}) => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;
    if (typeof targetOffset === "number") offsetRef.current = targetOffset;

    const fullW = content.scrollWidth;
    const visibleW = container.clientWidth;

    if (duplicate && fullW > visibleW) {
      const half = fullW / 2;
      offsetRef.current = ((offsetRef.current % half) + half) % half;
    } else {
      const maxTranslate = Math.max(0, fullW - visibleW);
      offsetRef.current = Math.max(0, Math.min(offsetRef.current, maxTranslate));
    }

    const rounded = Math.round(offsetRef.current);

    if (animate) {
      content.style.transition = `transform ${duration}ms cubic-bezier(.22,.9,.28,1)`;
      content.style.transform = `translateX(${-rounded}px)`;

      const cleanup = () => {
        if (!content) return;
        content.style.transition = "";
        content.style.transform = `translateX(${-rounded}px)`;
        lastTsRef.current = performance.now();
        content.removeEventListener("transitionend", onEnd);
        clearTimeout(fb);
      };
      const onEnd = () => cleanup();
      content.addEventListener("transitionend", onEnd, { once: true });
      const fb = setTimeout(() => { try { cleanup(); } catch {} }, duration + 40);
    } else {
      content.style.transition = "";
      content.style.transform = `translateX(${-rounded}px)`;
      lastTsRef.current = performance.now();
    }
  };

  // find nearest original card index to center
  const findNearestCenterIndex = () => {
    const container = containerRef.current;
    const positions = getOriginalPositions();
    const content = contentRef.current;
    if (!container || !positions.length || !content) return 0;

    if (!duplicate || content.scrollWidth <= container.clientWidth) {
      const centerX = offsetRef.current + container.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      positions.forEach((p, idx) => {
        const cardCenter = p.left + p.width / 2;
        const d = Math.abs(cardCenter - centerX);
        if (d < bestDist) { bestDist = d; best = idx; }
      });
      return best;
    }

    const halfWidth = content.scrollWidth / 2;
    const logicalCenter = (offsetRef.current % halfWidth) + container.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    positions.forEach((p, idx) => {
      const cardCenter = p.left + p.width / 2;
      const d = Math.abs(cardCenter - logicalCenter);
      if (d < bestDist) { bestDist = d; best = idx; }
    });
    return best;
  };

  // imperative API exposed to parent refs
  useImperativeHandle(ref, () => ({
    next() {
      const positions = getOriginalPositions();
      if (!positions.length) return;
      const cur = findNearestCenterIndex();
      const targetIndex = Math.min(positions.length - 1, cur + 1);
      const off = computeCenterOffsetForIndex(targetIndex);
      pausedRef.current = true;
      applyTransform(off, { animate: true, duration: 420 });
      lastTsRef.current = performance.now();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        resumeTimerRef.current = null;
        const snap = computeCenterOffsetForIndex(targetIndex);
        applyTransform(snap, { animate: false });
      }, 420 + 320);
    },

    prev() {
      const positions = getOriginalPositions();
      if (!positions.length) return;
      const cur = findNearestCenterIndex();
      const targetIndex = Math.max(0, cur - 1);
      const off = computeCenterOffsetForIndex(targetIndex);
      pausedRef.current = true;
      applyTransform(off, { animate: true, duration: 420 });
      lastTsRef.current = performance.now();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        resumeTimerRef.current = null;
        const snap = computeCenterOffsetForIndex(targetIndex);
        applyTransform(snap, { animate: false });
      }, 420 + 320);
    },

    // center by original index (0..n-1) and keep it paused briefly
    centerIndex(index) {
      const positions = getOriginalPositions();
      if (!positions.length || index == null || index < 0 || index >= positions.length) return;
      const off = computeCenterOffsetForIndex(index);
      pausedRef.current = true;
      applyTransform(off, { animate: true, duration: 420 });
      lastTsRef.current = performance.now();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        resumeTimerRef.current = null;
        const snap = computeCenterOffsetForIndex(index);
        applyTransform(snap, { animate: false });
      }, 420 + 320);
    },

    pause(ms = 5000) {
      pausedRef.current = true;
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
      if (ms > 0) {
        // schedule resume
        resumeTimerRef.current = setTimeout(() => { pausedRef.current = false; resumeTimerRef.current = null; }, ms);
      }
    },

    resume() {
      pausedRef.current = false;
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
      lastTsRef.current = performance.now();
    },

    getOffset() { return offsetRef.current; },

    centerCurrent() {
      const idx = findNearestCenterIndex();
      const off = computeCenterOffsetForIndex(idx);
      applyTransform(off, { animate: true, duration: 420 });
      lastTsRef.current = performance.now();
    }
  }), [children, duplicate, measured]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let mounted = true;

    function step(ts) {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      if (!pausedRef.current && measured && mounted) {
        const delta = (speed / 1000) * dt;
        offsetRef.current += delta;
        const fullW = content.scrollWidth;
        const visibleW = container.clientWidth;

        if (duplicate && fullW > visibleW) {
          const half = fullW / 2;
          if (offsetRef.current >= half) offsetRef.current -= half;
          content.style.transform = `translateX(${-offsetRef.current}px)`;
        } else {
          const maxTranslate = Math.max(0, fullW - visibleW);
          if (offsetRef.current >= maxTranslate + 1) offsetRef.current = 0;
          content.style.transform = `translateX(${-offsetRef.current}px)`;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    const clearResumeTimer = () => {
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null; }
    };

    const scheduleResume = (ms = resumeAfterMs) => {
      clearResumeTimer();
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false;
        resumeTimerRef.current = null;
      }, ms);
    };

    const onEnter = () => { pausedRef.current = true; clearResumeTimer(); };
    const onLeave = () => { scheduleResume(resumeAfterMs); };
    const onWheel = () => {
      pausedRef.current = true;
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => { pausedRef.current = false; }, WHEEL_PAUSE_MS);
    };

    let pointerHoldActive = false;
    const onPointerDown = (e) => {
      pausedRef.current = true;
      pointerHoldActive = true;
      clearResumeTimer();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        pointerHoldActive = false;
        pausedRef.current = false;
        holdTimerRef.current = null;
      }, HOLD_MS);
    };
    const onPointerUp = () => {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      pointerHoldActive = false;
      scheduleResume(resumeAfterMs);
    };

    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("wheel", onWheel, { passive: true });
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("touchstart", onPointerDown, { passive: true });
    container.addEventListener("touchend", onPointerUp);

    container.style.overflowY = "hidden";
    container.style.overflowX = "auto";

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      container.removeEventListener("touchstart", onPointerDown);
      container.removeEventListener("touchend", onPointerUp);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [children, speed, duplicate, measured, HOLD_MS, resumeAfterMs, WHEEL_PAUSE_MS]);

  return (
    <div ref={containerRef} className="auto-scroller no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
      <div ref={contentRef} className="flex gap-4 py-2 items-stretch" style={{ display: "flex", alignItems: "stretch", willChange: "transform" }}>
        {originals}
        {copies}
      </div>

      <style jsx>{`
        .auto-scroller { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
});

export default AutoScroller;
