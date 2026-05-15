// ============================================================
//  Smart Ajo — payment.js
// ============================================================

import {
  requireAuth,
  getMyGroups,
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getRoundSummary,
  getGroupDetail, // Ensure this is in your api.js
} from "./api.js";

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
    const groups = Array.isArray(data)
      ? data
      : data.groups || data.results || [];

    const selector = document.getElementById("groupSelector");
    const amountEl = document.getElementById("contributionAmount");
    const groupLabel = document.getElementById("groupLabel");

    if (!selector || groups.length === 0) {
      if (amountEl) amountEl.textContent = "₦0";
      if (groupLabel) groupLabel.textContent = "No groups";
      return;
    }

    selector.innerHTML = groups
      .map((g) => {
        const amount = g.contribution_amount ?? g.contributionAmount ?? 0;
        return `<option value="${g.id}" data-amount="${amount}">${g.name}</option>`;
      })
      .join("");

    const first = groups[0];
    const firstAmount =
      first.contribution_amount ?? first.contributionAmount ?? 0;

    if (amountEl)
      amountEl.textContent = `₦${Number(firstAmount).toLocaleString("en-NG")}`;
    if (groupLabel) groupLabel.textContent = first.name;
    setValue(
      "summaryAmount",
      `₦ ${Number(firstAmount).toLocaleString("en-NG")}`,
    );
    updateCycleDue(first);

    sessionStorage.setItem("ajo_pay_groupId", first.id);
    sessionStorage.setItem("ajo_pay_amount", firstAmount);
    sessionStorage.setItem("ajo_pay_groupName", first.name);

    updatePayButton(firstAmount);

    selector.addEventListener("change", () => {
      const opt = selector.options[selector.selectedIndex];
      const amount = opt.dataset.amount;
      const name = opt.text;
      const idx = selector.selectedIndex;
      if (amountEl)
        amountEl.textContent = `₦${Number(amount).toLocaleString("en-NG")}`;
      if (groupLabel) groupLabel.textContent = name;
      setValue("summaryAmount", `₦ ${Number(amount).toLocaleString("en-NG")}`);
      updateCycleDue(groups[idx]);
      sessionStorage.setItem("ajo_pay_groupId", opt.value);
      sessionStorage.setItem("ajo_pay_amount", amount);
      sessionStorage.setItem("ajo_pay_groupName", name);
      updatePayButton(amount);
    });
  } catch (error) {
    console.error("loadGroupSelector error:", error.message);
  }
}

function updatePayButton(amount) {
  const btn = document.getElementById("payBtn");
  if (btn)
    btn.textContent = `Pay ₦${Number(amount).toLocaleString("en-NG")} with Squad`;
}

function updateCycleDue(group) {
  if (!group) return;
  const current = group.current_round ?? group.round_number ?? null;
  const total =
    group.total_rounds ?? group.members_count ?? group.member_count ?? null;
  setValue(
    "cycleDisplay",
    current != null && total != null ? `Round ${current} of ${total}` : "—",
  );

  const raw = group.next_due_date ?? group.due_date ?? null;
  if (raw) {
    const date = new Date(raw);
    const today = new Date();
    const diffDays = Math.round((date - today) / 86400000);
    const label =
      diffDays === 0
        ? "Today"
        : diffDays === 1
          ? "Tomorrow"
          : diffDays < 0
            ? "Overdue"
            : date.toLocaleDateString("en-NG", {
                month: "short",
                day: "numeric",
              });
    setValue("dueDateDisplay", label);
  } else {
    setValue("dueDateDisplay", "—");
  }
}

export function proceedToConfirm() {
  const groupId = sessionStorage.getItem("ajo_pay_groupId");
  const amount = sessionStorage.getItem("ajo_pay_amount");
  if (!groupId || !amount) {
    alert("Please select a group.");
    return;
  }
  // Passing groupId in URL is the most reliable way to ensure the next page gets it
  window.location.href = `confirm-payment.html?groupId=${groupId}`;
}

// ─────────────────────────────────────────────
// CONFIRM PAYMENT PAGE — confirm-payment.html
// ─────────────────────────────────────────────

export async function initConfirmPayment(groupId) {
  if (!requireAuth()) return;

  // Use groupId from URL if provided, otherwise fallback to session
  const id = groupId || sessionStorage.getItem("ajo_pay_groupId");

  if (!id) {
    console.error("No Group ID found for confirmation");
    return;
  }

  try {
    const group = await getGroupDetail(id);
    const amount = group.contribution_amount;

    setValue("confirmAmount", `₦ ${Number(amount).toLocaleString("en-NG")}`);
    setValue("confirmGroup", group.name);
    setValue("confirmCycle", group.frequency || "Active Cycle");
    setValue(
      "confirmDate",
      new Date().toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
    setValue("warningAmount", `₦${Number(amount).toLocaleString("en-NG")}`);

    // Sync session for the final payment call
    sessionStorage.setItem("ajo_pay_groupId", group.id);
    sessionStorage.setItem("ajo_pay_amount", amount);
  } catch (error) {
    console.error("Error initializing confirmation UI:", error);
  }
}

export async function handleConfirmPayment() {
  const groupId = sessionStorage.getItem("ajo_pay_groupId");
  const btn = document.getElementById("confirmBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    const data = await initiatePayment(groupId);
    sessionStorage.setItem("ajo_pay_ref", data.transaction_ref || "");
    const checkoutUrl = data.checkout_url || data.paymentUrl;
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      window.location.href = "payment-success.html";
    }
  } catch (error) {
    alert(error.message || "Payment failed.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Confirm & Pay Now";
    }
  }
}

// ─────────────────────────────────────────────
// PAYMENT SUCCESS & REDIRECT LOGIC
// ─────────────────────────────────────────────

export async function initPaymentSuccess() {
  if (!requireAuth()) return;
  const transactionRef = sessionStorage.getItem("ajo_pay_ref");
  const amount = sessionStorage.getItem("ajo_pay_amount");
  const groupName = sessionStorage.getItem("ajo_pay_groupName");
  const groupId = sessionStorage.getItem("ajo_pay_groupId");

  setValue("receiptAmount", `₦ ${Number(amount).toLocaleString("en-NG")}`);
  setValue("receiptGroup", groupName);
  setValue("receiptTxId", transactionRef || "—");

  if (groupId) {
    try {
      const summary = await getRoundSummary(groupId);
      const progressEl = document.getElementById("progressBar");
      const progressLabel = document.getElementById("progressLabel");
      const paid = summary.paid_count ?? summary.paid ?? 0;
      const total = summary.total_members ?? summary.total ?? 1;

      if (progressEl)
        progressEl.style.width = `${Math.round((paid / total) * 100)}%`;
      if (progressLabel) progressLabel.textContent = `${paid}/${total} paid`;
    } catch (e) {
      console.error(e);
    }
  }

  [
    "ajo_pay_groupId",
    "ajo_pay_amount",
    "ajo_pay_groupName",
    "ajo_pay_ref",
  ].forEach((k) => sessionStorage.removeItem(k));
}

export async function handleSquadRedirect() {
  const params = new URLSearchParams(window.location.search);
  const transactionRef = params.get("transaction_ref") || params.get("ref");
  if (!transactionRef) return false;
  sessionStorage.setItem("ajo_pay_ref", transactionRef);
  history.replaceState({}, "", window.location.pathname);
  try {
    await verifyPayment({ transactionRef });
  } catch (e) {
    console.error(e);
  }
  return true;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
