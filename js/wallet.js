// ============================================================
//  Smart Ajo — wallet.js
//  Handles wallet page: balance, fund, transactions, cards
// ============================================================

import {
  requireAuth,
  getWallet,
  fundWallet,
  getWalletTransactions,
  getCards,
  deleteCard,
} from './api.js';


export async function initWallet() {
  if (!requireAuth()) return;
  await Promise.all([loadBalance(), loadTransactions(), loadCards()]);
}


// ─────────────────────────────────────────────
// BALANCE
// ─────────────────────────────────────────────

async function loadBalance() {
  try {
    const data = await getWallet();
    const el = document.getElementById('walletBalance');
    if (el) el.textContent = `₦${Number(data.balance ?? 0).toLocaleString('en-NG')}`;
  } catch (e) {
    console.error('getWallet error:', e.message);
  }
}


// ─────────────────────────────────────────────
// FUND WALLET
// ─────────────────────────────────────────────

export async function handleFundWallet() {
  const input = document.getElementById('fundAmount');
  const amount = Number(input?.value);

  if (!amount || amount < 100) {
    alert('Enter a valid amount (minimum ₦100)');
    return;
  }

  const btn = document.getElementById('fundBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; btn.classList.add('opacity-60'); }

  try {
    const data = await fundWallet(amount);
    if (data.transaction_ref) sessionStorage.setItem('ajo_wallet_ref', data.transaction_ref);

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      // Sandbox / instant credit
      alert('Wallet funded successfully!');
      hideFundSheet();
      await Promise.all([loadBalance(), loadTransactions()]);
    }
  } catch (e) {
    alert(e.message || 'Failed to fund wallet. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = 'Fund Wallet'; btn.classList.remove('opacity-60'); }
  }
}


// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────

async function loadTransactions() {
  const container = document.getElementById('txList');
  if (!container) return;

  try {
    const data = await getWalletTransactions();
    const txs = Array.isArray(data) ? data : (data.results || data.transactions || []);

    if (txs.length === 0) {
      container.innerHTML = `<p class="text-xs text-[#9E9E9E] text-center py-6">No transactions yet</p>`;
      return;
    }

    container.innerHTML = txs.map(tx => {
      const isCredit = tx.type === 'credit' || Number(tx.amount) > 0;
      const sign = isCredit ? '+' : '−';
      const amtColor = isCredit ? 'text-[#22C55E]' : 'text-[#EF4444]';
      const iconBg = isCredit ? 'bg-green-50' : 'bg-red-50';
      const iconColor = isCredit ? 'text-[#22C55E]' : 'text-[#EF4444]';
      const iconPath = isCredit
        ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12l7 7 7-7"/>';
      const date = new Date(tx.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      const label = tx.description || (isCredit ? 'Wallet Funded' : 'Contribution Debit');
      const status = tx.status || 'completed';

      return `
        <div class="flex items-center justify-between py-3.5 border-b border-[#F5F5F5] last:border-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}">
              <svg class="w-4 h-4 ${iconColor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${iconPath}</svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-[#1A1A1A] leading-tight">${label}</p>
              <p class="text-xs text-[#9E9E9E]">${date} · <span class="capitalize">${status}</span></p>
            </div>
          </div>
          <span class="text-sm font-bold ${amtColor}">${sign}₦${Math.abs(Number(tx.amount)).toLocaleString('en-NG')}</span>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('getWalletTransactions error:', e.message);
    container.innerHTML = `<p class="text-xs text-red-400 text-center py-4">${e.message}</p>`;
  }
}


// ─────────────────────────────────────────────
// CARDS
// ─────────────────────────────────────────────

async function loadCards() {
  const container = document.getElementById('cardsList');
  if (!container) return;

  try {
    const data = await getCards();
    const cards = Array.isArray(data) ? data : (data.cards || data.results || []);

    if (cards.length === 0) {
      container.innerHTML = `<p class="text-xs text-[#9E9E9E] text-center py-4">No cards linked yet</p>`;
      return;
    }

    container.innerHTML = cards.map(card => `
      <div class="flex items-center justify-between py-3 border-b border-[#F5F5F5] last:border-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-[#1A1A1A]">•••• ${card.last4}</p>
            <p class="text-xs text-[#9E9E9E]">${card.brand || 'Debit'} · Expires ${card.exp_month}/${String(card.exp_year).slice(-2)}</p>
          </div>
        </div>
        <button onclick="window._removeCard('${card.id}')"
          class="text-xs text-[#EF4444] hover:text-red-700 font-semibold transition-colors py-1 px-2 rounded-lg hover:bg-red-50">
          Remove
        </button>
      </div>`).join('');
  } catch (e) {
    console.error('getCards error:', e.message);
    container.innerHTML = `<p class="text-xs text-red-400 text-center py-4">${e.message}</p>`;
  }
}

export async function removeCard(cardId) {
  if (!confirm('Remove this card from your account?')) return;
  try {
    await deleteCard(cardId);
    await loadCards();
  } catch (e) {
    alert(e.message || 'Failed to remove card');
  }
}


// ─────────────────────────────────────────────
// SHEET HELPERS
// ─────────────────────────────────────────────

export function showFundSheet() {
  document.getElementById('fundSheet')?.classList.remove('hidden');
}

export function hideFundSheet() {
  document.getElementById('fundSheet')?.classList.add('hidden');
  const input = document.getElementById('fundAmount');
  if (input) input.value = '';
  const btn = document.getElementById('fundBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Fund Wallet'; btn.classList.remove('opacity-60'); }
}

export function setQuickAmount(amount) {
  const input = document.getElementById('fundAmount');
  if (input) { input.value = amount; input.focus(); }
}
