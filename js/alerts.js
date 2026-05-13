// ============================================================
//  Smart Ajo — alerts.js
//  Loads notifications and handles filter chip switching.
//  Import this in: alerts.html
// ============================================================

import {
  requireAuth,
  getAlerts,
  markAlertAsRead,
  deleteAlert
} from './api.js';


// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

let allAlerts = []; // cache alerts so filtering is instant

export async function initAlertsPage() {
  if (!requireAuth()) return;
  await loadAlerts('all');
}


// ─────────────────────────────────────────────
// LOAD ALERTS
// ─────────────────────────────────────────────

async function loadAlerts(type = 'all') {
  const listEl = document.getElementById('notif-list');
  const countEl = document.getElementById('alertCount');
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-8">Loading notifications...</p>`;

  try {
    const data = await getAlerts(type === 'all' ? '' : type);
    allAlerts = data.alerts || [];

    // Update "4 New" count badge
    const unread = allAlerts.filter(a => !a.isRead).length;
    if (countEl) countEl.textContent = unread > 0 ? `${unread} New` : 'All Read';

    renderAlerts(allAlerts);
  } catch (error) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-8">Failed to load notifications.</p>`;
    console.error('loadAlerts error:', error.message);
  }
}


// ─────────────────────────────────────────────
// RENDER ALERTS
// ─────────────────────────────────────────────

function renderAlerts(alerts) {
  const listEl = document.getElementById('notif-list');
  if (!listEl) return;

  if (alerts.length === 0) {
    listEl.innerHTML = `
      <div class="flex flex-col items-center text-center py-12">
        <div class="w-14 h-14 bg-[#F0F0F0] rounded-full flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-[#9E9E9E]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-[#3A3A3A]">No notifications</p>
        <p class="text-xs text-[#9E9E9E] mt-1">You're all caught up!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = alerts.map(alert => buildAlertCard(alert)).join('');
}


// ─────────────────────────────────────────────
// BUILD ALERT CARD HTML
// ─────────────────────────────────────────────

function buildAlertCard(alert) {
  const icon = getAlertIcon(alert.type);
  const time = formatTime(alert.createdAt);
  const unreadDot = !alert.isRead
    ? `<span class="w-2 h-2 bg-[#3A3A3A] rounded-full shrink-0 mt-1.5"></span>`
    : '';

  const ctaMap = {
    payment: { label: 'Fund Wallet', action: `fundWallet('${alert.id}')` },
    risk:    { label: 'View Options', action: `viewRiskOptions('${alert.id}')` },
    payout:  { label: 'View Receipt', action: `viewReceipt('${alert.id}')` },
  };
  const cta = ctaMap[alert.type];

  return `
    <div id="alert-${alert.id}"
      class="flex items-start gap-4 bg-white rounded-2xl p-4 ${!alert.isRead ? 'border border-[#E8E8E4]' : ''}"
      onclick="handleAlertRead('${alert.id}')">
      ${icon}
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-1">
          <p class="text-sm font-semibold text-[#1A1A1A]">${alert.title}</p>
          <span class="text-[10px] text-[#9E9E9E] shrink-0">${time}</span>
        </div>
        <p class="text-xs text-[#6B6B6B] leading-relaxed">${alert.message}</p>
        ${cta ? `<button onclick="${cta.action}" class="mt-2.5 text-xs font-semibold text-[#3A3A3A] underline underline-offset-2 hover:opacity-70 transition-opacity">${cta.label}</button>` : ''}
      </div>
      ${unreadDot}
    </div>`;
}


// ─────────────────────────────────────────────
// FILTER CHIPS
// ─────────────────────────────────────────────

export function filterAlerts(type) {
  // Update chip styles
  const chips = ['all', 'payment', 'risk', 'payout'];
  chips.forEach(c => {
    const el = document.getElementById('chip-' + c);
    if (!el) return;
    el.className = 'chip shrink-0 text-xs font-semibold px-4 py-2 rounded-full transition-all ' +
      (c === type
        ? 'bg-[#3A3A3A] text-white'
        : 'bg-white text-[#6B6B6B] border border-[#E0E0E0]');
  });

  // Filter from cached alerts (no extra API call)
  const filtered = type === 'all'
    ? allAlerts
    : allAlerts.filter(a => a.type === type);

  renderAlerts(filtered);
}


// ─────────────────────────────────────────────
// MARK AS READ
// ─────────────────────────────────────────────

export async function handleAlertRead(alertId) {
  try {
    await markAlertAsRead(alertId);
    // Remove unread dot visually
    const card = document.getElementById(`alert-${alertId}`);
    if (card) {
      card.classList.remove('border', 'border-[#E8E8E4]');
      const dot = card.querySelector('.bg-\\[\\#3A3A3A\\].rounded-full');
      if (dot) dot.remove();
    }
    // Update badge count
    const countEl = document.getElementById('alertCount');
    if (countEl) {
      const current = parseInt(countEl.textContent) || 0;
      const newCount = Math.max(0, current - 1);
      countEl.textContent = newCount > 0 ? `${newCount} New` : 'All Read';
    }
  } catch (error) {
    console.error('markAlertAsRead error:', error.message);
  }
}


// ─────────────────────────────────────────────
// CTA ACTIONS
// ─────────────────────────────────────────────

export function fundWallet(alertId) {
  handleAlertRead(alertId);
  // Navigate to payment flow — update with your payment page
  window.location.href = 'dashboard.html';
}

export function viewRiskOptions(alertId) {
  handleAlertRead(alertId);
  window.location.href = 'groups.html';
}

export function viewReceipt(alertId) {
  handleAlertRead(alertId);
  // Show receipt — update with your receipt page
  alert('Receipt feature coming soon!');
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getAlertIcon(type) {
  const icons = {
    payment: {
      bg: 'bg-[#FFF8E7]',
      color: 'text-[#F5A623]',
      svg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
    },
    risk: {
      bg: 'bg-[#FFF1F0]',
      color: 'text-[#EF4444]',
      svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
    },
    payout: {
      bg: 'bg-[#F0FDF4]',
      color: 'text-[#22C55E]',
      svg: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
    },
  };

  const i = icons[type] || icons.payment;
  return `
    <div class="w-10 h-10 ${i.bg} rounded-xl flex items-center justify-center shrink-0 mt-0.5">
      <svg class="w-5 h-5 ${i.color}" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
        ${i.svg}
      </svg>
    </div>`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}
