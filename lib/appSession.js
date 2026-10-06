"use client";

/**
 * Receiving an already-logged-in session from the Picapool Flutter app, which
 * opens this site in an in-app webview. Two channels, tried in this order:
 *
 *  1. URL fragment:   https://polling.picapool.com/?pollId=12#session=<base64url(JSON)>
 *     A fragment (#) is never sent to servers/logs/referrers. The caller strips
 *     it from the address bar right after reading it. Never use ?query for this.
 *
 *  2. JS bridge (also used to get a fresh token when the access token expires):
 *     - flutter_inappwebview: the app registers a handler named "getSession";
 *       we call window.flutter_inappwebview.callHandler("getSession") and the
 *       app returns the session object (or a Promise of it).
 *     - webview_flutter: the app registers a JavaScriptChannel named
 *       "PicapoolSession"; we call PicapoolSession.postMessage("getSession")
 *       and the app replies by running
 *       window.picapoolReceiveSession({...}) via runJavaScript.
 *
 * Session shape (same field names as /v1/auth/otp/verify, plus the contact):
 *   { access_token, access_exp, refresh_token?, refresh_exp?, name, number }
 * refresh_* are optional: if the app and the webview both refreshed the same
 * rotating refresh token they could log each other out, so the app may omit
 * them and just hand over a fresh access token on request.
 */

export const CONTACT_KEY = "picapool_user_contact";
const BRIDGE_TIMEOUT_MS = 1500;

function decodeBase64Url(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  // atob gives a binary string; go through UTF-8 so non-ASCII names survive
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.access_token !== "string" || !raw.access_token) return null;
  return {
    access_token: raw.access_token,
    access_exp: raw.access_exp || null,
    refresh_token: raw.refresh_token || null,
    refresh_exp: raw.refresh_exp || null,
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    number: raw.number != null ? String(raw.number).trim() : "",
  };
}

/** Reads `#session=...`, removes it from the address bar, returns the session or null. */
export function takeFragmentSession() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const m = hash.match(/(?:^#|&)session=([^&]+)/);
  if (!m) return null;

  let session = null;
  try {
    session = normalizeSession(JSON.parse(decodeBase64Url(decodeURIComponent(m[1]))));
  } catch (e) {
    console.warn("[LP] bad #session fragment", e);
  }

  // always strip it, valid or not, so it never lingers in history/screenshots
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState({}, "", url);
  } catch (e) { /* ignore */ }
  return session;
}

export function hasAppBridge() {
  if (typeof window === "undefined") return false;
  return typeof window.flutter_inappwebview?.callHandler === "function"
    || typeof window.PicapoolSession?.postMessage === "function";
}

/** Asks the host app for the current session. Resolves null if there is no app / no answer. */
export async function requestBridgeSession() {
  if (!hasAppBridge()) return null;

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), BRIDGE_TIMEOUT_MS));
  const ask = (async () => {
    try {
      if (typeof window.flutter_inappwebview?.callHandler === "function") {
        return normalizeSession(await window.flutter_inappwebview.callHandler("getSession"));
      }
      return await new Promise((resolve) => {
        window.picapoolReceiveSession = (payload) => {
          try {
            resolve(normalizeSession(typeof payload === "string" ? JSON.parse(payload) : payload));
          } catch (e) {
            resolve(null);
          }
        };
        window.PicapoolSession.postMessage("getSession");
      });
    } catch (e) {
      console.warn("[LP] app bridge getSession failed", e);
      return null;
    }
  })();
  return Promise.race([ask, timeout]);
}

export function saveContact(name, number) {
  if (!name || !number) return;
  try {
    window.localStorage.setItem(CONTACT_KEY, JSON.stringify({ name, number }));
  } catch (e) { /* ignore */ }
}
