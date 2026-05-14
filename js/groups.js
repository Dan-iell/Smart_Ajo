// ============================================================
//  Smart Ajo — groups.js
//  Handles groups list, discover search, and group detail tabs.
//  Import this in: groups.html and group-detail.html
// ============================================================

import {
  requireAuth,
  getMyGroups,
  discoverGroups,
  getGroupById,
  getGroupMembers,
  getCycleContributions,
  getNextPayout,
  getGroupHealthScore,
  createGroup,
  joinGroup,
  getGroupInviteLink
} from './api.js';


// ─────────────────────────────────────────────
// GROUPS LIST PAGE — groups.html
// ─────────────────────────────────────────────

export async function initGroupsPage() {
  if (!requireAuth()) return;
  await loadMyGroups();
}

async function loadMyGroups() {
  const listEl = document.getElementById('myGroupsList');
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-6">Loading groups...</p>`;

  try {
    const data = await getMyGroups();
    const groups = data.groups || [];

    if (groups.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-10">
          <p class="text-sm text-[#9E9E9E] mb-2">You haven't joined any groups yet.</p>
          <button onclick="switchTab('discover')" class="text-sm font-semibold text-[#3A3A3A] underline">Discover Groups</button>
        </div>`;
      return;
    }

    listEl.innerHTML = groups.map(group => {
      const riskBadge = getRiskBadge(group.riskLevel);
      const dueLabel = getDueLabel(group.nextDueDate);
      const dueColor = getDueColor(group.nextDueDate);
      const progress = group.cycleProgress || 0;
      const initials = getInitials(group.name);

      return `
        <div class="bg-white rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
             onclick="window.location.href='group-detail.html?id=${group.id}'">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-[#3A3A3A] rounded-xl flex items-center justify-center shrink-0">
              <span class="text-white font-bold text-xs">${initials}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#1A1A1A]">${group.name}</p>
              <p class="text-xs text-[#9E9E9E]">₦${group.contributionAmount?.toLocaleString('en-NG')}/mo</p>
            </div>
            ${riskBadge}
          </div>
          <div class="flex items-center justify-between text-xs text-[#9E9E9E] mb-1.5">
            <span>Monthly contribution</span>
            <span class="font-bold text-[#1A1A1A] text-sm">₦ ${group.contributionAmount?.toLocaleString('en-NG')}</span>
          </div>
          <div class="h-1 bg-[#E0E0E0] rounded-full mb-1.5 overflow-hidden">
            <div class="h-full bg-[#3A3A3A] rounded-full" style="width:${progress}%"></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[#9E9E9E]">Cycle ${progress}% complete</span>
            <span class="${dueColor} font-semibold">${dueLabel}</span>
          </div>
        </div>`;
    }).join('');

  } catch (error) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-6">Failed to load groups. Try again.</p>`;
    console.error('loadMyGroups error:', error.message);
  }
}


// ─────────────────────────────────────────────
// DISCOVER TAB — Search public groups
// ─────────────────────────────────────────────

export async function handleDiscoverSearch(query) {
  const resultsEl = document.getElementById('discoverResults');
  const emptyEl = document.getElementById('discoverEmpty');
  if (!resultsEl) return;

  if (!query || query.trim().length < 2) {
    resultsEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  resultsEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-4">Searching...</p>`;

  try {
    const data = await discoverGroups(query.trim());
    const groups = data.groups || [];

    if (groups.length === 0) {
      resultsEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-6">No groups found for "${query}"</p>`;
      return;
    }

    resultsEl.innerHTML = groups.map(group => {
      const riskBadge = getRiskBadge(group.riskLevel);
      const initials = getInitials(group.name);
      return `
        <div class="bg-white rounded-2xl px-4 py-4 flex items-center gap-3">
          <div class="w-10 h-10 bg-[#3A3A3A] rounded-xl flex items-center justify-center shrink-0">
            <span class="text-white font-bold text-xs">${initials}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-[#1A1A1A]">${group.name}</p>
            <p class="text-xs text-[#9E9E9E]">₦${group.contributionAmount?.toLocaleString('en-NG')}/mo · ${group.memberCount} members</p>
          </div>
          ${riskBadge}
          <button onclick="handleJoinGroup('${group.inviteCode}')"
            class="text-xs font-semibold bg-[#3A3A3A] text-white px-3 py-1.5 rounded-full hover:bg-black transition-colors shrink-0">
            Join
          </button>
        </div>`;
    }).join('');

  } catch (error) {
    resultsEl.innerHTML = `<p class="text-sm text-red-400 text-center py-4">Search failed. Try again.</p>`;
  }
}

export async function handleJoinGroup(inviteCode) {
  try {
    await joinGroup(inviteCode);
    alert('You have joined the group!');
    window.location.reload();
  } catch (error) {
    alert(error.message || 'Failed to join group.');
  }
}


// ─────────────────────────────────────────────
// GROUP DETAIL PAGE — group-detail.html
// ─────────────────────────────────────────────

export async function initGroupDetail() {
  if (!requireAuth()) return;

  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('id');
  if (!groupId) { window.location.href = 'groups.html'; return; }

  // Store groupId for tab switching
  window._currentGroupId = groupId;

  await loadGroupOverview(groupId);
}

async function loadGroupOverview(groupId) {
  try {
    const [groupData, healthData, payoutData] = await Promise.all([
      getGroupById(groupId),
      getGroupHealthScore(groupId),
      getNextPayout(groupId)
    ]);

    const group = groupData.group || {};

    // Page title
    const titleEl = document.getElementById('groupName');
    if (titleEl) titleEl.textContent = group.name;

    // Pool circle
    const poolEl = document.getElementById('currentPool');
    const targetEl = document.getElementById('targetPool');
    const progressEl = document.getElementById('poolProgress');
    const percentEl = document.getElementById('poolPercent');

    if (poolEl) poolEl.textContent = `₦${group.currentPool?.toLocaleString('en-NG')}`;
    if (targetEl) targetEl.textContent = `₦${group.totalPool?.toLocaleString('en-NG')}`;

    const pct = Math.round((group.currentPool / group.totalPool) * 100) || 0;
    if (percentEl) percentEl.textContent = `${pct}% Complete`;
    if (progressEl) {
      const circumference = 314;
      progressEl.style.strokeDashoffset = circumference - (circumference * pct / 100);
    }

    // Next payout
    const nextRecipientEl = document.getElementById('nextRecipient');
    const nextAmountEl = document.getElementById('nextPayoutAmount');
    const nextDueEl = document.getElementById('nextPayoutDue');
    if (nextRecipientEl && payoutData?.next) {
      nextRecipientEl.textContent = payoutData.next.userName;
      if (nextAmountEl) nextAmountEl.textContent = `₦${payoutData.next.amount?.toLocaleString('en-NG')}`;
      if (nextDueEl) nextDueEl.textContent = `Cycle ${payoutData.next.cycle} · Due ${formatDate(payoutData.next.dueDate)}`;
    }

    // Summary table
    const summaryMap = {
      'summaryPool': `₦${group.totalPool?.toLocaleString('en-NG')}`,
      'summaryContribution': `₦${group.contributionAmount?.toLocaleString('en-NG')}`,
      'summaryMembers': group.memberCount,
      'summaryRotation': group.rotationMethod,
      'summaryCycles': `${group.cyclesCompleted}/${group.totalCycles}`
    };
    Object.entries(summaryMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    // AI Health
    const healthEl = document.getElementById('groupHealth');
    if (healthEl && healthData) {
      const isGood = healthData.score >= 80;
      healthEl.className = `rounded-2xl p-4 flex items-start gap-3 ${isGood ? 'bg-[#F0FDF4] border border-[#BBF7D0]' : 'bg-[#FFF1F0] border border-[#FECACA]'}`;
      healthEl.innerHTML = `
        <div class="w-8 h-8 ${isGood ? 'bg-[#22C55E]' : 'bg-[#EF4444]'} rounded-full flex items-center justify-center shrink-0 mt-0.5">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            ${isGood ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>' : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/>'}
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold ${isGood ? 'text-[#166534]' : 'text-[#991B1B]'}">Group Health: ${healthData.label}</p>
          <p class="text-xs ${isGood ? 'text-[#16A34A]' : 'text-[#DC2626]'} mt-0.5 leading-relaxed">${healthData.score}% reliability score. ${healthData.details || ''}</p>
        </div>`;
    }

  } catch (error) {
    console.error('loadGroupOverview error:', error.message);
  }
}

export async function loadGroupMembers(groupId) {
  const listEl = document.getElementById('membersList');
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-4">Loading members...</p>`;

  try {
    const data = await getGroupMembers(groupId);
    const members = data.members || [];

    listEl.innerHTML = members.map(member => `
      <div class="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3">
        <div class="w-9 h-9 bg-[#B0B5AC] rounded-full flex items-center justify-center shrink-0 overflow-hidden">
          ${member.avatarUrl
            ? `<img src="${member.avatarUrl}" class="w-full h-full object-cover"/>`
            : `<span class="text-white text-xs font-bold">${getInitials(member.name)}</span>`}
        </div>
        <p class="flex-1 text-sm font-medium text-[#1A1A1A]">${member.name}</p>
        ${getRiskBadge(member.riskLevel)}
      </div>`
    ).join('');

  } catch (error) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-4">Failed to load members.</p>`;
  }
}

export async function loadGroupContributions(groupId) {
  const listEl = document.getElementById('contributionsList');
  const cycleEl = document.getElementById('currentCycle');
  if (!listEl) return;

  listEl.innerHTML = `<p class="text-sm text-[#9E9E9E] text-center py-4">Loading contributions...</p>`;

  try {
    const data = await getCycleContributions(groupId, 'current');
    const contributions = data.contributions || [];
    const cycle = data.cycleNumber || '—';

    if (cycleEl) cycleEl.textContent = `Cycle ${cycle}`;

    listEl.innerHTML = contributions.map(c => {
      const statusHTML = getContributionStatus(c.status);
      return `
        <div class="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <div class="w-9 h-9 bg-[#B0B5AC] rounded-full shrink-0"></div>
          <p class="flex-1 text-sm font-medium text-[#1A1A1A]">${c.userName}</p>
          ${statusHTML}
        </div>`;
    }).join('');

  } catch (error) {
    listEl.innerHTML = `<p class="text-sm text-red-400 text-center py-4">Failed to load contributions.</p>`;
  }
}

// Tab switcher for group detail
export async function switchGroupTab(tab) {
  ['overview', 'members', 'contributions'].forEach(t => {
    const btn = document.getElementById('tab-' + t);
    const content = document.getElementById('content-' + t);
    const isActive = t === tab;
    if (btn) btn.className = 'flex-1 py-3 text-sm transition-all border-b-2 ' +
      (isActive ? 'font-semibold text-[#1A1A1A] border-[#3A3A3A]' : 'font-medium text-[#9E9E9E] border-transparent');
    if (content) {
      content.classList.toggle('active', isActive);
      content.style.display = isActive ? 'block' : 'none';
    }
  });

  const groupId = window._currentGroupId;
  if (!groupId) return;

  if (tab === 'members') await loadGroupMembers(groupId);
  if (tab === 'contributions') await loadGroupContributions(groupId);
}


// ─────────────────────────────────────────────
// CREATE GROUP — create-group.html flow
// ─────────────────────────────────────────────

export async function handleCreateGroup() {
  const name = localStorage.getItem('ajo_group_name');
  const description = localStorage.getItem('ajo_group_desc');
  const contributionAmount = localStorage.getItem('ajo_group_amount');
  const frequency = localStorage.getItem('ajo_group_freq');
  const maxMembers = localStorage.getItem('ajo_group_max');
  const rotationMethod = localStorage.getItem('ajo_group_rotation');

  try {
    const data = await createGroup({ name, description, contributionAmount: Number(contributionAmount), frequency, maxMembers: Number(maxMembers), rotationMethod });

    // Get invite link and show on success screen
    const groupId = data.group?.id || data.id;
    if (groupId) {
      localStorage.setItem('ajo_new_group_id', groupId);
      localStorage.setItem('ajo_new_group_name', name);
      try {
        const linkData = await getGroupInviteLink(groupId);
        // Backend may return invite_link (snake) or inviteLink (camel) or link
        const link = linkData.invite_link || linkData.inviteLink || linkData.link || '';
        localStorage.setItem('ajo_new_group_link', link);
      } catch {
        // Endpoint not implemented yet — group-created.html will build a fallback URL
        localStorage.setItem('ajo_new_group_link', '');
      }
    }

    // Clear temp storage
    ['ajo_group_name','ajo_group_desc','ajo_group_amount','ajo_group_freq','ajo_group_max','ajo_group_rotation']
      .forEach(k => localStorage.removeItem(k));

    window.location.href = 'group-created.html';
  } catch (error) {
    alert(error.message || 'Failed to create group. Try again.');
  }
}

// Save step data to localStorage as user moves through steps
export function saveGroupStep1() {
  const name = document.getElementById('groupName')?.value?.trim();
  const description = document.getElementById('groupDescription')?.value?.trim();
  if (!name) { alert('Please enter a group name.'); return; }
  localStorage.setItem('ajo_group_name', name);
  localStorage.setItem('ajo_group_desc', description);
  window.location.href = 'create-group-2.html';
}

export function saveGroupStep2() {
  const amount = document.getElementById('amount')?.value;
  const freq = document.querySelector('.freq-active')?.dataset?.freq || 'monthly';
  const maxMembers = document.getElementById('maxMembers')?.value;
  if (!amount || !maxMembers) { alert('Please fill in all fields.'); return; }
  localStorage.setItem('ajo_group_amount', amount);
  localStorage.setItem('ajo_group_freq', freq);
  localStorage.setItem('ajo_group_max', maxMembers);
  window.location.href = 'create-group-3.html';
}

export function saveGroupStep3() {
  const selected = document.querySelector('.option-card.selected');
  const rotation = selected?.dataset?.rotation || 'random';
  localStorage.setItem('ajo_group_rotation', rotation);
  handleCreateGroup();
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getRiskBadge(level = '') {
  const map = {
    'LOW':    'bg-[#F0FDF4] text-[#16A34A]',
    'MEDIUM': 'bg-[#FFF7ED] text-[#EA580C]',
    'HIGH':   'bg-[#FFF1F0] text-[#EF4444]',
  };
  const label = level === 'LOW' ? 'Low Risk' : level === 'MEDIUM' ? 'Medium Risk' : level === 'HIGH' ? 'High Risk' : level;
  const colors = map[level?.toUpperCase()] || 'bg-[#F0F0F0] text-[#9E9E9E]';
  return `<span class="text-xs ${colors} font-semibold px-2.5 py-1 rounded-full shrink-0">${label}</span>`;
}

function getContributionStatus(status = '') {
  if (status === 'PAID') return `<div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#22C55E]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg><span class="text-xs text-[#22C55E] font-semibold">Paid</span></div>`;
  if (status === 'MISSED') return `<div class="flex items-center gap-1.5"><svg class="w-4 h-4 text-[#EF4444]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg><span class="text-xs text-[#EF4444] font-semibold">Missed</span></div>`;
  return `<span class="text-xs bg-[#FFF8E7] text-[#F5A623] font-semibold px-2.5 py-1 rounded-full">Pending</span>`;
}

function getDueLabel(dueDateStr) {
  if (!dueDateStr) return 'No due date';
  const due = new Date(dueDateStr);
  const diffDays = Math.ceil((due - new Date()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due Today';
  if (diffDays === 1) return 'Due Tomorrow';
  return `Due in ${diffDays} days`;
}

function getDueColor(dueDateStr) {
  if (!dueDateStr) return 'text-[#9E9E9E]';
  const due = new Date(dueDateStr);
  const diffDays = Math.ceil((due - new Date()) / 86400000);
  if (diffDays <= 1) return 'text-[#F5A623]';
  if (diffDays <= 3) return 'text-[#EF4444]';
  return 'text-[#22C55E]';
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-NG', { month: 'long', day: 'numeric' });
}
