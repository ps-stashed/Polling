"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";

/**
 * HorizontalScroller — improved:
 * - compute step from actual child width so responsive widths don't break snapping
 * - use "x proximity" snap to avoid over-aggressive forced snapping
 * - prevent text selection while dragging
 * - more robust wheel handling
 */

export default React.forwardRef(function HorizontalScroller(
  { children, gap = 12, cardWidth = 760, ariaLabel = "Horizontal scroller", className = "" },
  ref
) {
  const containerRef = useRef(null);

  // pointer drag state
  const pointerState = useRef({
    active: false,
    dragging: false,
    id: null,
    startX: 0,
    startScroll: 0,
  });

  const SNAP_DEBOUNCE = 80;
  const DRAG_THRESHOLD = 6; // px

  const snapTimeoutRef = useRef(null);
  const savedSnapTypeRef = useRef(null);
  const snapDisabledRef = useRef(false);

  // helpers
  const getStep = useCallback(() => {
    const el = containerRef.current;
    let computedStep = (cardWidth || 760) + gap;
    try {
      if (el) {
        const firstChild = el.querySelector(":scope > *");
        if (firstChild && firstChild instanceof HTMLElement) {
          const w = firstChild.offsetWidth;
          if (w && w > 40) { // sane check
            computedStep = w + gap;
          }
        }
      }
    } catch (_) {}
    return computedStep;
  }, [cardWidth, gap]);

  const snapToNearest = useCallback((behavior = "smooth") => {
    const el = containerRef.current;
    if (!el || snapDisabledRef.current) return;
    const step = getStep();
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const cur = Math.max(0, Math.min(el.scrollLeft, maxScroll));
    const idx = Math.round(cur / step);
    const target = Math.max(0, Math.min(idx * step, maxScroll));
    try { el.scrollTo({ left: target, behavior }); } catch { el.scrollLeft = target; }
  }, [getStep]);

  // small helper to fully reset pointer state
  const resetPointerState = useCallback(() => {
    pointerState.current.active = false;
    pointerState.current.dragging = false;
    pointerState.current.id = null;
    try {
      const el = containerRef.current;
      if (el) { el.style.cursor = ""; el.style.userSelect = ""; }
      // also clear selection if any
      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.toString()) sel.removeAllRanges();
      }
    } catch (_) {}
  }, []);

  // public API
  useImperativeHandle(ref, () => ({
    next: () => {
      const el = containerRef.current;
      if (!el) return;
      const step = getStep();
      const target = Math.min(el.scrollLeft + step, el.scrollWidth - el.clientWidth);
      try { el.scrollTo({ left: target, behavior: "smooth" }); } catch { el.scrollLeft = target; }
    },
    prev: () => {
      const el = containerRef.current;
      if (!el) return;
      const step = getStep();
      const target = Math.max(el.scrollLeft - step, 0);
      try { el.scrollTo({ left: target, behavior: "smooth" }); } catch { el.scrollLeft = target; }
    },
    scrollToElementId: (id) => {
      const el = containerRef.current;
      if (!el || !id) return;
      const child = el.querySelector(`#${id}`);
      if (!child) {
        const all = Array.from(el.querySelectorAll("[id^='poll-']"));
        const found = all.find(n => (n.id || "").toLowerCase().includes(String(id).toLowerCase()));
        if (found) return found.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        return;
      }
      const childLeft = child.offsetLeft;
      const target = Math.max(0, childLeft - Math.max(0, (el.clientWidth - child.offsetWidth) / 2));
      try { el.scrollTo({ left: target, behavior: "smooth" }); } catch { el.scrollLeft = target; }
    },
    getContainer: () => containerRef.current,
    disableSnap: () => {
      const el = containerRef.current;
      if (!el) return;
      try {
        if (!savedSnapTypeRef.current) savedSnapTypeRef.current = el.style.scrollSnapType || getComputedStyle(el).scrollSnapType || "";
      } catch (_) {
        savedSnapTypeRef.current = savedSnapTypeRef.current || "x proximity";
      }
      el.style.scrollSnapType = "none";
      snapDisabledRef.current = true;
      if (snapTimeoutRef.current) { clearTimeout(snapTimeoutRef.current); snapTimeoutRef.current = null; }
    },
    enableSnap: () => {
      const el = containerRef.current;
      if (!el) return;
      snapDisabledRef.current = false;
      try {
        el.style.scrollSnapType = savedSnapTypeRef.current || "x proximity";
      } catch (_) {
        el.style.scrollSnapType = "x proximity";
      }
      // re-snap to nearest to restore alignment
      setTimeout(() => snapToNearest("smooth"), 50);
    }
  }), [getStep, snapToNearest]);

  // Is the event target interactive? If so, don't start dragging.
  const isInteractiveElement = (target) => {
    if (!target || !(target instanceof Element)) return false;
    if (target.closest) {
      return Boolean(target.closest("a, button, input, textarea, select, label, [role='button'], [role='link']"));
    }
    return false;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Basic style setup
    el.style.overflowX = "auto";
    el.style.overflowY = "hidden";
    el.style.display = "flex";
    el.style.gap = `${gap}px`;
    // use proximity snap to be less aggressive on small drags
    el.style.scrollSnapType = el.style.scrollSnapType || "x proximity";
    el.style.webkitOverflowScrolling = "touch";

    const onPointerDown = (ev) => {
      // ignore non-left mouse buttons
      if (ev.pointerType === "mouse" && ev.button !== 0) return;

      // if initial target is interactive, don't start a drag
      if (isInteractiveElement(ev.target)) {
        resetPointerState();
        return;
      }

      pointerState.current.active = true;
      pointerState.current.dragging = false;
      pointerState.current.id = ev.pointerId;
      pointerState.current.startX = ev.clientX;
      pointerState.current.startScroll = el.scrollLeft;
      try {
        ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId);
        // prevent text selection while dragging
        el.style.userSelect = "none";
      } catch (e) {}
    };

    const onPointerMove = (ev) => {
      if (!pointerState.current.active || pointerState.current.id !== ev.pointerId) return;
      const dx = ev.clientX - pointerState.current.startX;
      if (!pointerState.current.dragging) {
        if (Math.abs(dx) >= DRAG_THRESHOLD) {
          pointerState.current.dragging = true;
          el.style.scrollBehavior = "auto";
          try { el.style.cursor = "grabbing"; } catch {}
        } else {
          return;
        }
      }
      // use direct assignment for responsiveness
      el.scrollLeft = Math.max(0, pointerState.current.startScroll - dx);
    };

    const onPointerUp = (ev) => {
      if (!pointerState.current.active || pointerState.current.id !== ev.pointerId) {
        try { ev.target.releasePointerCapture && ev.target.releasePointerCapture(ev.pointerId); } catch (_) {}
        resetPointerState();
        return;
      }
      if (pointerState.current.dragging && !snapDisabledRef.current) {
        el.style.scrollBehavior = "smooth";
        try { ev.target.releasePointerCapture && ev.target.releasePointerCapture(ev.pointerId); } catch (e) {}
        if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = setTimeout(() => {
          snapToNearest("smooth");
          snapTimeoutRef.current = null;
        }, SNAP_DEBOUNCE);
      } else {
        // small tap — ensure a snap to nearest happens after a small delay to align
        if (!snapDisabledRef.current) {
          if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
          snapTimeoutRef.current = setTimeout(() => { snapToNearest("smooth"); snapTimeoutRef.current = null; }, SNAP_DEBOUNCE + 40);
        }
      }
      resetPointerState();
    };

    const onPointerCancel = (ev) => {
      try { ev.target.releasePointerCapture && ev.target.releasePointerCapture(ev.pointerId); } catch (_) {}
      resetPointerState();
    };

    const onPointerLeave = () => {
      // clear dragging UI when pointer leaves
      if (!pointerState.current.active) return;
      try { el.style.cursor = ""; } catch (_) {}
    };

    const onScroll = () => {
      if (pointerState.current.dragging || snapDisabledRef.current) return;
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = setTimeout(() => { snapToNearest("smooth"); snapTimeoutRef.current = null; }, 180);
    };

    const onWheel = (ev) => {
      // If element can't scroll horizontally, do nothing so page can scroll
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScroll <= 0) return;

      const absDeltaX = Math.abs(ev.deltaX);
      const absDeltaY = Math.abs(ev.deltaY);
      const horizontalIntent = absDeltaX > absDeltaY || ev.shiftKey;

      if (horizontalIntent) {
        ev.preventDefault();
        el.scrollLeft += ev.deltaX;
        if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = setTimeout(() => snapToNearest("smooth"), 180);
        return;
      }

      // vertical predominant - decide if we should convert to horizontal
      const atLeftEdge = el.scrollLeft <= 0;
      const atRightEdge = el.scrollLeft >= maxScroll - 1;
      const wantsRight = ev.deltaY > 0;
      const wantsLeft = ev.deltaY < 0;
      const shouldHijack = (wantsRight && !atRightEdge) || (wantsLeft && !atLeftEdge);

      if (shouldHijack) {
        ev.preventDefault();
        // use deltaY for horizontal-like feel
        el.scrollLeft += ev.deltaY;
        if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = setTimeout(() => snapToNearest("smooth"), 180);
      } else {
        // let page scroll; but schedule a re-snap of the scroller after short delay in case it moved
        if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
        snapTimeoutRef.current = setTimeout(() => {
          if (!snapDisabledRef.current) snapToNearest("smooth");
          snapTimeoutRef.current = null;
        }, 220);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") resetPointerState();
    };
    const onWindowBlur = () => resetPointerState();

    // Attach listeners
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });
    el.addEventListener("pointerleave", onPointerLeave, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      resetPointerState();
    };
  }, [gap, cardWidth, snapToNearest, resetPointerState, DRAG_THRESHOLD, SNAP_DEBOUNCE]);

  // on resize, re-snap to keep alignment
  useEffect(() => {
    const onResize = () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = setTimeout(() => {
        if (!snapDisabledRef.current) snapToNearest("smooth");
        snapTimeoutRef.current = null;
      }, 120);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [snapToNearest]);

  return (
    <div
      ref={containerRef}
      className={`horizontal-scroller ${className}`}
      role="list"
      aria-label={ariaLabel}
      style={{
        paddingBottom: 8,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "thin",
        msOverflowStyle: "auto",
        display: "flex",
        gap: `${gap}px`,
        overflowX: "auto",
        overflowY: "hidden",
        scrollSnapType: "x proximity",
      }}
    >
      {children}
      <style jsx>{`
        .horizontal-scroller {
          width: 100%;
        }
        .horizontal-scroller > * {
          scroll-snap-align: center;
        }
        @media (min-width: 768px) {
          .horizontal-scroller {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .horizontal-scroller::-webkit-scrollbar { height: 0; background: transparent; }
        }
      `}</style>
    </div>
  );
});
