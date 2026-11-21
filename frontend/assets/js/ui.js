import { api } from './api.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getInitials(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => (part[0] ? part[0].toUpperCase() : ''))
      .join('') || '?'
  );
}

export function renderAvatar(name, size = 'md', tone = 'lavender') {
  return `<div class="avatar avatar-${size} avatar-${tone}" aria-hidden="true">${escapeHtml(
    getInitials(name)
  )}</div>`;
}

export function renderSkeleton(lines = 3) {
  let rows = '';
  for (let i = 0; i < lines; i += 1) {
    const widthStyle = i === lines - 1 ? 'width: 66%' : 'width: 100%';
    rows += `<div class="skeleton-line" style="margin-top: 0.75rem; ${widthStyle};"></div>`;
  }
  return `
    <div class="skeleton-card">
      <div class="skeleton-line" style="width: 34%; height: 20px;"></div>
      ${rows}
    </div>
  `;
}

export function showToast(type, text) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(text)}</span>
    <button type="button" class="btn-icon" style="width: 28px; height: 28px; min-height: 28px;" aria-label="Dismiss">&#10005;</button>
  `;

  const closeBtn = toast.querySelector('button');
  const remove = () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  };
  closeBtn.addEventListener('click', remove);
  root.appendChild(toast);
  setTimeout(remove, 3000);
}

export function openConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div class="modal-card">
        <h3 id="confirm-modal-title" class="modal-title">${escapeHtml(title)}</h3>
        <p class="modal-message">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" id="modal-cancel-btn" class="btn btn-outline-soft">${escapeHtml(cancelLabel)}</button>
          <button type="button" id="modal-confirm-btn" class="btn ${destructive ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    root.innerHTML = '';
  };

  const cancelBtn = document.getElementById('modal-cancel-btn');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '...';
    try {
      await onConfirm();
      close();
    } catch {
      confirmBtn.disabled = false;
      confirmBtn.textContent = confirmLabel;
    }
  });
}

export function renderNavbar(user, activePath = window.location.pathname) {
  const header = document.getElementById('app-header');
  const mobileNav = document.getElementById('mobile-nav');
  if (!header) return;

  const isDashboard = activePath.startsWith('/dashboard');
  const isQuiz = activePath.startsWith('/quiz') || activePath.startsWith('/create-quiz');
  const isProfile = activePath.startsWith('/profile');
  const isLeaderboard = activePath.startsWith('/leaderboard');

  const navHtml = `
    <nav aria-label="Primary navigation" class="nav-links">
      <a href="/dashboard" class="nav-link ${isDashboard ? 'active' : ''}">📊 Dashboard</a>
      <a href="/quiz" class="nav-link ${isQuiz ? 'active' : ''}">✏️ Quiz</a>
      <a href="/profile" class="nav-link ${isProfile ? 'active' : ''}">👤 Profile</a>
      <a href="/leaderboard" class="nav-link ${isLeaderboard ? 'active' : ''}">🏆 Leaderboard</a>
    </nav>
  `;

  const actionHtml = user
    ? `
      <button type="button" id="logout-btn" class="btn btn-sm btn-outline-soft header-logout-btn" aria-label="Logout" title="Logout">
        <span>🚪 Logout</span>
      </button>
    `
    : `
      <a href="/login" class="btn btn-sm btn-primary header-cta-btn">🔑 Login</a>
    `;

  header.innerHTML = `
    <div class="container header-inner">
      <a href="/dashboard" class="brand-wordmark">
        <span class="brand-badge" aria-hidden="true">✨</span>
        <span>Who Knows Me Better?</span>
      </a>
      ${navHtml}
      <div class="header-action">${actionHtml}</div>
    </div>
  `;

  if (user) {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await api.auth.logout();
        } catch {
          // ignore
        }
        window.location.href = '/login';
      });
    }
  }

  if (mobileNav) {
    mobileNav.classList.add('visible');
    mobileNav.innerHTML = `
      <a href="/dashboard" class="mobile-tab ${isDashboard ? 'active' : ''}" aria-label="Dashboard">
        <span class="mobile-tab-icon-wrap">
          <svg class="mobile-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="2"></rect>
            <rect x="14" y="3" width="7" height="7" rx="2"></rect>
            <rect x="14" y="14" width="7" height="7" rx="2"></rect>
            <rect x="3" y="14" width="7" height="7" rx="2"></rect>
          </svg>
        </span>
        <span class="mobile-tab-label">Dashboard</span>
      </a>
      <a href="/quiz" class="mobile-tab mobile-tab-accent ${isQuiz ? 'active' : ''}" aria-label="Quiz">
        <span class="mobile-tab-icon-wrap">
          <svg class="mobile-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </span>
        <span class="mobile-tab-label">Quiz</span>
      </a>
      <a href="/profile" class="mobile-tab ${isProfile ? 'active' : ''}" aria-label="Profile">
        <span class="mobile-tab-icon-wrap">
          <svg class="mobile-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </span>
        <span class="mobile-tab-label">Profile</span>
      </a>
      <a href="/leaderboard" class="mobile-tab ${isLeaderboard ? 'active' : ''}" aria-label="Leaderboard">
        <span class="mobile-tab-icon-wrap">
          <svg class="mobile-tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2"></path>
            <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"></path>
            <path d="M4 3h16v6a8 8 0 0 1-16 0V3Z"></path>
            <path d="M12 17v4"></path>
            <path d="M8 21h8"></path>
          </svg>
        </span>
        <span class="mobile-tab-label">Ranks</span>
      </a>
    `;
  }
}

export async function getCurrentUser() {
  try {
    const res = await api.auth.me();
    return res.user || null;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectTarget = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
    return null;
  }
  return user;
}

export async function copyToClipboard(text, successMsg = 'Copied! ✅') {
  try {
    await navigator.clipboard.writeText(text);
    showToast('success', successMsg);
    return true;
  } catch {
    showToast('error', 'Could not copy.');
    return false;
  }
}

export async function shareUrl({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // User cancelled
    }
  }
  await copyToClipboard(`${text ? text + ' ' : ''}${url}`, 'Link copied! 📋');
}

export function getRouteSegment(indexFromStart) {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[indexFromStart] ? decodeURIComponent(parts[indexFromStart]) : '';
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
