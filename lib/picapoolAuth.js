"use client";

/**
 * Shared auth for the Picapool polling backend.
 *
 * Two separate sessions are cached in localStorage:
 *  - the guest token (fetched via POST /v1/auth/guest) — fine for endpoints
 *    that still answer for anonymous visitors, e.g. GET /v1/Polling/polls.
 *  - the real logged-in user token (captured after OTP verify) — required
 *    by POST /v1/Polling, POST /v1/Polling/vote and GET
 *    /v1/Polling/{id}/details, which now 403 ("guests cannot access this
 *    endpoint") for a guest token.
 */

import { getTurnstileToken } from "./turnstile";

export const PICAPOOL_API_BASE = "https://dev.picapool.com";

const GUEST_TOKEN_KEY = "picapool_access_token";
const USER_TOKEN_KEY = "picapool_user_token";
// refresh a little before the server-reported expiry so an in-flight
// request doesn't race the token dying mid-air
const EXPIRY_SAFETY_MS = 30 * 1000;

function readGuestToken() {
  try {
    const raw = window.localStorage.getItem(GUEST_TOKEN_KEY);
    if (!raw) return null;
    // Older cached value was a bare token string with no expiry — treat as
    // stale so it gets replaced by a fresh, properly-tracked one below.
    if (raw[0] !== "{") return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Dedup guard: if several components ask for a guest token at nearly the
// same moment (e.g. the poll feed and a modal both mounting), only the
// first actually fetches -- everyone else awaits that same in-flight
// request instead of each independently triggering their own Turnstile
// solve for what's ultimately the same token.
let inFlightGuestTokenPromise = null;

export async function getPicapoolToken(deviceId) {
  if (typeof window === "undefined") return null;

  const cached = readGuestToken();
  if (cached?.access_token && !isExpired(cached.access_exp)) return cached.access_token;

  if (inFlightGuestTokenPromise) return inFlightGuestTokenPromise;
  inFlightGuestTokenPromise = fetchFreshGuestToken(deviceId).finally(() => {
    inFlightGuestTokenPromise = null;
  });
  return inFlightGuestTokenPromise;
}

async function fetchFreshGuestToken(deviceId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let turnstileToken = "";
      try {
        turnstileToken = await getTurnstileToken();
      } catch (e) {
        console.warn("[LP] turnstile token unavailable for guest login", e);
      }

      const res = await fetch(`${PICAPOOL_API_BASE}/v1/auth/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(turnstileToken ? { "X-Turnstile-Token": turnstileToken } : {}),
        },
        body: JSON.stringify({
          app_version: "1.2.3",
          device_id: deviceId || "web-visitor",
          fcm_token: "",
          meta_device_data: {},
          platform: "web",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.access_token) {
          try {
            window.localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify({
              access_token: data.data.access_token,
              access_exp: data.data.access_exp || null,
            }));
          } catch (e) { }
          return data.data.access_token;
        }
      }
    } catch (e) {
      console.error("[LP] guest token fetch failed (attempt", attempt + 1, ")", e);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
  }
  return null;
}

// ---------------------------------------------------------------------
// Real (logged-in) user session
// ---------------------------------------------------------------------

function readUserToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("[LP] readUserToken parse failed", e);
    return null;
  }
}

/**
 * Persist the session returned by /v1/auth/otp/verify or /v1/auth/refresh —
 * { access_token, access_exp, refresh_token, refresh_exp }.
 */
export function saveUserToken(session) {
  if (typeof window === "undefined" || !session?.access_token) return;
  try {
    window.localStorage.setItem(USER_TOKEN_KEY, JSON.stringify({
      access_token: session.access_token,
      access_exp: session.access_exp || null,
      refresh_token: session.refresh_token || null,
      refresh_exp: session.refresh_exp || null,
    }));
  } catch (e) {
    console.warn("[LP] saveUserToken failed", e);
  }
}

export function clearUserToken() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(USER_TOKEN_KEY); } catch (e) { }
}

export function hasStoredUserSession() {
  return !!readUserToken()?.access_token;
}

function isExpired(isoExp) {
  if (!isoExp) return true;
  const t = new Date(isoExp).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() >= t - EXPIRY_SAFETY_MS;
}

async function refreshUserToken(refreshToken) {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${PICAPOOL_API_BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.data?.access_token) {
      saveUserToken(data.data);
      return data.data.access_token;
    }
  } catch (e) {
    console.warn("[LP] refreshUserToken failed", e);
  }
  return null;
}

/**
 * Returns a valid, non-guest access token for the logged-in user —
 * transparently refreshing it via the stored refresh_token if the cached
 * access_token has expired. Returns null when there's no session at all,
 * or the session couldn't be refreshed (refresh_token also dead/invalid) —
 * callers should fall back to prompting OTP login in that case.
 */
export async function getUserToken() {
  const stored = readUserToken();
  if (!stored?.access_token) return null;

  if (!isExpired(stored.access_exp)) return stored.access_token;

  const refreshed = await refreshUserToken(stored.refresh_token);
  if (refreshed) return refreshed;

  // both tokens are dead — drop the stale session so we stop retrying it
  clearUserToken();
  return null;
}
