// ============================================================
//  Smart Ajo — profile.js
//  Handles profile page, edit profile, and user data loading.
//  Import this in: profile.html
// ============================================================

import {
  requireAuth,
  getMe,
  updateUserProfile,
  uploadAvatar,
  getUserRiskScore,
  getUserContributionHistory,
  logoutUser
} from './api.js';


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

export async function initProfilePage() {
  if (!requireAuth()) return;
  await loadUserProfile();
}


// ─────────────────────────────────────────────
// LOAD USER PROFILE
// ─────────────────────────────────────────────

async function loadUserProfile() {
  try {
    const user = await getMe();

    // Name
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = user.displayName || user.fullName;

    // Initials in avatar
    const initialsEl = document.getElementById('profileInitials');
    if (initialsEl) initialsEl.textContent = getInitials(user.displayName || user.fullName);

    // Avatar image
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl && user.avatarUrl) {
      avatarEl.innerHTML = `<img src="${user.avatarUrl}" class="w-full h-full object-cover rounded-full"/>`;
    }

    // Phone + email
    const phoneEl = document.getElementById('profilePhone');
    const emailEl = document.getElementById('profileEmail');
    if (phoneEl) phoneEl.textContent = user.phone || '—';
    if (emailEl) emailEl.textContent = user.email || '—';

    // Member since
    const sinceEl = document.getElementById('memberSince');
    if (sinceEl && user.createdAt) {
      sinceEl.textContent = `Member since ${formatDate(user.createdAt)}`;
    }

    // Save email for payment flow
    if (user.email) localStorage.setItem('ajo_user_email', user.email);

  } catch (error) {
    console.error('loadUserProfile error:', error.message);
  }
}


// ─────────────────────────────────────────────
// LOAD RISK SCORE (for My Risk Score menu item)
// ─────────────────────────────────────────────

export async function loadMyRiskScore() {
  try {
    const userId = localStorage.getItem('ajo_user_id');
    if (!userId) return;

    const data = await getUserRiskScore(userId);

    const scoreEl = document.getElementById('myRiskScore');
    const labelEl = document.getElementById('myRiskLabel');

    const colorMap = {
      LOW: 'text-[#22C55E]',
      MEDIUM: 'text-[#F5A623]',
      HIGH: 'text-[#EF4444]'
    };

    if (scoreEl) {
      scoreEl.textContent = data.score;
      scoreEl.className = `text-sm font-bold ${colorMap[data.score] || 'text-[#3A3A3A]'}`;
    }
    if (labelEl) labelEl.textContent = data.details || '';

  } catch (error) {
    console.error('loadMyRiskScore error:', error.message);
  }
}


// ─────────────────────────────────────────────
// EDIT PROFILE — edit-profile.html
// ─────────────────────────────────────────────

export async function initEditProfile() {
  if (!requireAuth()) return;

  // Pre-fill form with current data
  try {
    const user = await getMe();
    setValue('displayName', user.displayName || '');
    setValue('dateOfBirth', user.dateOfBirth || '');

    const nationalityEl = document.getElementById('nationality');
    if (nationalityEl) nationalityEl.value = user.nationality || '';

    // Show current avatar
    const avatarEl = document.getElementById('avatarPreview');
    if (avatarEl && user.avatarUrl) {
      avatarEl.innerHTML = `<img src="${user.avatarUrl}" class="w-full h-full object-cover rounded-full"/>`;
    }
  } catch (error) {
    console.error('initEditProfile error:', error.message);
  }
}

export async function handleEditProfile() {
  const displayName = document.getElementById('displayName')?.value?.trim();
  const dateOfBirth = document.getElementById('dateOfBirth')?.value;
  const nationality = document.getElementById('nationality')?.value;
  const avatarInput = document.getElementById('avatarInput');

  hideError('profileError');

  if (!displayName) {
    showError('profileError', 'Please enter your display name.');
    return;
  }

  setLoading('saveBtn', true, 'Save Changes');

  try {
    await updateUserProfile({ displayName, dateOfBirth, nationality });

    if (avatarInput?.files[0]) {
      const formData = new FormData();
      formData.append('avatar', avatarInput.files[0]);
      await uploadAvatar(formData);
    }

    window.location.href = 'profile.html';
  } catch (error) {
    showError('profileError', error.message || 'Update failed. Try again.');
  } finally {
    setLoading('saveBtn', false, 'Save Changes');
  }
}


// ─────────────────────────────────────────────
// SAVINGS HISTORY
// ─────────────────────────────────────────────

export async function loadSavingsHistory() {
  const listEl = document.getElementById('savingsHistoryList');
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-6">Loading history...</p>`;

  try {
    const data = await getUserContributionHistory();
    const history = data.contributions || [];

    if (history.length === 0) {
      listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-6">No contribution history yet.</p>`;
      return;
    }

    listEl.innerHTML = history.map(item => {
      const statusColor = item.status === 'PAID'
        ? 'text-[#22C55E]'
        : item.status === 'MISSED'
        ? 'text-[#EF4444]'
        : 'text-[#F5A623]';

      return `
        <div class="bg-white rounded-2xl px-4 py-4 flex items-center gap-3">
          <div class="w-10 h-10 bg-[#F5F4EF] rounded-xl flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-[#3A3A3A]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-[#1A1A1A] truncate">${item.groupName}</p>
            <p class="text-xs text-[#9E9E9E]">${formatDate(item.date)} · Cycle ${item.cycle}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold text-[#1A1A1A]">₦${item.amount?.toLocaleString('en-NG')}</p>
            <p class="text-xs font-semibold ${statusColor}">${item.status}</p>
          </div>
        </div>`;
    }).join('');

  } catch (error) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-6">Failed to load history.</p>`;
  }
}


// ─────────────────────────────────────────────
// LOG OUT
// ─────────────────────────────────────────────

export async function handleLogout() {
  if (!confirm('Are you sure you want to log out?')) return;

  try {
    await logoutUser(); // clears token inside api.js
  } catch (error) {
    // Even if API call fails, clear local token and redirect
    localStorage.removeItem('ajo_token');
  } finally {
    window.location.href = 'signin.html';
  }
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' });
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function setLoading(buttonId, isLoading, defaultText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Please wait...' : defaultText;
  btn.classList.toggle('opacity-60', isLoading);
}
