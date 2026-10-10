"use client";

/**
 * Cloudflare Turnstile — bot verification for the actions that matter (OTP
 * send/verify, vote, create poll). This site can't do native app attestation
 * like the mobile app does (no hardware to attest), so Turnstile is the
 * equivalent signal for a browser: a script can't produce a passing token,
 * only a real browser actually running the widget can.
 *
 * appearance: "interaction-only" means the widget occupies zero visual space
 * and shows nothing at all for the vast majority of visitors -- Cloudflare's
 * risk model resolves them silently in the background. It only renders an
 * actual challenge for the rare visitor it can't be sure about, and when
 * that happens we present it as a small centered card matching the rest of
 * the site's modals (same rounded-2xl / backdrop-blur treatment as
 * OtpLoginModal), not a stray widget dropped in a corner.
 *
 * Every call to getTurnstileToken() removes any previous widget and renders
 * a completely fresh one with the default (auto-executing) mode -- the same
 * proven pattern as the very first token request of a session. An earlier
 * version tried to reuse one widget via reset()/execute(), which silently
 * never resolved on the second use; a clean render() each time sidesteps
 * that entirely at the cost of a little redundant DOM work, which is
 * negligible for how rarely these actions fire.
 *
 * This is a global singleton, lazily created on first use and attached to
 * document.body, so it works the same regardless of which page a visitor
 * lands on first -- a deep link straight into a single poll works exactly
 * like arriving from the homepage.
 */

const SITE_KEY = "0x4AAAAAAFEM1Y7_rcYhIFBd";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const OVERLAY_ID = "picapool-turnstile-overlay";
const CONTAINER_ID = "picapool-turnstile-container";

let scriptPromise = null;
let widgetId = null;

function loadScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function ensureOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(4px)",
    padding: "16px",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    maxWidth: "320px",
    width: "100%",
  });

  const heading = document.createElement("p");
  heading.textContent = "Quick security check";
  Object.assign(heading.style, {
    margin: "0",
    fontSize: "15px",
    fontWeight: "700",
    color: "#1e293b",
    fontFamily: "inherit",
  });

  const container = document.createElement("div");
  container.id = CONTAINER_ID;

  card.appendChild(heading);
  card.appendChild(container);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Resolves with a fresh Turnstile token, or rejects if verification fails.
 * Callers should treat a rejection the same as "couldn't get a token" —
 * e.g. surface a friendly retry message rather than a raw error.
 */
// Every solve is logged (console + window.__turnstileLog) so a user report like
// "the robot check shows 4-5 times" can be traced: which action asked, how long
// it took, and whether Cloudflare actually showed an interactive challenge.
const trace = (typeof window !== "undefined" && (window.__turnstileLog = window.__turnstileLog || [])) || [];
let seq = 0;

// Solves are queued: starting a second solve removes the first widget, which
// would leave the first caller's promise hanging forever.
let queue = Promise.resolve();
export function getTurnstileToken(reason = "unknown") {
  const run = queue.then(() => solveTurnstile(reason));
  queue = run.catch(() => {});
  return run;
}

async function solveTurnstile(reason) {
  const entry = { n: ++seq, reason, interactive: false, ms: null, result: "pending" };
  const t0 = Date.now();
  trace.push(entry);
  const finish = (result) => {
    entry.ms = Date.now() - t0;
    entry.result = result;
    console.log(`[LP][turnstile] #${entry.n} ${reason}: ${result} in ${entry.ms}ms, interactive challenge shown: ${entry.interactive}`);
  };
  try {
    const token = await solveTurnstileInner(entry);
    finish("ok");
    return token;
  } catch (e) {
    finish("failed: " + (e?.message || e));
    throw e;
  }
}

async function solveTurnstileInner(entry) {
  await loadScript();

  if (widgetId !== null) {
    try {
      window.turnstile.remove(widgetId);
    } catch (e) {
      // ignore -- widget may already be gone
    }
    widgetId = null;
  }

  const overlay = ensureOverlay();
  const container = document.getElementById(CONTAINER_ID);

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      overlay.style.display = "none";
      fn(value);
    };

    widgetId = window.turnstile.render(container, {
      sitekey: SITE_KEY,
      // shows up as a per-step breakdown in the Cloudflare Turnstile analytics
      // and comes back in siteverify's `action` (allowed: a-z A-Z 0-9 _ -, max 32)
      action: String(entry.reason || "unknown").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 32),
      appearance: "interaction-only",
      "before-interactive-callback": () => {
        entry.interactive = true;
        overlay.style.display = "flex";
      },
      "after-interactive-callback": () => {
        overlay.style.display = "none";
      },
      callback: (token) => done(resolve, token),
      "error-callback": (code) => done(reject, new Error("Turnstile verification failed: " + code)),
      "expired-callback": () => done(reject, new Error("Turnstile token expired before use")),
      "timeout-callback": () => done(reject, new Error("Turnstile challenge timed out")),
    });
  });
}
