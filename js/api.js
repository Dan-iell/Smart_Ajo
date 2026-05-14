// ============================================================
//  Smart Ajo — api.js
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
    const contentType = response.headers.get("content-type");

    if (response.status === 401 && isAuth) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) return request(method, endpoint, body, isAuth);
      logoutUser();
      return;
    }

    if (!response.ok) {
      const errorData =
        contentType && contentType.includes("application/json")
          ? await response.json()
          : { message: "Server Error" };
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

function handleAuthResponse(data) {
  const token =
    data.access ||
    data.token ||
    (data.data && (data.data.access || data.data.token));
  const refresh = data.refresh || (data.data && data.data.refresh);

  if (token) {
    saveToken(token);
    if (refresh) saveRefreshToken(refresh);
    return true;
  }
  return false;
}

export async function loginUser(email, password) {
  const data = await request("POST", "api/auth/login/", { email, password });
  handleAuthResponse(data);
  return data;
}

export async function registerUser(userData) {
  return request("POST", "api/auth/register/", userData);
}

export async function verifyOtp(email, otp) {
  const data = await request("POST", "api/auth/verify-otp/", { email, otp });
  handleAuthResponse(data);
  return data;
}

export async function resendOtp(email) {
  return request("POST", "api/auth/resend-otp/", { email });
}

// ─────────────────────────────────────────────
// USER & DATA ACTIONS
// ─────────────────────────────────────────────

export async function getMe() {
  return request("GET", "api/auth/me/", null, true);
}

/**
 * Updates the current user's profile information.
 * Pointing to /api/auth/profile/ as per Swagger documentation.
 */
export async function updateProfile(userData) {
  // Use PATCH for partial updates (just name/email/phone)
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

export async function joinGroup(groupId) {
  return request("POST", `api/groups/${groupId}/join/`, null, true);
}

export async function joinGroupByCode(code) {
  return request("POST", "api/groups/join-by-code/", { code }, true);
}

export async function getGroupMembers(groupId) {
  return request("GET", `api/groups/${groupId}/members/`, null, true);
}

export async function getUserRisk() {
  return request("GET", "api/users/risk/", null, true);
}

export async function addCard(cardData) {
  return request("POST", "api/payments/add-card/", cardData, true);
}

export async function initiatePayment(groupId) {
  return request("POST", `api/contributions/contribute/${groupId}/`, null, true);
}

export async function verifyPayment({ transactionRef }) {
  return request("POST", "api/contributions/squad-callback/", { transaction_ref: transactionRef }, true);
}

export async function getPaymentHistory() {
  return request("GET", "api/contributions/mine/", null, true);
}

export async function getRoundSummary(groupId) {
  return request("GET", `api/contributions/round-summary/${groupId}/`, null, true);
}

export function logoutUser() {
  clearToken();
  window.location.href = window.location.origin + "/index.html";
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
