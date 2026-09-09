
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import HorizontalScroller from "./HorizontalScroller";
import PollCard from "./PollCard";
import Hero from "./Hero";
import AllPollsModal from "./AllPollsModal";
import OtpLoginModal from "./OtpLoginModal";
import ReasonModal from "./ReasonModal";
import useVisitorId from "@/hooks/useVisitorId"; // adjust path if needed
import { getPicapoolToken, PICAPOOL_API_BASE } from "@/lib/picapoolAuth";

// CreatePoll and FAB may include client-only dynamic styling/ids — import them client-only to avoid hydration mismatches
const CreatePoll = dynamic(() => import("./CreatePoll"), { ssr: false });
const FAB = dynamic(() => import("./FAB"), { ssr: false });

const FETCH_POLLS_BASE = `${PICAPOOL_API_BASE}/v1/Polling/polls`;
const REGISTER_VOTE_URL = `${PICAPOOL_API_BASE}/v1/Polling/vote`;
const LOCAL_CONTACT_KEY = "picapool_user_contact";
const SECTION_SCROLL_DELAY_MS = 180;

function normalizeApiResponse(apiJson) {
  if (!apiJson) return [];
  const data = apiJson.data ?? apiJson;
  const rows = [];
  if (data.ADMIN && Array.isArray(data.ADMIN)) {
    data.ADMIN.forEach((p, pi) => (p.polls || []).forEach((poll, idx) => rows.push({ source: "ADMIN", product: p, poll, _metaIndex: `${pi}_${idx}` })));
  }
  if (data.USER && Array.isArray(data.USER)) {
    data.USER.forEach((p, pi) => (p.polls || []).forEach((poll, idx) => rows.push({ source: "USER", product: p, poll, _metaIndex: `${pi}_${idx}` })));
  }
  return rows;
}

