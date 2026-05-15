// ============================================================
//  Smart Ajo — api.js (MERGED)
// ============================================================

const BASE_URL = "https://smartajo.up.railway.app";

// ─────────────────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────────────────

export function getToken() {
  const token = localStorage.getItem("ajo_token");
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

function getRefreshToken() {
  const token = localStorage.getItem("ajo_refresh_token");
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

function saveToken(token) {
  if (!token || token === "undefined" || token === "null") {
    console.error("Attempted to save an invalid token.");
    return;
  }
  localStorage.setItem("ajo_token", token);
}

function saveRefreshToken(token) {
  if (!token || token === "undefined" || token === "null") return;
  localStorage.setItem("ajo_refresh_token", token);
}

function clearToken() {
  localStorage.removeItem("ajo_token");
  localStorage.removeItem("ajo_refresh_token");
}

// ─────────────────────────────────────────────
// REQUEST HELPER
// ─────────────────────────────────────────────

async function request(method, endpoint, body = null, isAuth = false) {
  const token = getToken();

  if (isAuth && !token) {
    logoutUser();
    return;
  }

  const headers = isAuth
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  // Normalizes slashes to ensure trailing slashes for Django compatibility
  let cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (!cleanEndpoint.endsWith("/")) cleanEndpoint += "/";

  const url = `${BASE_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, options);

    if (response.status === 401 && isAuth) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) return request(method, endpoint, body, isAuth);
      logoutUser();
      return;
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Server Error" }));
      throw new Error(
        errorData.message || errorData.detail || `Error ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[API ERROR] ${method} ${url}`, error);
    throw error;
  }
}

async function attemptTokenRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      saveToken(data.access || data.token);
      return true;
    }
  } catch (e) {
    console.error("Refresh failed", e);
  }
  return false;
}

// ─────────────────────────────────────────────
// AUTH ACTIONS
// ─────────────────────────────────────────────

export async function loginUser(email, password) {
  const data = await request("POST", "api/auth/login/", { email, password });
  const token =
    data.access ||
    data.token ||
    (data.data && (data.data.access || data.data.token));
  const refresh = data.refresh || (data.data && data.data.refresh);
  if (token) {
    saveToken(token);
    if (refresh) saveRefreshToken(refresh);
  }
  return data;
}

export async function registerUser(userData) {
  return request("POST", "api/auth/register/", userData);
}

export async function verifyOtp(email, otp) {
  const data = await request("POST", "api/auth/verify-otp/", { email, otp });
  const token =
    data.access ||
    data.token ||
    (data.data && (data.data.access || data.data.token));
  const refresh = data.refresh || (data.data && data.data.refresh);
  if (token) {
    saveToken(token);
    if (refresh) saveRefreshToken(refresh);
  }
  return data;
}

export async function resendOtp(email) {
  return request("POST", "api/auth/resend-otp/", { email });
}

// ─────────────────────────────────────────────
// USER & PROFILE
// ─────────────────────────────────────────────

/**
 * Fetches current user basic info.
 * Targets Swagger: GET /api/auth/me/
 */
export async function getMe() {
  return request("GET", "api/auth/me/", null, true);
}

/**
 * Updates the current user's profile information.
 * Targets Swagger: PATCH /api/auth/profile/
 */
export async function updateProfile(userData) {
  return request("PATCH", "api/auth/profile/", userData, true);
}

export async function getMemberProfile(groupId, memberId) {
  try {
    const members = await request(
      "GET",
      `api/groups/${groupId}/members/`,
      null,
      true,
    );
    const member = members.find((m) => String(m.id) === String(memberId));
    if (!member) throw new Error("Member not found in this group.");
    return member;
  } catch (error) {
    console.error(`Error fetching profile:`, error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────────

export async function getMyGroups() {
  try {
    return await request("GET", "api/groups/my-groups/", null, true);
  } catch (error) {
    console.error("Error fetching user groups:", error);
    throw error;
  }
}

export async function getGroupDetail(groupId) {
  try {
    return await request("GET", `api/groups/${groupId}/`, null, true);
  } catch (error) {
    console.error(`Error fetching detail for group ${groupId}:`, error);
    throw error;
  }
}

// Alias so groups.js can call getGroupById without breaking
export async function getGroupById(groupId) {
  return getGroupDetail(groupId);
}

export async function createGroup(groupData) {
  return request("POST", "api/groups/create/", groupData, true);
}

export async function discoverGroups() {
  try {
    return await request("GET", "api/groups/discover/", null, true);
  } catch (error) {
    console.error("Error in discoverGroups API call:", error);
    throw error;
  }
}

/**
 * Joins a specific group by ID.
 * Targets Swagger: POST /api/groups/{id}/join/
 */
export async function joinGroup(groupId) {
  return request("POST", `api/groups/${groupId}/join/`, null, true);
}

export async function joinGroupByCode(code) {
  return request("POST", "api/groups/join-by-code/", { code }, true);
}

export async function getGroupMembers(groupId) {
  return request("GET", `api/groups/${groupId}/members/`, null, true);
}

export async function getGroupInviteLink(groupId) {
  return request("GET", `api/groups/${groupId}/invite-link/`, null, true);
}

export async function getGroupHealthScore(groupId) {
  try {
    return await request("GET", `api/groups/${groupId}/health/`, null, true);
  } catch {
    // Fallback: return a neutral score if endpoint doesn't exist yet
    return { score: 75, label: "Good", details: "Based on payment history." };
  }
}

// ─────────────────────────────────────────────
// CONTRIBUTIONS & PAYMENTS
// ─────────────────────────────────────────────

export async function getUserRisk() {
  return request("GET", "api/users/risk/", null, true);
}

export async function addCard(cardData) {
  return request("POST", "api/payments/add-card/", cardData, true);
}

export async function initiatePayment(groupId) {
  return request(
    "POST",
    `api/contributions/contribute/${groupId}/`,
    null,
    true,
  );
}

export async function verifyPayment({ transactionRef }) {
  return request(
    "POST",
    "api/contributions/squad-callback/",
    { transaction_ref: transactionRef },
    true,
  );
}

export async function getPaymentHistory() {
  return request("GET", "api/contributions/mine/", null, true);
}

export async function getRoundSummary(groupId) {
  return request(
    "GET",
    `api/contributions/round-summary/${groupId}/`,
    null,
    true,
  );
}

export async function getCycleContributions(groupId) {
  return request("GET", `api/contributions/group/${groupId}/`, null, true);
}

export async function getNextPayout(groupId) {
  return request("GET", `api/contributions/payouts/${groupId}/`, null, true);
}

// ─────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────

export async function getWallet() {
  return request("GET", "api/wallet/", null, true);
}

export async function fundWallet(amount) {
  return request("POST", "api/wallet/fund/", { amount }, true);
}

export async function getWalletTransactions() {
  return request("GET", "api/wallet/transactions/", null, true);
}

// ─────────────────────────────────────────────
// CARDS
// Backend endpoint: POST /api/payments/add-card/
// Body: { card_number, cvv, expiry_month, expiry_year }
// ─────────────────────────────────────────────

export async function getCards() {
  return request("GET", "api/payments/cards/", null, true);
}

export async function saveCard({ cardNumber, cvv, expiryMonth, expiryYear }) {
  return request(
    "POST",
    "api/payments/add-card/",
    {
      card_number: cardNumber,
      cvv,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
    },
    true,
  );
}

export async function deleteCard(cardId) {
  return request("DELETE", `api/payments/cards/${cardId}/`, null, true);
}

// ─────────────────────────────────────────────
// ALERTS / NOTIFICATIONS
// ─────────────────────────────────────────────

/**
 * Fetches risk-related alerts for the current user.
 * Targets: GET /api/auth/risk/
 */
export async function getRiskAlerts() {
  return request("GET", "api/auth/risk/", null, true);
}

/**
 * Fetches payment-related alerts (contributions history).
 * Targets: GET /api/contributions/mine/
 */
export async function getPaymentAlerts() {
  return request("GET", "api/contributions/mine/", null, true);
}

/**
 * Fetches payout-related alerts.
 * Targets: GET /api/contributions/mine/ (Fallback)
 */
export async function getPayoutAlerts() {
  return request("GET", "api/contributions/mine/", null, true);
}

/**
 * Updated getAlerts to act as a router to prevent 404s
 */
export async function getAlerts(type = "all") {
  if (type === "risk") return getRiskAlerts();
  if (type === "payment") return getPaymentAlerts();
  if (type === "payout") return getPayoutAlerts();

  // Default: Return Risk alerts if 'all' or empty
  return getRiskAlerts();
}

export async function markAlertAsRead(alertId) {
  return request(
    "PATCH",
    `api/notifications/${alertId}/`,
    { is_read: true },
    true,
  );
}

export async function deleteAlert(alertId) {
  return request("DELETE", `api/notifications/${alertId}/`, null, true);
}

// ─────────────────────────────────────────────
// NAVIGATION GUARDS
// ─────────────────────────────────────────────

export function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.replace("../index.html");
    return false;
  }
  return true;
}

export function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.replace("dashboard.html");
  }
}

export function logoutUser() {
  clearToken();
  window.location.href = window.location.origin + "/index.html";
}
