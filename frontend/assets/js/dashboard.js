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
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      ${renderSkeleton(2)}
      <div class="stats-strip">${renderSkeleton(2)}${renderSkeleton(2)}${renderSkeleton(2)}</div>
      ${renderSkeleton(4)}
    </div>
  `;

  try {
    const data = await api.public.getDashboardStats();
    const primaryQuiz = data.primaryQuiz;
    const quizPath = primaryQuiz ? `/quiz/${primaryQuiz.slug}` : `/quiz/${user.username}`;
    const fullQuizUrl = `${window.location.origin}${quizPath}`;
    const firstName = user.name.split(' ')[0];

    const statusText = primaryQuiz
      ? primaryQuiz.status === 'published'
        ? 'Published & Live'
        : 'Draft (Publish to share)'
      : 'Not created yet';

    const bestFriendHtml = data.bestFriend
      ? `
        <div class="best-friend-body">
          ${renderAvatar(data.bestFriend.participantName, 'lg', 'cream')}
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800;">${escapeHtml(
              data.bestFriend.participantName
            )}</h2>
            <p class="meta-line">@${escapeHtml(data.bestFriend.participantUsername)}</p>
            <p class="best-friend-score tabular-nums">${data.bestFriend.matchPercentage}% match</p>
          </div>
        </div>
      `
      : `
        <div style="margin-top: 1rem;">
          <h2 style="font-size: 1.125rem; font-weight: 700;">Waiting for your #1 friend</h2>
          <p style="margin-top: 0.4rem; font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">
            ${
              primaryQuiz
                ? 'Share your quiz link with friends to crown who knows you best.'
                : 'Create and publish your quiz first to start ranking friends.'
            }
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
                  ${renderAvatar(p.participantName, 'sm', 'mint')}
                  <div style="min-width: 0;">
                    <p class="truncate" style="font-size: 0.875rem; font-weight: 700;">${escapeHtml(
                      p.participantName
                    )}</p>
                    <p class="truncate meta-line">@${escapeHtml(p.participantUsername)} &#183; ${
                      p.correctAnswers
                    }/${p.totalQuestions} right</p>
                  </div>
                </div>
                <span class="tabular-nums" style="font-size: 1rem; font-weight: 800; color: var(--primary-lilac);">${
                  p.matchPercentage
                }%</span>
              </div>
            `
            )
            .join('')}</div>`
        : `
          <div class="empty-state">
            <p class="empty-state-title">No participants yet</p>
            <p class="empty-state-desc">Copy your quiz link above and send it to a friend.</p>
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
                      <p class="truncate" style="font-size: 0.875rem; font-weight: 700;">${escapeHtml(
                        entry.participantName
                      )}</p>
                      <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)} &#183; ${
                        entry.correctAnswers
                      }/${entry.totalQuestions}</p>
                    </div>
                  </div>
                  <span class="tabular-nums" style="font-size: 1rem; font-weight: 800;">${
                    entry.matchPercentage
                  }%</span>
                </div>
              `;
            })
            .join('')}</div>`
        : `
          <div class="empty-state">
            <p class="empty-state-title">Leaderboard is empty</p>
            <p class="empty-state-desc">Scores appear here ranked highest percentage first.</p>
          </div>
        `;

    root.innerHTML = `
      <section class="dashboard-top-grid">
        <div class="card welcome-card">
          <div class="profile-header">
            ${renderAvatar(user.name, 'lg', 'lavender')}
            <div>
              <p class="meta-line">@${escapeHtml(user.username)} &#183; Personal Quiz Studio</p>
              <h1 class="dashboard-heading">Hey, ${escapeHtml(firstName)}!</h1>
            </div>
          </div>

          <div class="share-box">
            <div class="share-box-header">
              <span>Your Personal Quiz Link</span>
              <span>${escapeHtml(statusText)}</span>
            </div>
            <div class="share-url-display truncate">${escapeHtml(fullQuizUrl)}</div>
            <div class="share-actions">
              <button type="button" id="copy-quiz-link-btn" class="btn btn-sm btn-outline-soft">Copy Link</button>
              <button type="button" id="share-quiz-btn" class="btn btn-sm btn-pink">Share</button>
              <a href="${
                primaryQuiz ? `/create-quiz/${primaryQuiz.id}` : '/create-quiz'
              }" class="btn btn-sm btn-primary ml-auto">${
                primaryQuiz ? 'Edit Quiz' : 'Create Quiz'
              }</a>
            </div>
          </div>
        </div>

        <div class="card-pink best-friend-card">
          <div>
            <p class="best-friend-kicker">Best Friend Leader</p>
            ${bestFriendHtml}
          </div>
          ${
            primaryQuiz && primaryQuiz.status === 'published'
              ? `<a href="/leaderboard/${encodeURIComponent(
                  primaryQuiz.slug
                )}" class="btn btn-sm btn-outline-soft" style="margin-top: 1.5rem; align-self: flex-start;">Open Full Leaderboard</a>`
              : ''
          }
        </div>
      </section>

      <section class="stats-strip">
        <div class="card">
          <p class="meta-line">Total Questions</p>
          <p class="stat-value tabular-nums">${data.stats.totalQuestions}</p>
          <p class="stat-sub">Multiple-choice prompts in your quiz</p>
        </div>
        <div class="card">
          <p class="meta-line">Total Participants</p>
          <p class="stat-value tabular-nums">${data.stats.totalParticipants}</p>
          <p class="stat-sub">Friends who completed your quiz</p>
        </div>
        <div class="card">
          <p class="meta-line">Average Match</p>
          <p class="stat-value accent tabular-nums">${data.stats.averageMatchPercentage}%</p>
          <p class="stat-sub">Mean friendship accuracy score</p>
        </div>
      </section>

      <section class="dashboard-lists-grid">
        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">Recent Participants</h2>
            <span class="meta-line">Latest attempts</span>
          </div>
          ${recentHtml}
        </div>

        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">Leaderboard Preview</h2>
            ${
              primaryQuiz
                ? `<a href="/leaderboard/${encodeURIComponent(
                    primaryQuiz.slug
                  )}" class="text-link" style="font-size: 0.75rem;">See all &#8594;</a>`
                : ''
            }
          </div>
          ${leaderboardPreviewHtml}
        </div>
      </section>
    `;

    const copyBtn = document.getElementById('copy-quiz-link-btn');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(fullQuizUrl, 'Personal quiz link copied!');
      if (ok) {
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Link';
        }, 2000);
      }
    });

    document.getElementById('share-quiz-btn').addEventListener('click', () => {
      shareUrl({
        title: `How well do you know ${user.name}?`,
        text: 'Take my personal quiz and see where you rank on my leaderboard!',
        url: fullQuizUrl,
      });
    });
  } catch {
    showToast('error', 'Failed to load dashboard data.');
    root.innerHTML = `<div class="card"><p>Could not load dashboard right now. Please refresh.</p></div>`;
  }
}

initDashboard();
