// ============================================================
//  Smart Ajo — payment.js
//  Handles the full payment flow:
//  make-payment.html → confirm-payment.html → payment-success.html
// ============================================================

import {
  requireAuth,
  getMyGroups,
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getRoundSummary,
} from './api.js';


// ─────────────────────────────────────────────
// MAKE PAYMENT PAGE — make-payment.html
// ─────────────────────────────────────────────

export async function initMakePayment() {
  if (!requireAuth()) return;
  await loadGroupSelector();
}

async function loadGroupSelector() {
  try {
    const data = await getMyGroups();
    // Handle both { groups: [] } and direct array responses
    const groups = Array.isArray(data) ? data : (data.groups || data.results || []);

    const selector = document.getElementById('groupSelector');
    const amountEl = document.getElementById('contributionAmount');
    const groupLabel = document.getElementById('groupLabel');

    if (!selector || groups.length === 0) {
      if (amountEl) amountEl.textContent = '₦0';
      if (groupLabel) groupLabel.textContent = 'No groups';
      return;
    }

    // Build dropdown options — handle snake_case or camelCase from backend
    selector.innerHTML = groups.map(g => {
      const amount = g.contribution_amount ?? g.contributionAmount ?? 0;
      return `<option value="${g.id}" data-amount="${amount}">${g.name}</option>`;
    }).join('');

    const first = groups[0];
    const firstAmount = first.contribution_amount ?? first.contributionAmount ?? 0;

    if (amountEl) amountEl.textContent = `₦${Number(firstAmount).toLocaleString('en-NG')}`;
    if (groupLabel) groupLabel.textContent = first.name;
    setValue('summaryAmount', `₦ ${Number(firstAmount).toLocaleString('en-NG')}`);
    updateCycleDue(first);

    sessionStorage.setItem('ajo_pay_groupId', first.id);
    sessionStorage.setItem('ajo_pay_amount', firstAmount);
    sessionStorage.setItem('ajo_pay_groupName', first.name);

    updatePayButton(firstAmount);

    selector.addEventListener('change', () => {
      const opt = selector.options[selector.selectedIndex];
      const amount = opt.dataset.amount;
      const name = opt.text;
      const idx = selector.selectedIndex;
      if (amountEl) amountEl.textContent = `₦${Number(amount).toLocaleString('en-NG')}`;
      if (groupLabel) groupLabel.textContent = name;
      setValue('summaryAmount', `₦ ${Number(amount).toLocaleString('en-NG')}`);
      updateCycleDue(groups[idx]);
      sessionStorage.setItem('ajo_pay_groupId', opt.value);
      sessionStorage.setItem('ajo_pay_amount', amount);
      sessionStorage.setItem('ajo_pay_groupName', name);
      updatePayButton(amount);
    });

  } catch (error) {
    console.error('loadGroupSelector error:', error.message);
  }
}

function updatePayButton(amount) {
  const btn = document.getElementById('payBtn');
  if (btn) btn.textContent = `Pay ₦${Number(amount).toLocaleString('en-NG')} with Squad`;
}

function updateCycleDue(group) {
  if (!group) return;
  // Cycle: e.g. "Round 3 of 8"
  const current = group.current_round ?? group.round_number ?? null;
  const total   = group.total_rounds ?? group.members_count ?? group.member_count ?? null;
  setValue('cycleDisplay', current != null && total != null ? `Round ${current} of ${total}` : '—');

  // Due date
  const raw = group.next_due_date ?? group.due_date ?? null;
  if (raw) {
    const date = new Date(raw);
    const today = new Date();
    const diffDays = Math.round((date - today) / 86400000);
    const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow'
      : diffDays < 0 ? 'Overdue'
      : date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    setValue('dueDateDisplay', label);
  } else {
    setValue('dueDateDisplay', '—');
  }
}

export function proceedToConfirm() {
  const groupId = sessionStorage.getItem('ajo_pay_groupId');
  const amount = sessionStorage.getItem('ajo_pay_amount');
  if (!groupId || !amount) {
    alert('Please select a group.');
    return;
  }
  window.location.href = 'confirm-payment.html';
}


