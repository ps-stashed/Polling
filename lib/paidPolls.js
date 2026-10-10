"use client";

/**
 * Paid polls — client side of the entry-fee flow.
 *
 * A paid poll charges a one-time, non-refundable entry fee per user. Only the
 * Zoho webhook on the backend marks an entry paid, so nothing here ever
 * "unlocks" voting on its own: after the payment page we just re-read the feed
 * and trust `poll.hasPaidEntry`.
 *
 * Every paid-poll key on a poll is additive — free polls come back with
 * `isPaid:false` and the rest zeroed/null — so everything below is a no-op for
 * them.
 */

import { PICAPOOL_API_BASE, getUserToken, clearUserToken } from "./picapoolAuth";

export const ENTRY_FEE_REQUIRED = "ENTRY_FEE_REQUIRED";
const OFFER_BASE_URL = "https://offer.picapool.com/lpool";

export function isPaidPoll(poll) {
  return poll?.isPaid === true;
}

/**
 * Where a poll sits in the paid flow:
 *  - "free"        ordinary poll
 *  - "launched"    target reached, offer is live
 *  - "closed"      voting stopped without launching (expired / decided)
 *  - "needs-entry" paid poll the caller hasn't paid for yet
 *  - "open"        paid poll the caller can vote on
 */
export function getPaidStatus(poll) {
  if (!isPaidPoll(poll)) return "free";
  if (poll.launched === true) return "launched";
  if (poll.votingClosed === true) return "closed";
  if (poll.hasPaidEntry !== true) return "needs-entry";
  return "open";
}

export function offerUrl(offerId) {
  if (offerId == null || offerId === "") return null;
  return `${OFFER_BASE_URL}/${encodeURIComponent(offerId)}`;
}

export function formatRupees(amount) {
  const n = Number(amount);
  return `₹${Number.isFinite(n) ? n.toLocaleString("en-IN") : amount}`;
}

/** Text of the option that counts toward the target (usually "Yes"). */
export function triggerOptionText(poll) {
  const opt = (poll?.options || []).find((o) => String(o.id) === String(poll?.triggerOptionId));
  return opt ? String(opt.label ?? opt.text ?? "") : "";
}

/**
 * paidVotes after a user moves from one option to another. Only paid users
 * currently sitting on the trigger option count. Swap the arguments to get the
 * inverse (used to roll back an optimistic update).
 */
export function paidVotesAfterVote(poll, fromOptionId, toOptionId) {
  const current = Number(poll?.paidVotes || 0);
  if (!isPaidPoll(poll) || poll.hasPaidEntry !== true || poll.triggerOptionId == null) return current;
  const trigger = String(poll.triggerOptionId);
  const wasOn = fromOptionId != null && String(fromOptionId) === trigger;
  const isOn = toOptionId != null && String(toOptionId) === trigger;
  if (isOn && !wasOn) return current + 1;
  if (wasOn && !isOn) return Math.max(0, current - 1);
  return current;
}

/**
 * Reads a `{ success:false, data, message }` error body. `code` is set for the
 * few refusals that carry one (e.g. ENTRY_FEE_REQUIRED).
 */
export async function readApiError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch (e) { /* non-JSON error body */ }
  return {
    status: res.status,
    code: body?.data?.code ?? null,
    message: body?.message || "",
    data: body?.data ?? null,
  };
}

function friendlyEntryError({ status, message }) {
  // 503 is the documented "payments down"; a bare router 404 ("Cannot POST …")
  // means this backend doesn't have paid polls yet. Neither is useful to show raw.
  if (status === 503 || /^Cannot (GET|POST)\b/i.test(message)) {
    if (status !== 503) console.warn("[LP] entry endpoint missing on this backend:", message);
    return "Payments aren't available right now. Please try again shortly.";
  }
  if (/closed/i.test(message)) return "This poll is closed and no longer taking entries. You have not been charged.";
  return message || `Couldn't start the payment (${status}). Please try again.`;
}

function isSafePaymentUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch (e) {
    return false;
  }
}

/**
 * POST /v1/Polling/{pollId}/entry — start (or resume) the entry-fee payment.
 *
 * Resolves with one of:
 *  - { kind: "redirect", paymentUrl }  send the browser there
 *  - { kind: "alreadyPaid" }           nothing to pay; go vote
 *  - { kind: "login" }                 no usable real session; ask for OTP login
 *  - { kind: "error", status, message }
 */
export async function startPollEntry(pollId) {
  const token = await getUserToken();
  if (!token) return { kind: "login" };


  let res;
  try {
    res = await fetch(`${PICAPOOL_API_BASE}/v1/Polling/${encodeURIComponent(pollId)}/entry`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    console.error("[LP] entry request failed", e);
    return { kind: "error", status: 0, message: "Couldn't reach the server. Check your connection and try again." };
  }

  // 401 = no/expired session, 403 = guest token: either way a real login is needed.
  if (res.status === 401 || res.status === 403) {
    clearUserToken();
    return { kind: "login" };
  }

  if (!res.ok) {
    const err = await readApiError(res);
    return { kind: "error", status: res.status, message: friendlyEntryError(err) };
  }

  let body = null;
  try {
    body = await res.json();
  } catch (e) { /* handled below */ }
  const data = body?.success ? body.data : null;
  if (data?.alreadyPaid) return { kind: "alreadyPaid" };
  if (data?.paymentUrl && isSafePaymentUrl(data.paymentUrl)) {
    return { kind: "redirect", paymentUrl: data.paymentUrl };
  }
  return { kind: "error", status: res.status, message: body?.message || "The payment link was missing. Please try again." };
}