export default function LivePooling() {
  const { visitorId, loading: visitorLoading, error: visitorError } = useVisitorId();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localVotes, setLocalVotes] = useState({});
  const [busyMap, setBusyMap] = useState({});
  const [error, setError] = useState(null);

  const adminScrollerRef = useRef(null);
  const userScrollerRef = useRef(null);
  const adminSectionRef = useRef(null);
  const userSectionRef = useRef(null);

  // a small inline anchor/button for the FAB to merge with
  const inlineCreateRef = useRef(null);

  const [initialPollId, setInitialPollId] = useState(null);
  const [initialCreateOpen, setInitialCreateOpen] = useState(false);
  const [notFoundPopup, setNotFoundPopup] = useState({ show: false, message: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSource, setModalSource] = useState("ADMIN");

  const [createOpen, setCreateOpen] = useState(Boolean(initialCreateOpen));

  const [user, setUser] = useState(null); // { name, number }
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'VOTE' | 'CREATE', payload: ... }
  const [pendingVote, setPendingVote] = useState(null); // { pollId, optionId, previousOptionId }

  // capture query params on mount (client-only)
  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search);
      const pid = qp.get("pollId");
      const create = qp.get("create");
      if (pid) setInitialPollId(pid);
      if (create === "1" || create === "true") setInitialCreateOpen(true);
    } catch { }
  }, []);

  // when otp modal opens, disable scroller snap so modal interacts nicely with pointer scroll
  useEffect(() => {
    try {
      if (otpModalOpen) {
        adminScrollerRef.current?.disableSnap?.();
        userScrollerRef.current?.disableSnap?.();
      } else {
        adminScrollerRef.current?.enableSnap?.();
        userScrollerRef.current?.enableSnap?.();
      }
    } catch (e) { console.warn("[LP] error toggling scroller snap:", e); }
  }, [otpModalOpen]);

  useEffect(() => { setCreateOpen(Boolean(initialCreateOpen)); }, [initialCreateOpen]);

  const saveLocalVotes = useCallback((id, votes) => {
    try { localStorage.setItem(`picapool_votes_${id}`, JSON.stringify(votes)); } catch (e) { console.warn("[LP] saveLocalVotes error", e); }
  }, []);

  const deriveAndSetVotesFromServer = useCallback((normalizedCards) => {
    try {
      if (!Array.isArray(normalizedCards)) return;
      const byPoll = {};
      normalizedCards.forEach(c => {
        const pid = String(c.poll?.id ?? c._metaIndex ?? "");
        const serverVoted = c.poll?.isVoted ?? null;
        if (serverVoted != null) byPoll[pid] = serverVoted;
      });
      if (Object.keys(byPoll).length > 0) {
        console.log("[LP] derived votes from server:", byPoll);
        setLocalVotes(prev => {
          const next = { ...(prev || {}) };
          Object.entries(byPoll).forEach(([pid, opt]) => { next[pid] = opt; });
          try { if (visitorId) localStorage.setItem(`picapool_votes_${visitorId}`, JSON.stringify(next)); } catch (e) { console.warn("[LP] persist votes failed", e); }
          return next;
        });
      }
    } catch (e) {
      console.warn("[LP] deriveAndSetVotesFromServer error", e);
    }
  }, [visitorId]);

  // load local votes & contact from storage once visitorId ready
  useEffect(() => {
    if (!visitorId) {
      console.log("[LP] visitorId not ready yet");
      return;
    }
    console.log("[LP] visitorId ready:", visitorId);
    try {
      const rawVotes = localStorage.getItem(`picapool_votes_${visitorId}`);
      setLocalVotes(rawVotes ? JSON.parse(rawVotes) : {});
      console.log("[LP] loaded localVotes:", rawVotes ? JSON.parse(rawVotes) : {});
    } catch (e) { console.warn("[LP] error loading local votes:", e); }

    // Load user from storage
    try {
      const rawUser = localStorage.getItem(LOCAL_CONTACT_KEY);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed.name && parsed.number) {
          setUser(parsed);
          console.log("[LP] loaded user:", parsed);
        }
      }
    } catch (e) { console.warn("[LP] error loading user:", e); }
  }, [visitorId]);

  useEffect(() => { if (visitorError) { setError(`Visitor detection: ${visitorError}`); console.error(visitorError); } }, [visitorError]);

  const showNotFound = useCallback((msg) => {
    setNotFoundPopup({ show: true, message: msg });
    setError(msg);
    setTimeout(() => { setNotFoundPopup({ show: false, message: "" }); setError(null); }, 4000);
  }, []);

  /**
   * centerAndHighlight:
   * - tries to locate the element with id `poll-<pollId>` (or matching substring)
   * - if found: scrolls and animates it, returns true
   * - if NOT found: returns false (does NOT call showNotFound) so callers can retry
   */
  const centerAndHighlight = useCallback(async (pollId) => {
    try {
      if (!pollId) return false;
      let el = document.getElementById(`poll-${pollId}`);
      if (!el) {
        const all = Array.from(document.querySelectorAll("[id^='poll-']"));
        el = all.find(e => (e.id || "").toLowerCase().includes(String(pollId).toLowerCase()));
      }
      if (!el) {
        return false; // not found — caller will decide to retry / show message
      } else {
        setError(null);
      }

      const scrollerEl = el.closest && el.closest(".horizontal-scroller-container");
      let sectionRef = null;
      if (adminSectionRef.current && adminSectionRef.current.contains(scrollerEl)) sectionRef = adminSectionRef;
      else if (userSectionRef.current && userSectionRef.current.contains(scrollerEl)) sectionRef = userSectionRef;

      if (sectionRef && sectionRef.current) { try { sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { } await new Promise(res => setTimeout(res, SECTION_SCROLL_DELAY_MS)); }

      try {
        if (adminSectionRef.current && adminSectionRef.current.contains(el) && adminScrollerRef.current && typeof adminScrollerRef.current.scrollToElementId === "function") {
          adminScrollerRef.current.scrollToElementId(el.id);
        } else if (userSectionRef.current && userSectionRef.current.contains(el) && userScrollerRef.current && typeof userScrollerRef.current.scrollToElementId === "function") {
          userScrollerRef.current.scrollToElementId(el.id);
        } else {
          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
        el.animate([{ boxShadow: "0 0 0 rgba(79,70,229,0)" }, { boxShadow: "0 14px 40px rgba(99,102,241,0.14)" }, { boxShadow: "0 0 0 rgba(79,70,229,0)" }], { duration: 1400 });
        return true;
      } catch (e) {
        // animation/scroll failed but element exists — treat as success (no not-found)
        console.warn("centerAndHighlight: scroll/animate failed but element exists", e);
        return true;
      }
    } catch (e) {
      console.error("centerAndHighlight error:", e);
      return false;
    }
  }, [showNotFound]);

  // Helper: try centering with retries, only show not-found if all attempts fail
  const tryCenterWithRetries = useCallback(async (pollId, { attempts = 6, baseDelay = 120 } = {}) => {
    if (!pollId) return false;
    for (let i = 0; i < attempts; i++) {
      try {
        const ok = await centerAndHighlight(pollId);
        if (ok) return true;
      } catch (e) { /* ignore and retry */ }
      await new Promise(res => setTimeout(res, baseDelay + i * 80));
    }
    return false;
  }, [centerAndHighlight]);

  const fetchPolls = useCallback(async () => {
    if (!visitorId) return;
    setLoading(true); setError(null);
    // Warm the guest token in the background for later vote/create calls,
    // but don't block the poll list on it: /v1/Polling/polls answers fine
    // unauthenticated (verified directly against the API), so awaiting the
    // token first was just adding a second serial round-trip before any
    // content could show.
    getPicapoolToken(visitorId).catch(() => {});
    try {
      const pollsUrl = `${FETCH_POLLS_BASE}?deviceId=${encodeURIComponent(visitorId)}`;
      let res, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch(pollsUrl, { cache: "no-store" });
          if (res.ok) { lastErr = null; break; }
          lastErr = new Error(`fetch failed ${res.status}`);
        } catch (e) {
          lastErr = e;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
      if (lastErr) throw lastErr;
      const json = await res.json();
      const normalized = normalizeApiResponse(json);
      setCards(normalized);
      console.log("[LP] fetched polls count:", normalized.length);
      deriveAndSetVotesFromServer(normalized);

      // center initial poll if query param present
      if (initialPollId) {
        const found = normalized.find(c => String(c.poll?.id ?? c._metaIndex) === String(initialPollId) || String(c._metaIndex) === String(initialPollId));
        if (!found) {
          const ok = await tryCenterWithRetries(initialPollId);
          if (!ok) showNotFound(`Poll ${initialPollId} not found or ended`);
        } else {
          setTimeout(() => { tryCenterWithRetries(initialPollId); }, 140);
        }
      }
    } catch (err) { console.error("fetchPolls:", err); setError(err.message || "Failed to load polls"); } finally { setLoading(false); }
  }, [visitorId, initialPollId, deriveAndSetVotesFromServer, tryCenterWithRetries, showNotFound]);

  useEffect(() => { if (visitorId) fetchPolls(); }, [visitorId, fetchPolls]);

  // Listen for created event from CreatePoll
  useEffect(() => {
    const handler = async (e) => {
      try {
        const pid = e?.detail?.pollId;
        if (!pid) return;
        console.log("[LP] received picapool:created event for poll", pid);

        try { await fetchPolls(); } catch (err) { console.warn("[LP] fetch after create failed", err); }

        const ok = await tryCenterWithRetries(pid);
        if (!ok) {
          try {
            await fetchPolls();
            await new Promise(res => setTimeout(res, 220));
            const ok2 = await tryCenterWithRetries(pid);
            if (!ok2) showNotFound(`Poll ${pid} not found or ended`);
          } catch (err) { showNotFound(`Poll ${pid} not found or ended`); }
        }
      } catch (err) {
        console.warn("[LP] picapool:created handler error", err);
      }
    };
    document.addEventListener("picapool:created", handler);
    return () => { document.removeEventListener("picapool:created", handler); };
  }, [fetchPolls, tryCenterWithRetries, showNotFound]);

  const markLocal = useCallback((pollId, optionId) => {
    if (!visitorId) return;
    setLocalVotes(prev => {
      const next = { ...(prev || {}) };
      next[pollId] = optionId;
      saveLocalVotes(visitorId, next);
      console.log("[LP] markLocal:", pollId, optionId);
      return next;
    });
  }, [visitorId, saveLocalVotes]);

  const isNewOptionId = (optionId) => {
    if (optionId == null) return false;
    const s = String(optionId).toLowerCase();
    return s.includes("new") || s.includes("custom") || s.includes("add") || s.includes("create") || s === "new_option";
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    try {
      localStorage.setItem(LOCAL_CONTACT_KEY, JSON.stringify(userData));
    } catch (e) { }

    // Resume pending action
    if (pendingAction) {
      if (pendingAction.type === "VOTE") {
        // User logged in, now ask for reason
        setPendingVote(pendingAction.payload);
        setReasonModalOpen(true);
      } else if (pendingAction.type === "CREATE") {
        setCreateOpen(true);
      }
      setPendingAction(null);
    }
  };

  const requestLogin = (action) => {
    setPendingAction(action);
    setOtpModalOpen(true);
  };

  const submitVoteInternal = useCallback(async ({ pollId, optionId, previousOptionId = null, meta = null }) => {
    if (!visitorId) { setError("visitor id not ready"); console.warn("[LP] submitVoteInternal aborted - no visitorId"); return; }
    if (busyMap[pollId]) { console.warn("[LP] submitVoteInternal aborted - busy", pollId); return; }

    const card = cards.find(c => String(c.poll?.id ?? c._metaIndex) === String(pollId));
    if (!card) { console.warn("[LP] submitVoteInternal aborted - card not found", pollId); return; }

    if (card.poll?.pending || String(card.poll?.id || "").startsWith("local") || String(pollId).startsWith("local")) {
      console.warn("[LP] submitVoteInternal aborted - poll is pending or local-only", pollId);
      setError("Poll is not yet confirmed by server — try again shortly.");
      try { fetchPolls(); } catch { }
      return;
    }

    const previous = localVotes[pollId] ?? card.poll?.isVoted ?? previousOptionId ?? null;

    // optimistic UI
    setCards(prev => prev.map(c => {
      const match = String(c.poll?.id ?? c._metaIndex) === String(pollId);
      if (!match) return c;
      const newOptions = (c.poll.options || []).map(o => {
        if (String(previous) === String(optionId)) return o; // no change if same option
        if (String(o.id) === String(optionId)) return { ...o, count: Number(o.count || 0) + 1 };
        if (previous && String(o.id) === String(previous)) return { ...o, count: Math.max(0, Number(o.count || 0) - 1) };
        return o;
      });
      return { ...c, poll: { ...c.poll, options: newOptions } };
    }));

    setBusyMap(b => ({ ...b, [pollId]: true }));
    markLocal(pollId, optionId);

    try {
      const pidNum = Number(String(pollId));
      const optNum = Number(String(optionId));
      if (!Number.isInteger(pidNum) || pidNum <= 0) throw new Error(`Invalid pollId: ${pollId}`);
      if (!Number.isInteger(optNum) || optNum <= 0) throw new Error(`Invalid optionId: ${optionId}`);

      const payload = { pollId: pidNum, optionId: optNum, deviceId: visitorId, previousOptionId: previous ? Number(previous) : null };
      if (meta) payload.meta = meta;
      console.log("[LP] sending vote payload:", payload);
      const token = await getPicapoolToken(visitorId);
      const res = await fetch(REGISTER_VOTE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`vote failed ${res.status} ${txt}`);
      }
      console.log("[LP] vote success for", pollId, optionId);
    } catch (err) {
      console.error("[LP] vote error:", err);
      // rollback UI
      setCards(prev => prev.map(c => {
        const match = String(c.poll?.id ?? c._metaIndex) === String(pollId);
        if (!match) return c;
        const newOptions = (c.poll.options || []).map(o => {
          if (String(o.id) === String(optionId)) return { ...o, count: Math.max(0, Number(o.count || 0) - 1) };
          if (previous && String(o.id) === String(previous)) return { ...o, count: Number(o.count || 0) + 1 };
          return o;
        });
        return { ...c, poll: { ...c.poll, options: newOptions } };
      }));
      setLocalVotes(prev => {
        const next = { ...(prev || {}) };
        if (previous) next[pollId] = previous;
        else delete next[pollId];
        saveLocalVotes(visitorId, next);
        return next;
      });
      setError(err.message || "Vote failed");
    } finally {
      setBusyMap(b => ({ ...b, [pollId]: false }));
    }
  }, [visitorId, cards, localVotes, busyMap, markLocal, saveLocalVotes, fetchPolls]);

  // public wrapper: open contact modal only for first vote; otherwise submit directly
  const submitVote = useCallback(async ({ pollId, optionId, isNewOption = false, customText = null }) => {
    console.log("[LP] submitVote called:", { pollId, optionId, isNewOption, customText });
    const card = cards.find(c => String(c.poll?.id ?? c._metaIndex) === String(pollId));
    const previous = (localVotes && localVotes[pollId]) ?? card?.poll?.isVoted ?? null;
    const isFirstVote = previous == null;

    if (busyMap[pollId]) {
      console.log("[LP] submitVote ignored - busy", pollId);
      return;
    }
    if (String(previous) === String(optionId)) {
      console.log("[LP] submitVote ignored - same option", { pollId, optionId });
      return;
    }

    const newFlag = isNewOption || isNewOptionId(optionId);

    if (card && card.poll?.pending) {
      setError("This poll is still being created. Wait a moment or refresh to vote.");
      return;
    }

    // Unified flow: ReasonModal handles login if needed
    setPendingVote({ pollId, optionId, previousOptionId: previous });
    setReasonModalOpen(true);
  }, [cards, localVotes, user, busyMap]);

  const handleReasonSubmit = async (reason, submittedUser) => {
    setReasonModalOpen(false);
    const finalUser = submittedUser || user;

    if (!pendingVote || !finalUser) return;

    const { pollId, optionId, previousOptionId } = pendingVote;
    const meta = `${finalUser.name} | ${finalUser.number} | ${reason}`;

    setBusyMap(b => ({ ...b, [pollId]: true }));
    try {
      await submitVoteInternal({ pollId, optionId, previousOptionId, meta });
    } finally {
      setBusyMap(b => ({ ...b, [pollId]: false }));
      setPendingVote(null);
    }
  };



  const adminCards = useMemo(() => cards.filter(c => c.source === "ADMIN"), [cards]);
  const userCards = useMemo(() => cards.filter(c => c.source === "USER"), [cards]);

  const handleCreatedPoll = useCallback((newCard) => {
    if (!newCard) return;
    const isServerCard = newCard && newCard.poll && !newCard.poll.pending && !(String(newCard.poll.id).startsWith("local"));
    const normalized = {
      source: newCard.source ?? "USER",
      product: newCard.product ?? { id: `local_p_${Date.now()}`, productName: newCard.productName || "New product", imageUrl: newCard.imageUrl || "" },
      poll: newCard.poll ?? { id: `local_poll_${Date.now()}`, question: newCard.question || "Question", options: (newCard.options || []).map((o, i) => ({ id: `local_opt_${Date.now()}_${i}`, text: o, label: o, count: 0 })) },
      _metaIndex: newCard._metaIndex ?? `created_${Date.now()}`
    };

    setCards(prev => {
      if (isServerCard) {
        const replaced = (prev || []).map(c => {
          if (c._metaIndex && c._metaIndex === normalized._metaIndex) return normalized;
          if (c.poll?.pending && c.product?.productName === normalized.product?.productName && c.poll?.question === normalized.poll?.question) {
            return normalized;
          }
          return c;
        });
        const found = replaced.find(c => String(c.poll?.id) === String(normalized.poll?.id));
        if (!found) return [normalized, ...(replaced || [])];
        return replaced;
      }
      return [normalized, ...(prev || [])];
    });

    console.log("[LP] created poll locally (or replaced):", normalized);
  }, []);

  const makeKey = (c) => {
    const pid = c.product?.id ?? "p_unknown";
    const pollId = c.poll?.id ?? c._metaIndex ?? "poll_unknown";
    return `${c.source}__${pid}__${pollId}__${c._metaIndex ?? ""}`;
  };

  const openAllModal = (source) => {
    setModalSource(String(source || "ADMIN").toUpperCase());
    setModalOpen(true);
  };

  // ---------- WHEEL FORWARDING (ensures wheel works when cursor is in gaps) ----------
  const getScrollerDomFor = (scrollerRef, wrapperEl) => {
    // try common places to find the actual scroll container (adapt to your HorizontalScroller DOM)
    if (scrollerRef?.current) {
      // if scroller exposes an element-like ref
      if (scrollerRef.current instanceof HTMLElement) return scrollerRef.current;
      // common custom refs that components expose
      if (scrollerRef.current?.rootEl) return scrollerRef.current.rootEl;
      if (scrollerRef.current?.container) return scrollerRef.current.container;
      if (scrollerRef.current?.scrollEl) return scrollerRef.current.scrollEl;
    }
    // fallback: find first scrollable child in wrapper
    if (wrapperEl && wrapperEl instanceof HTMLElement) {
      const candidate = wrapperEl.querySelector("[data-horizontal-scroller], .horizontal-scroller, .hs-scroll, .hs-inner, .hs-viewport");
      if (candidate) return candidate;
      // broader fallback: child with overflow auto/scroll
      const childs = Array.from(wrapperEl.querySelectorAll("*"));
      for (let ch of childs) {
        const st = getComputedStyle(ch);
        if ((st.overflowX === "auto" || st.overflowX === "scroll") && ch.scrollWidth > ch.clientWidth) return ch;
      }
    }
    return wrapperEl; // last resort - forward to wrapper itself
  };

  const handleScrollerWheel = (scrollerRef) => (e) => {
    // if user holds shift, allow default horizontal behavior
    if (e.shiftKey) return;

    const wrapper = e.currentTarget;
    const el = getScrollerDomFor(scrollerRef, wrapper);
    if (!el) return;

    // if there is horizontal overflow, convert vertical wheel into horizontal scroll
    if (el.scrollWidth > el.clientWidth + 2) {
      e.preventDefault();
      // small multiplier to make scroll feel natural
      const delta = e.deltaY;
      el.scrollLeft += delta;
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-8 mt-16 pb-28">
      <div className="mb-6"><Hero /></div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded">{error}</div>}

      {notFoundPopup.show && (
        <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 60, background: "#fff", border: "1px solid rgba(2,6,23,0.06)", padding: "12px 14px", borderRadius: 10, boxShadow: "0 10px 30px rgba(2,6,23,0.12)", fontSize: 14, fontWeight: 600 }}>
          <div style={{ marginBottom: 8 }}>{notFoundPopup.message}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => { setNotFoundPopup({ show: false, message: "" }); setError(null); }} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid rgba(2,6,23,0.06)", background: "#fff" }}>Close</button>
          </div>
        </div>
      )}

      {/* Admin Polls */}
      <section ref={adminSectionRef} className="mb-8 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-extrabold text-orange-500">Admin Polls</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">{adminCards.length} booths</div>
            <button onClick={() => openAllModal("ADMIN")} className="text-sm px-3 py-1 rounded-lg border bg-white shadow-sm hover:shadow-md">View all</button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4"><div className="h-44 bg-white rounded-xl shadow animate-pulse" /><div className="h-44 bg-white rounded-xl shadow animate-pulse" /></div>
        ) : (
          <div className="relative">
            <div className="hidden md:flex" style={{ position: "absolute", left: 6, top: "42%", zIndex: 30 }}>
              <button aria-label="Prev admin" onClick={() => adminScrollerRef.current?.prev?.()} className="p-3 rounded-full bg-white/90 backdrop-blur-sm border shadow-sm hover:shadow-lg transition-shadow" style={{ minWidth: 44, minHeight: 44 }}>
                ◀
              </button>
            </div>
            <div className="hidden md:flex" style={{ position: "absolute", right: 6, top: "42%", zIndex: 30 }}>
              <button aria-label="Next admin" onClick={() => adminScrollerRef.current?.next?.()} className="p-3 rounded-full bg-white/90 backdrop-blur-sm border shadow-sm hover:shadow-lg transition-shadow" style={{ minWidth: 44, minHeight: 44 }}>
                ▶
              </button>
            </div>

            <div className="horizontal-scroller-container no-scrollbar" onWheel={handleScrollerWheel(adminScrollerRef)}>
              <HorizontalScroller ref={adminScrollerRef} gap={12} cardWidth={760} ariaLabel="Admin polls scroller">
                {adminCards.length === 0 ? <div className="text-gray-500 px-2">No admin booths</div> : adminCards.map(c => {
                  const idFor = String(c.poll?.id ?? c._metaIndex ?? "");
                  return (
                    <div id={`poll-${idFor}`} key={makeKey(c)} style={{ minWidth: 320, width: "min(760px, 100%)", flex: "0 0 min(760px, 100%)", paddingRight: 12, scrollSnapAlign: "center" }}>
                      <PollCard card={c} onVote={({ pollId, optionId }) => {
                        submitVote({ pollId, optionId });
                      }} onInteract={() => { }} votedMap={localVotes} busyMap={busyMap} />
                    </div>
                  );
                })}
              </HorizontalScroller>
            </div>
          </div>
        )}
      </section>

      {/* User Polls */}
      <section ref={userSectionRef} className="mb-8 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-extrabold text-orange-500">User Polls</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">{userCards.length} booths</div>
            <button onClick={() => openAllModal("USER")} className="text-sm px-3 py-1 rounded-lg border bg-white shadow-sm hover:shadow-md">View all</button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4"><div className="h-44 bg-white rounded-xl shadow animate-pulse" /></div>
        ) : (
          <div className="relative">
            <div className="hidden md:flex" style={{ position: "absolute", left: 6, top: "42%", zIndex: 30 }}>
              <button aria-label="Prev user" onClick={() => userScrollerRef.current?.prev?.()} className="p-3 rounded-full bg-white/90 backdrop-blur-sm border shadow-sm hover:shadow-lg transition-shadow" style={{ minWidth: 44, minHeight: 44 }}>
                ◀
              </button>
            </div>
            <div className="hidden md:flex" style={{ position: "absolute", right: 6, top: "42%", zIndex: 30 }}>
              <button aria-label="Next user" onClick={() => userScrollerRef.current?.next?.()} className="p-3 rounded-full bg-white/90 backdrop-blur-sm border shadow-sm hover:shadow-lg transition-shadow" style={{ minWidth: 44, minHeight: 44 }}>
                ▶
              </button>
            </div>

            <div className="horizontal-scroller-container no-scrollbar" onWheel={handleScrollerWheel(userScrollerRef)}>
              <HorizontalScroller ref={userScrollerRef} gap={12} cardWidth={760} ariaLabel="User polls scroller">
                {userCards.length === 0 ? <div className="text-gray-500 px-2">No user booths</div> : userCards.map(c => {
                  const idFor = String(c.poll?.id ?? c._metaIndex ?? "");
                  return (
                    <div id={`poll-${idFor}`} key={makeKey(c)} style={{ minWidth: 320, width: "min(760px, 100%)", flex: "0 0 min(760px, 100%)", paddingRight: 12, scrollSnapAlign: "center" }}>
                      <PollCard card={c} onVote={({ pollId, optionId }) => {
                        submitVote({ pollId, optionId });
                      }} onInteract={() => { }} votedMap={localVotes} busyMap={busyMap} />
                    </div>
                  );
                })}
              </HorizontalScroller>
            </div>
          </div>
        )}
      </section>

      <div className="my-6 flex justify-center">
        {/* inline anchor for FAB to merge with; also used onClick to open CreatePoll */}
        <button
          ref={inlineCreateRef}
          onClick={() => {
            if (!user) {
              requestLogin({ type: "CREATE" });
            } else {
              setCreateOpen(true);
            }
          }}
          className="px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-md"
          style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>+</span>
          Create Poll Now
        </button>
      </div>

      <CreatePoll
        onCreated={handleCreatedPoll}
        visitorId={visitorId}
        controlledOpen={createOpen}
        setControlledOpen={setCreateOpen}
        initialOpen={initialCreateOpen}
        isLoggedIn={!!user}
        user={user}
        requestLogin={() => requestLogin({ type: "CREATE" })}
      />

      <OtpLoginModal
        open={otpModalOpen}
        onClose={() => { setOtpModalOpen(false); setPendingAction(null); }}
        onLoginSuccess={handleLoginSuccess}
        visitorId={visitorId}
      />

      <ReasonModal
        open={reasonModalOpen}
        onClose={() => { setReasonModalOpen(false); setPendingVote(null); }}
        onSubmit={handleReasonSubmit}
        user={user}
        onLoginSuccess={handleLoginSuccess}
        visitorId={visitorId}
      />

      <AllPollsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        source={modalSource}
        cards={cards}
        onVote={({ pollId, optionId }) => { submitVote({ pollId, optionId }); }}
        votedMap={localVotes}
        busyMap={busyMap}
      />

      {/* Global FAB — merges to the inline create button */}
      <FAB
        targetRef={inlineCreateRef}
        onClick={() => {
          if (!user) {
            requestLogin({ type: "CREATE" });
          } else {
            setCreateOpen(true);
          }
        }}
      />

      {/* minimal helper styles for scroller gap behavior and responsiveness */}
      <style jsx>{`
        .horizontal-scroller-container {
          touch-action: pan-y; /* allow vertical gestures by default, we'll forward wheel ourselves */
          pointer-events: auto;
          padding: 8px 0;
        }
        @media (max-width:900px) {
          .horizontal-scroller-container { padding: 6px 0; }
        }

        /* --- new: subtle surface behind cards so they stand out --- */
        .horizontal-scroller-container {
          background: linear-gradient(180deg, #fbfbfb 0%, #ffffff 100%);
          border-radius: 14px;
          padding: 12px;
          /* keeps overall page bright but gives a visible "lane" */
        }

        @media (max-width:900px) {
          .horizontal-scroller-container { padding: 8px; border-radius: 10px; }
        }
      `}</style>

    </div>
  );
}
