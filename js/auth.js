// ============================================================
//  Smart Ajo — auth.js
// ============================================================

const BASE_URL = "https://smart-ajo.onrender.com";

import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  logoutUser,
  redirectIfLoggedIn,
  getToken,
} from "./api.js";

// Re-exporting for direct HTML imports
export { redirectIfLoggedIn };

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add("hidden");
}

function setLoading(buttonId, isLoading, defaultText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        <span>Wait...</span>
      </div>
    `;
  } else {
    btn.innerHTML = defaultText;
  }
}

// ─────────────────────────────────────────────
// AUTH ACTIONS
// ─────────────────────────────────────────────

/**
 * Toggles password visibility and updates the eye icon
 */
export function togglePasswordVisibility(inputId, iconId) {
  const passwordInput = document.getElementById(inputId);
  const eyeIcon = document.getElementById(iconId);
  if (!passwordInput) return;

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    if (eyeIcon) {
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>`;
    }
  } else {
    passwordInput.type = "password";
    if (eyeIcon) {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>`;
    }
  }
}

export async function handleSignIn() {
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;
  hideError("authError");

  if (!email || !password) {
    showError("authError", "Please enter both email and password.");
    return;
  }

  setLoading("signInBtn", true, "Sign In");
  try {
    await loginUser(email, password);
    window.location.replace("dashboard.html");
  } catch (error) {
    showError("authError", error.message || "Invalid credentials.");
    setLoading("signInBtn", false, "Sign In");
  }
}

export async function handleSignUp() {
  const fullName = document.getElementById("fullName")?.value?.trim();
  const email = document.getElementById("email")?.value?.trim();
  const phone = document.getElementById("phone")?.value?.trim();
  const password = document.getElementById("password")?.value;
  const confirmPassword = document.getElementById("confirmPassword")?.value;
  const termsChecked = document.getElementById("terms")?.checked;

  hideError("authError");

  if (!fullName || !email || !phone || !password || !confirmPassword) {
    showError("authError", "All fields are required.");
    return;
  }
  if (password !== confirmPassword) {
    showError("authError", "Passwords do not match.");
    return;
  }
  if (!termsChecked) {
    showError("authError", "Please accept the terms.");
    return;
  }

  setLoading("signUpBtn", true, "Create Account");
  try {
    await registerUser({
      email,
      username: email.split("@")[0] + Math.floor(Math.random() * 1000),
      full_name: fullName,
      phone_number: phone,
      password,
      password_again: confirmPassword,
    });
    localStorage.setItem("ajo_pending_email", email);
    window.location.href = "verify-signup.html";
  } catch (error) {
    showError("authError", error.message || "Registration failed.");
    setLoading("signUpBtn", false, "Create Account");
  }
}

/**
 * Handles OTP verification for Signup
 */
export async function handleVerifySignup() {
  hideError("authError");
  const otpInputs = document.querySelectorAll(".otp-input");
  const otpCode = Array.from(otpInputs)
    .map((i) => i.value)
    .join("");
  const email = localStorage.getItem("ajo_pending_email");

  if (otpCode.length < 6) {
    showError("authError", "Please enter the full 6-digit code.");
    return;
  }

  setLoading("verifyBtn", true, "Verify & Continue");

  try {
    await verifyOtp(email, otpCode);
    localStorage.removeItem("ajo_pending_email");
    window.location.replace("success.html");
  } catch (error) {
    showError("authError", error.message || "Invalid OTP code.");
    setLoading("verifyBtn", false, "Verify & Continue");
  }
}

/**
 * Handles OTP Resend
 */
export async function handleResendOTP() {
  const email = localStorage.getItem("ajo_pending_email");
  if (!email) {
    showError("authError", "Email not found. Please sign up again.");
    return;
  }

  try {
    await resendOtp(email);
    alert("A new code has been sent to your email.");
  } catch (error) {
    showError("authError", "Failed to resend code.");
  }
}

export function handleLogout() {
  logoutUser();
}

/**
 * Initial Profile Setup (Targets /api/auth/profile/)
 */
export async function handleSetupProfile() {
  const displayName = document.getElementById("displayName")?.value?.trim();
  const dateOfBirth = document.getElementById("dateOfBirth")?.value;
  hideError("authError");

  if (!displayName) {
    showError("authError", "Please enter a display name.");
    return;
  }

  setLoading("profileBtn", true, "CONTINUE");

  try {
    const token = getToken();
    const response = await fetch(`${BASE_URL}/api/auth/profile/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        full_name: displayName,
        date_of_birth: dateOfBirth || null,
      }),
    });

    if (!response.ok) throw new Error("Failed to update profile.");
    window.location.replace("dashboard.html");
  } catch (error) {
    showError("authError", error.message || "Something went wrong.");
    setLoading("profileBtn", false, "CONTINUE");
  }
}

// ─────────────────────────────────────────────
// GLOBAL EXPOSURE
// ─────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.handleSignIn = handleSignIn;
  window.handleSignUp = handleSignUp;
  window.handleVerifySignup = handleVerifySignup;
  window.handleResendOTP = handleResendOTP;
  window.handleLogout = handleLogout;
  window.handleSetupProfile = handleSetupProfile;
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.redirectIfLoggedIn = redirectIfLoggedIn;
}