// ─────────────────────────────────────────────
// CONFIRM PAYMENT PAGE — confirm-payment.html
// ─────────────────────────────────────────────

export function initConfirmPayment() {
  if (!requireAuth()) return;

  const amount = sessionStorage.getItem('ajo_pay_amount');
  const groupName = sessionStorage.getItem('ajo_pay_groupName');

  setValue('summaryAmount', `₦ ${Number(amount).toLocaleString('en-NG')}`);
  setValue('summaryGroup', groupName);
  setValue('summaryMethod', 'Squad (GTCO)');
  setValue('summaryDate', new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }));
  setValue('warningAmount', `₦${Number(amount).toLocaleString('en-NG')}`);
}

export async function handleConfirmPayment() {
  const groupId = sessionStorage.getItem('ajo_pay_groupId');
  const amount = sessionStorage.getItem('ajo_pay_amount');

  if (!groupId) {
    alert('Session expired. Please start again.');
    window.location.href = 'make-payment.html';
    return;
  }

  const btn = document.getElementById('confirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; btn.classList.add('opacity-60'); }

  try {
    const data = await initiatePayment(groupId);

    // Store the transaction ref before redirecting to Squad
    sessionStorage.setItem('ajo_pay_ref', data.transaction_ref || '');

    const checkoutUrl = data.checkout_url || data.paymentUrl;
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      // Sandbox / test mode — no redirect URL returned
      window.location.href = 'payment-success.html';
    }
  } catch (error) {
    alert(error.message || 'Payment failed. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Payment'; btn.classList.remove('opacity-60'); }
  }
}


// ─────────────────────────────────────────────
// PAYMENT SUCCESS PAGE — payment-success.html
// ─────────────────────────────────────────────

export async function initPaymentSuccess() {
  if (!requireAuth()) return;

  const transactionRef = sessionStorage.getItem('ajo_pay_ref');
  const amount = sessionStorage.getItem('ajo_pay_amount');
  const groupName = sessionStorage.getItem('ajo_pay_groupName');
  const groupId = sessionStorage.getItem('ajo_pay_groupId');

  setValue('receiptAmount', `₦ ${Number(amount).toLocaleString('en-NG')}`);
  setValue('receiptGroup', groupName);
  setValue('receiptTxId', transactionRef || '—');

  // Fetch round progress from backend
  if (groupId) {
    try {
      const summary = await getRoundSummary(groupId);
      const progressEl = document.getElementById('progressBar');
      const progressLabel = document.getElementById('progressLabel');

      const paid = summary.paid_count ?? summary.paid ?? null;
      const total = summary.total_members ?? summary.total ?? null;

      if (progressEl && paid != null && total != null && total > 0) {
        const pct = Math.round((paid / total) * 100);
        progressEl.style.width = `${pct}%`;
        progressEl.style.setProperty('--w', `${pct}%`);
      }
      if (progressLabel && paid != null && total != null) {
        progressLabel.textContent = `${paid}/${total} paid`;
      }
    } catch (error) {
      console.error('getRoundSummary error:', error.message);
    }
  }

  // Clear payment session data
  ['ajo_pay_groupId', 'ajo_pay_amount', 'ajo_pay_groupName',
   'ajo_pay_method', 'ajo_pay_ref']
    .forEach(k => sessionStorage.removeItem(k));
}


// ─────────────────────────────────────────────
// SQUAD REDIRECT HANDLER
// Called on payment-success.html load when Squad
// redirects back with ?transaction_ref=...
// ─────────────────────────────────────────────

export async function handleSquadRedirect() {
  const params = new URLSearchParams(window.location.search);
  const transactionRef = params.get('transaction_ref') || params.get('ref');

  if (!transactionRef) return false;

  sessionStorage.setItem('ajo_pay_ref', transactionRef);

  // Clean up URL so refreshing doesn't re-trigger verification
  history.replaceState({}, '', window.location.pathname);

  try {
    await verifyPayment({ transactionRef });
  } catch (error) {
    console.error('verifyPayment error:', error.message);
  }

  return true;
}


// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
