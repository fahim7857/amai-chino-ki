import { api } from './api.js';
import {
  copyToClipboard,
  escapeHtml,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
  requireSession,
  shareUrl,
  showToast,
} from './ui.js';

async function initDashboard() {
  const user = await requireSession();
  if (!user) return;
  renderNavbar(user, '/dashboard');

  const root = document.getElementById('dashboard-root');
  root.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      ${renderSkeleton(2)}
      <div class="stats-strip">${renderSkeleton(2)}${renderSkeleton(2)}${renderSkeleton(2)}</div>
      ${renderSkeleton(3)}
    </div>
  `;

  try {
    const data = await api.public.getDashboardStats();
    const primaryQuiz = data.primaryQuiz;
    const quizPath = primaryQuiz ? `/quiz/${primaryQuiz.slug}` : `/quiz/${user.username}`;
    const fullQuizUrl = `${window.location.origin}${quizPath}`;
    const firstName = user.name.split(' ')[0];

    const statusBadge = primaryQuiz
      ? primaryQuiz.status === 'published'
        ? '<span style="color: #137333; font-weight: 700;">Live ✅</span>'
        : '<span style="color: #B06000; font-weight: 700;">Draft 📝</span>'
      : '<span style="color: var(--text-muted);">Not Created</span>';

    const bestFriendHtml = data.bestFriend
      ? `
        <div class="best-friend-body">
          ${renderAvatar(data.bestFriend.participantName, 'lg', 'cream', data.bestFriend.participantAvatarUrl)}
          <div style="min-width: 0;">
            <h2 class="truncate" style="font-size: 1.15rem; font-weight: 800;">${escapeHtml(
              data.bestFriend.participantName
            )}</h2>
            <p class="meta-line">@${escapeHtml(data.bestFriend.participantUsername)}</p>
            <p class="best-friend-score tabular-nums">${data.bestFriend.matchPercentage}% match</p>
          </div>
        </div>
      `
      : `
        <div style="margin-top: 0.85rem;">
          <p style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">No players yet</p>
          <p style="margin-top: 0.25rem; font-size: 0.8rem; color: var(--text-muted);">
            Share your quiz to see your top friend!
          </p>
        </div>
      `;

    const recentHtml =
      data.recentParticipants.length > 0
        ? `<div class="list-divide">${data.recentParticipants
            .map(
              (p) => `
              <div class="list-row">
                <div class="list-row-left">
                  ${renderAvatar(p.participantName, 'sm', 'mint', p.participantAvatarUrl)}
                  <div style="min-width: 0;">
                    <p class="truncate" style="font-size: 0.85rem; font-weight: 700;">${escapeHtml(
                      p.participantName
                    )}</p>
                    <p class="truncate meta-line">@${escapeHtml(p.participantUsername)}</p>
                  </div>
                </div>
                <span class="tabular-nums" style="font-size: 0.95rem; font-weight: 800; color: var(--primary-lilac);">${
                  p.matchPercentage
                }%</span>
              </div>
            `
            )
            .join('')}</div>`
        : `
          <div class="empty-state">
            <p class="empty-state-title">No players yet</p>
          </div>
        `;

    const leaderboardPreviewHtml =
      data.leaderboardPreview.length > 0
        ? `<div class="list-divide">${data.leaderboardPreview
            .map((entry) => {
              const rankClass =
                entry.rank === 1
                  ? 'rank-1'
                  : entry.rank === 2
                    ? 'rank-2'
                    : entry.rank === 3
                      ? 'rank-3'
                      : 'rank-other';
              return `
                <div class="list-row">
                  <div class="list-row-left">
                    <span class="rank-badge ${rankClass} tabular-nums">${entry.rank}</span>
                    <div style="min-width: 0;">
                      <p class="truncate" style="font-size: 0.85rem; font-weight: 700;">${escapeHtml(
                        entry.participantName
                      )}</p>
                      <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)}</p>
                    </div>
                  </div>
                  <span class="tabular-nums" style="font-size: 0.95rem; font-weight: 800;">${
                    entry.matchPercentage
                  }%</span>
                </div>
              `;
            })
            .join('')}</div>`
        : `
          <div class="empty-state">
            <p class="empty-state-title">Leaderboard empty</p>
          </div>
        `;

    root.innerHTML = `
      <!-- Search Any User's Exam -->
      <section class="search-user-card">
        <div class="search-user-header">
          <span class="search-user-icon">🔍</span>
          <h2 class="search-user-title">Play Friend's Exam</h2>
        </div>
        <form id="search-quiz-form" class="search-user-form">
          <div class="input-prefix-wrap search-input-wrap">
            <span class="input-prefix">@</span>
            <input
              id="search-username-input"
              type="text"
              placeholder="Username (e.g. fahim)"
              autocomplete="off"
              class="form-input input-with-prefix"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary search-play-btn">
            <span>Play Exam</span>
            <span aria-hidden="true">🎮</span>
          </button>
        </form>
      </section>

      <!-- Main Dashboard Overview -->
      <section class="dashboard-top-grid">
        <div class="card welcome-card">
          <div class="profile-header">
            ${renderAvatar(user.name, 'lg', 'lavender', user.avatarUrl)}
            <div>
              <p class="meta-line">@${escapeHtml(user.username)}</p>
              <h1 class="dashboard-heading">Hey, ${escapeHtml(firstName)}! 👋</h1>
            </div>
          </div>

          <div class="share-box">
            <div class="share-box-header">
              <span>🔗 My Quiz Link</span>
              <span>${statusBadge}</span>
            </div>
            <div class="share-url-display truncate">${escapeHtml(fullQuizUrl)}</div>
            <div class="share-actions">
              <button type="button" id="copy-quiz-link-btn" class="btn btn-sm btn-outline-soft">📋 Copy Link</button>
              <button type="button" id="share-quiz-btn" class="btn btn-sm btn-pink">📤 Share</button>
              <a href="${
                primaryQuiz ? `/create-quiz/${primaryQuiz.id}` : '/quiz'
              }" class="btn btn-sm btn-primary ml-auto">${
                primaryQuiz ? '✏️ Edit Quiz' : '➕ Create Quiz'
              }</a>
            </div>
          </div>
        </div>

        <div class="card-pink best-friend-card">
          <div>
            <p class="best-friend-kicker">👑 Top Friend</p>
            ${bestFriendHtml}
          </div>
          ${
            primaryQuiz && primaryQuiz.status === 'published'
              ? `<a href="/leaderboard/${encodeURIComponent(
                  primaryQuiz.slug
                )}" class="btn btn-sm btn-outline-soft" style="margin-top: 1rem; align-self: flex-start;">🏆 View Leaderboard</a>`
              : ''
          }
        </div>
      </section>

      <!-- Stats -->
      <section class="stats-strip">
        <div class="card">
          <p class="meta-line">❓ Questions</p>
          <p class="stat-value tabular-nums">${data.stats.totalQuestions}</p>
        </div>
        <div class="card">
          <p class="meta-line">👥 Players</p>
          <p class="stat-value tabular-nums">${data.stats.totalParticipants}</p>
        </div>
        <div class="card">
          <p class="meta-line">🎯 Match</p>
          <p class="stat-value accent tabular-nums">${data.stats.averageMatchPercentage}%</p>
        </div>
      </section>

      <!-- Recent & Leaderboard -->
      <section class="dashboard-lists-grid">
        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">👥 Recent Players</h2>
          </div>
          ${recentHtml}
        </div>

        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">🏆 Top Scores</h2>
            ${
              primaryQuiz
                ? `<a href="/leaderboard/${encodeURIComponent(
                    primaryQuiz.slug
                  )}" class="text-link" style="font-size: 0.8rem; font-weight: 700;">View All &#8594;</a>`
                : ''
            }
          </div>
          ${leaderboardPreviewHtml}
        </div>
      </section>
    `;

    // Wire Search Exam form
    const searchForm = document.getElementById('search-quiz-form');
    const searchInput = document.getElementById('search-username-input');
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const targetUser = searchInput.value.trim().toLowerCase().replace(/^@+/, '');
      if (!targetUser) return;
      window.location.href = `/quiz/${encodeURIComponent(targetUser)}`;
    });

    // Wire Copy Quiz link
    const copyBtn = document.getElementById('copy-quiz-link-btn');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(fullQuizUrl, 'Link copied! 📋');
      if (ok) {
        copyBtn.textContent = 'Copied! ✅';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Link';
        }, 2000);
      }
    });

    // Wire Share Quiz link
    document.getElementById('share-quiz-btn').addEventListener('click', () => {
      shareUrl({
        title: `How well do you know ${user.name}?`,
        text: 'Take my quiz!',
        url: fullQuizUrl,
      });
    });
  } catch {
    showToast('error', 'Failed to load dashboard.');
    root.innerHTML = `<div class="card"><p>Could not load. Please refresh.</p></div>`;
  }
}

initDashboard();
