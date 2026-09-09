"use client";

/**
 * Shared guest-token auth for the Picapool polling backend.
 *
 * Added because the deployed production bundle (dev.picapool.com/v1/...)
 * requires a short-lived guest access token (fetched via POST
 * /v1/auth/guest and cached in localStorage) that this repo's last commit
 * predates — the repo still pointed at test-api.picapool.com / the old
 * api.picapool.com/v2/otp host with no guest-auth step at all. Recovered
 * verbatim from the live minified bundle.
 */

export const PICAPOOL_API_BASE = "https://dev.picapool.com";

export async function getPicapoolToken(deviceId) {
  if (typeof window === "undefined") return null;

  const cached = window.localStorage.getItem("picapool_access_token");
  if (cached) return cached;

  try {
    const res = await fetch(`${PICAPOOL_API_BASE}/v1/auth/guest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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
        window.localStorage.setItem("picapool_access_token", data.data.access_token);
        return data.data.access_token;
      }
    }
  } catch (e) {
    console.error("[LP] guest token fetch failed", e);
  }
  return null;
}
