// ============================================================
//  Smart Ajo — auth.js
// ============================================================

const BASE_URL = "https://smartajo.up.railway.app";

import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  logoutUser,
  redirectIfLoggedIn,
  getToken,
} from "./api.js";

// Re-exporting this function for HTML imports
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
      <div class="flex items-center justify-center gap-3">
        <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        <span>Processing...</span>
      </div>
    `;
  } else {
    btn.innerHTML = defaultText;
  }

  btn.classList.toggle("opacity-70", isLoading);
  btn.classList.toggle("cursor-not-allowed", isLoading);
}

// ─────────────────────────────────────────────
// AUTH ACTIONS
// ─────────────────────────────────────────────

/**
 * Toggles input between 'password' and 'text'
 */
export function togglePasswordVisibility(inputId) {
  const passwordInput = document.getElementById(inputId);
  if (!passwordInput) return;

  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
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
    showError("authError", "Please accept the terms to continue.");
    return;
  }

  setLoading("signUpBtn", true, "Create Account");

  try {
    await registerUser({
      email: email,
      username: email.split("@")[0],
      full_name: fullName,
      phone_number: phone,
      password: password,
      password_again: confirmPassword,
    });

    localStorage.setItem("ajo_pending_email", email);
    window.location.href = "verify-signup.html";
  } catch (error) {
    console.error("Registration Error Details:", error);
    showError("authError", error.message || "Registration failed.");
    setLoading("signUpBtn", false, "Create Account");
  }
}

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

    // UPDATED: Redirect to the "Account Created" success page
    window.location.replace("success.html");
  } catch (error) {
    showError("authError", error.message || "Invalid OTP code.");
    setLoading("verifyBtn", false, "Verify & Continue");
  }
}

export async function handleResendOTP() {
  const email = localStorage.getItem("ajo_pending_email");
  if (!email) {
    showError("authError", "Email not found. Please sign up again.");
    return;
  }

  try {
    await resendOtp(email);
    alert("A new OTP code has been sent to your email.");
  } catch (error) {
    showError("authError", "Failed to resend code. Please try again.");
  }
}

export function handleLogout() {
  logoutUser();
}

export async function handleSetupProfile() {
  const displayName = document.getElementById("displayName")?.value?.trim();
  const dateOfBirth = document.getElementById("dateOfBirth")?.value;
  const errorEl = document.getElementById("authError");

  if (!displayName) {
    if (errorEl) {
      errorEl.textContent = "Please enter a display name.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  const btn = document.getElementById("profileBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  try {
    const token = getToken();
    const response = await fetch(
      `${BASE_URL}/api/auth/profile/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: displayName.split(" ")[0],
          last_name: displayName.split(" ").slice(1).join(" ") || "",
          date_of_birth: dateOfBirth || null,
        }),
      }
    );

    if (!response.ok) throw new Error("Failed to update profile.");
    window.location.replace("dashboard.html");
  } catch (error) {
    if (errorEl) {
      errorEl.textContent = error.message || "Something went wrong.";
      errorEl.classList.remove("hidden");
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "CONTINUE";
    }
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
  window.togglePassword = () => togglePasswordVisibility("password");
  window.handleSetupProfile = handleSetupProfile;
}
