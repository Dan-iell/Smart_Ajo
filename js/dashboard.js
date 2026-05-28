// ============================================================
//  Smart Ajo — dashboard.js  (fixed + AI risk alerts added)
// ============================================================

import { getMe, getMyGroups, getToken } from "./api.js";

const BASE_URL = "https://smart-ajo.onrender.com";

document.addEventListener("DOMContentLoaded", initDashboard);

// ─── Module-level helpers ────────────────────────────────────

async function fetchWallet() {
  try {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/wallet/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("fetchWallet failed:", err);
    return null;
  }
}

async function fetchNotifications(token) {
  try {
    const res = await fetch(`${BASE_URL}/api/notifications/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("fetchNotifications failed:", err);
    return null;
  }
}

// ─── AI Risk helpers ─────────────────────────────────────────

/**
 * Derives a simple risk level from a group's payment data.
 * Replace this logic with a real API call when your backend exposes one.
 *
 * @param {Object} group  - group object from getMyGroups()
 * @returns {'low'|'medium'|'high'}
 */
function deriveRiskLevel(group) {
  const missed  = group.missed_payments  ?? 0;
  const late    = group.late_payments    ?? 0;

  // If backend already sends a risk_level field, use it directly
  if (group.risk_level) return group.risk_level;

  if (missed >= 2 || late >= 3) return "high";
  if (missed === 1 || late >= 1) return "medium";
  return "low";
}

const RISK_CONFIG = {
  low:    { label: "Low Risk",    emoji: "✅", classes: "bg-green-50 text-green-700 border-green-200" },
  medium: { label: "Medium Risk", emoji: "⚠️", classes: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  high:   { label: "High Risk",   emoji: "🚨", classes: "bg-red-50 text-red-700 border-red-200" },
};

// ─── Render helpers ──────────────────────────────────────────

function animateBalance(element, endValue) {
  let startValue = 0;
  const duration = 1500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed  = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current  = Math.floor(progress * (endValue - startValue) + startValue);
    element.textContent = `₦${current.toLocaleString()}`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderRiskAlerts(groups, container) {
  if (!container) return;

  const riskGroups = groups
    .map((g) => ({ ...g, riskLevel: deriveRiskLevel(g) }))
    .filter((g) => g.riskLevel !== "low");

  if (!riskGroups.length) {
    container.innerHTML = `
      <div class="p-3 bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] text-xs text-[#15803D] font-medium">
        ✅ All groups are healthy — no risk alerts right now.
      </div>`;
    return;
  }

  container.innerHTML = riskGroups
    .map((g) => {
      const cfg = RISK_CONFIG[g.riskLevel];
      return `
        <div class="flex items-center gap-3 p-3 rounded-xl border text-xs ${cfg.classes}">
          <span class="text-base leading-none">${cfg.emoji}</span>
          <div>
            <span class="font-bold">${g.name}</span>
            &nbsp;·&nbsp;${cfg.label}
            ${g.missed_payments ? `<span class="ml-1">(${g.missed_payments} missed payment${g.missed_payments > 1 ? "s" : ""})</span>` : ""}
          </div>
        </div>`;
    })
    .join("");
}

function renderGroupsList(groups, container) {
  if (!container) return;
  container.innerHTML = "";

  const groupsList = Array.isArray(groups) ? groups : groups.results ?? [];

  if (!groupsList.length) {
    container.innerHTML = `
      <div class="p-8 bg-white rounded-2xl text-center border border-dashed border-[#E0E0E0]">
        <p class="text-xs text-[#9E9E9E] mb-3">You haven't joined any groups yet.</p>
        <a href="groups.html" class="text-xs font-bold text-[#1B5E3B]">Discover Groups →</a>
      </div>`;
    return;
  }

  container.innerHTML = groupsList
    .map((group) => {
      const initials = (group.name || "?")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      const round    = group.current_round  ?? 0;
      const maxRound = group.max_members    ?? 1;
      const progress = Math.round((round / maxRound) * 100);
      const risk     = deriveRiskLevel(group);
      const riskCfg  = RISK_CONFIG[risk];

      const statusClasses =
        group.status === "active" ? "bg-[#F0FDF4] text-[#16A34A]" :
        group.status === "open"   ? "bg-[#EFF6FF] text-[#2563EB]" :
                                    "bg-[#F5F5F5] text-[#9E9E9E]";

      return `
        <div
          onclick="window.location.href='group-detail.html?id=${group.id}'"
          class="bg-white rounded-2xl p-4 border border-[#F0F0F0] cursor-pointer active:scale-[0.98] transition-all"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 bg-[#1B5E3B] rounded-full flex items-center justify-center shrink-0">
                <span class="text-white text-xs font-bold">${initials}</span>
              </div>
              <div>
                <p class="text-sm font-bold text-[#1A1A1A]">${group.name}</p>
                <p class="text-xs text-[#9E9E9E]">
                  ₦${Number(group.contribution_amount).toLocaleString()} · ${group.total_members ?? 0} members
                </p>
              </div>
            </div>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${statusClasses} capitalize">
              ${group.status}
            </span>
          </div>

          <div class="w-full h-1.5 bg-[#E0E0E0] rounded-full mb-2 overflow-hidden">
            <div class="h-full bg-[#1B5E3B] transition-all duration-700" style="width:${progress}%"></div>
          </div>

          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] text-[#9E9E9E]">Round ${round} of ${maxRound}</span>
            <span class="text-[10px] font-bold text-[#1B5E3B]">
              Pool: ₦${Number(group.pool_amount ?? 0).toLocaleString()}
            </span>
          </div>

          ${risk !== "low" ? `
          <div class="text-[10px] font-medium px-2 py-1 rounded-lg ${riskCfg.classes} border inline-block">
            ${riskCfg.emoji} ${riskCfg.label}
          </div>` : ""}
        </div>`;
    })
    .join("");
}

// ─── Main init ───────────────────────────────────────────────

async function initDashboard() {
  const nameEl          = document.getElementById("userName");
  const balanceEl       = document.getElementById("totalBalance");
  const groupsContainer = document.getElementById("groupsContainer");
  const riskContainer   = document.getElementById("riskAlertsContainer"); // new element

  const token = getToken();
  if (!token) {
    console.error("No token found. Redirecting to login...");
    window.location.replace("../index.html");
    return;
  }

  // ── 1. Fetch all data in parallel ──────────────────────────
  let userData, groupsData, walletData;
  try {
    [userData, groupsData, walletData] = await Promise.all([
      getMe(),
      getMyGroups(),
      fetchWallet(),
    ]);
  } catch (err) {
    console.error("Dashboard load error:", err);
    if (groupsContainer) {
      groupsContainer.innerHTML = `
        <div class="p-6 text-center text-gray-400 text-xs italic">
          Unable to load groups. Please refresh.
        </div>`;
    }
    return; // stop early — nothing else to render
  }

  // ── 2. Greeting ────────────────────────────────────────────
  if (nameEl && userData?.full_name) {
    nameEl.textContent = `Hi, ${userData.full_name.split(" ")[0]} 👋`;
  }

  // ── 3. Balance ─────────────────────────────────────────────
  if (balanceEl) {
    animateBalance(balanceEl, walletData?.balance ?? 0);
  }

  // ── 4. Groups list ─────────────────────────────────────────
  const groupsList = Array.isArray(groupsData)
    ? groupsData
    : groupsData?.results ?? [];

  renderGroupsList(groupsList, groupsContainer);

  // ── 5. AI Risk alerts ──────────────────────────────────────
  renderRiskAlerts(groupsList, riskContainer);

  // ── 6. Notification badge (isolated — won't crash the page) ─
  const notifData = await fetchNotifications(token);
  if (notifData?.unread_count > 0) {
    document.getElementById("notificationBadge")?.classList.remove("hidden");
    document.getElementById("navAlertBadge")?.classList.remove("hidden");
  }
}
