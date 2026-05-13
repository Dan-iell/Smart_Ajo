// ============================================================
//  Smart Ajo — payment.js
//  Handles the full payment flow:
//  make-payment.html → confirm-payment.html → payment-success.html
// ============================================================

import {
  requireAuth,
  getMyGroups,
  getCards,
  initiatePayment,
  verifyPayment,
  getPaymentHistory
} from './api.js';


// ─────────────────────────────────────────────
// MAKE PAYMENT PAGE — make-payment.html
// ─────────────────────────────────────────────

export async function initMakePayment() {
  if (!requireAuth()) return;

  await Promise.all([
    loadGroupSelector(),
    loadPaymentMethods(),
  ]);
}

async function loadGroupSelector() {
  try {
    const data = await getMyGroups();
    const groups = data.groups || [];

    const selector = document.getElementById('groupSelector');
    const amountEl = document.getElementById('contributionAmount');
    const groupLabel = document.getElementById('groupLabel');

    if (!selector || groups.length === 0) return;

    // Build dropdown options
    selector.innerHTML = groups.map(g =>
      `<option value="${g.id}" data-amount="${g.contributionAmount}">${g.name}</option>`
    ).join('');

    // Set initial amount from first group
    const first = groups[0];
    if (amountEl) amountEl.textContent = `₦${first.contributionAmount?.toLocaleString('en-NG')}`;
    if (groupLabel) groupLabel.textContent = first.name;

    // Save to session for confirm page
    sessionStorage.setItem('ajo_pay_groupId', first.id);
    sessionStorage.setItem('ajo_pay_amount', first.contributionAmount);
    sessionStorage.setItem('ajo_pay_groupName', first.name);

    // Update on change
    selector.addEventListener('change', () => {
      const selected = selector.options[selector.selectedIndex];
      const amount = selected.dataset.amount;
      const name = selected.text;
      if (amountEl) amountEl.textContent = `₦${Number(amount).toLocaleString('en-NG')}`;
      if (groupLabel) groupLabel.textContent = name;
      sessionStorage.setItem('ajo_pay_groupId', selected.value);
      sessionStorage.setItem('ajo_pay_amount', amount);
      sessionStorage.setItem('ajo_pay_groupName', name);
      updatePayButton(amount);
    });

    updatePayButton(first.contributionAmount);

  } catch (error) {
    console.error('loadGroupSelector error:', error.message);
  }
}

async function loadPaymentMethods() {
  try {
    const data = await getCards();
    const cards = data.cards || [];

    const cardLabel = document.getElementById('cardLabel');
    if (cardLabel && cards.length > 0) {
      const card = cards[0];
      cardLabel.textContent = `Pay instantly · ••••${card.last4}`;
      sessionStorage.setItem('ajo_pay_method', `Debit Card(•••••${card.last4})`);
    }
  } catch (error) {
    console.error('loadPaymentMethods error:', error.message);
  }
}

function updatePayButton(amount) {
  const btn = document.getElementById('payBtn');
  if (btn) btn.textContent = `Pay ₦${Number(amount).toLocaleString('en-NG')}`;
}

export function selectPaymentMethod(method) {
  // Update radio UI
  document.querySelectorAll('.pay-method').forEach(el => {
    const isSelected = el.dataset.method === method;
    el.classList.toggle('border-[#3A3A3A]', isSelected);
    el.classList.toggle('border-[#E0E0E0]', !isSelected);
    const dot = el.querySelector('.radio-dot');
    if (dot) dot.classList.toggle('hidden', !isSelected);
  });
  sessionStorage.setItem('ajo_pay_method_type', method);
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
  const method = sessionStorage.getItem('ajo_pay_method') || 'Debit Card';

  // Populate summary
  setValue('summaryAmount', `₦ ${Number(amount).toLocaleString('en-NG')}`);
  setValue('summaryGroup', groupName);
  setValue('summaryMethod', method);
  setValue('summaryDate', new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }));

  // Update warning text
  const warningEl = document.getElementById('warningAmount');
  if (warningEl) warningEl.textContent = `₦${Number(amount).toLocaleString('en-NG')}`;
}

export async function handleConfirmPayment() {
  const groupId = sessionStorage.getItem('ajo_pay_groupId');
  const amount = sessionStorage.getItem('ajo_pay_amount');
  const email = localStorage.getItem('ajo_user_email') || '';

  const btn = document.getElementById('confirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; btn.classList.add('opacity-60'); }

  try {
    const data = await initiatePayment({ amount: Number(amount), groupId, email });

    if (data.paymentUrl) {
      // Squad redirects externally — save ref for verify step
      sessionStorage.setItem('ajo_pay_ref', data.transactionRef || '');
      window.location.href = data.paymentUrl;
    } else {
      // Direct success (test/sandbox mode)
      sessionStorage.setItem('ajo_pay_ref', data.transactionRef || 'TEST-REF');
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

  // Show receipt from session (instant)
  setValue('receiptAmount', `₦ ${Number(amount).toLocaleString('en-NG')}`);
  setValue('receiptGroup', groupName);
  setValue('receiptTxId', transactionRef || '—');

  // Verify payment with backend if we have a real ref
  if (transactionRef && transactionRef !== 'TEST-REF') {
    try {
      const data = await verifyPayment({ transactionRef });

      // Update progress bar
      const progressEl = document.getElementById('progressBar');
      const progressLabel = document.getElementById('progressLabel');
      if (progressEl && data.cycleProgress) {
        progressEl.style.width = `${data.cycleProgress}%`;
      }
      if (progressLabel && data.paid && data.total) {
        progressLabel.textContent = `${data.paid}/${data.total} paid`;
      }
    } catch (error) {
      console.error('verifyPayment error:', error.message);
    }
  }

  // Clear payment session data
  ['ajo_pay_groupId', 'ajo_pay_amount', 'ajo_pay_groupName',
   'ajo_pay_method', 'ajo_pay_method_type', 'ajo_pay_ref']
    .forEach(k => sessionStorage.removeItem(k));
}


// ─────────────────────────────────────────────
// SQUAD REDIRECT HANDLER
// Call this on page load if Squad redirects back with a transaction ref
// ─────────────────────────────────────────────

export async function handleSquadRedirect() {
  const params = new URLSearchParams(window.location.search);
  const transactionRef = params.get('transaction_ref') || params.get('ref');

  if (!transactionRef) return;

  sessionStorage.setItem('ajo_pay_ref', transactionRef);

  try {
    await verifyPayment({ transactionRef });
    window.location.href = 'payment-success.html';
  } catch (error) {
    alert('Payment verification failed. Contact support with ref: ' + transactionRef);
    window.location.href = 'dashboard.html';
  }
}


// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
