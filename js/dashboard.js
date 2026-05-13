// ============================================================
//  Smart Ajo — dashboard.js
// ============================================================

import { getMe, getMyGroups, getToken } from "./api.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  const nameEl = document.getElementById("userName");
  const balanceEl = document.getElementById("totalBalance");
  const groupsContainer = document.getElementById("groupsContainer");

  // Verify the token one last time before fetching
  const token = getToken();
  if (!token) {
    console.error("No token found. Redirecting to login...");
    window.location.replace("../index.html");
    return;
  }

  try {
    // 1. Fetch user profile and groups in parallel
    const [userData, groupsData] = await Promise.all([getMe(), getMyGroups()]);

    // 2. Update Greeting
    if (nameEl && userData.full_name) {
      nameEl.textContent = `Hi, ${userData.full_name.split(" ")[0]} 👋`;
    }

    // 3. Update Balance
    if (balanceEl) {
      const targetBalance = userData.total_savings || 0;
      animateBalance(balanceEl, targetBalance);
    }

    // 4. Render the Groups (This replaces the gray bubble)
    renderGroupsList(groupsData, groupsContainer);
  } catch (error) {
    console.error("Dashboard Load Error:", error);
    if (groupsContainer) {
      groupsContainer.innerHTML = `
        <div class="p-6 text-center text-gray-400 text-xs italic">
          Unable to load groups. Please refresh.
        </div>
      `;
    }
  }
}

function renderGroupsList(groups, container) {
  if (!container) return;
  container.innerHTML = ""; // This removes the skeleton loader

  if (!groups || groups.length === 0) {
    container.innerHTML = `
      <div class="p-8 bg-white rounded-[32px] text-center border-2 border-dashed border-gray-100">
        <p class="text-gray-400 text-xs italic">You haven't joined any groups yet.</p>
      </div>
    `;
    return;
  }

  groups.forEach((group) => {
    const groupCard = document.createElement("div");
    groupCard.className =
      "bg-white p-5 rounded-[32px] flex items-center justify-between shadow-sm mb-3 border border-gray-50";
    groupCard.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-xl">
          ${group.emoji || "💰"}
        </div>
        <div>
          <h3 class="font-bold text-gray-900">${group.name}</h3>
          <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            ${group.members_count || 0} Members
          </p>
        </div>
      </div>
      <div class="text-right">
        <p class="font-bold text-gray-900">₦${group.contribution_amount?.toLocaleString()}</p>
        <p class="text-[10px] text-green-500 font-bold uppercase">Active</p>
      </div>
    `;
    container.appendChild(groupCard);
  });
}

function animateBalance(element, endValue) {
  let startValue = 0;
  const duration = 1500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.floor(progress * (endValue - startValue) + startValue);
    element.textContent = `₦${current.toLocaleString()}`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
