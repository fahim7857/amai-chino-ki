import { api, ApiError } from './api.js';
import {
  escapeHtml,
  getCurrentUser,
  getRouteSegment,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
} from './ui.js';

async function initLeaderboard() {
  const user = await getCurrentUser();
  renderNavbar(user, window.location.pathname);

  const root = document.getElementById('leaderboard-root');
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.25rem;">${renderSkeleton(4)}</div>`;

  const slug = getRouteSegment(1) || (user ? user.username : 'fahim');

  try {
    const data = await api.public.getLeaderboard(slug);
    const isOwner = user && user.username === data.quiz.ownerUsername;

    const headerHtml = `
      <!-- Search Leaderboard by Username -->
      <section class="search-user-card" style="margin-bottom: 1.25rem;">
        <div class="search-user-header">
          <span class="search-user-icon">🏆</span>
          <h2 class="search-user-title">Search Leaderboard</h2>
        </div>
        <form id="search-leaderboard-form" class="search-user-form">
          <div class="input-prefix-wrap search-input-wrap">
            <span class="input-prefix">@</span>
            <input
              id="search-leaderboard-input"
              type="text"
              placeholder="Username (e.g. fahim)"
              autocomplete="off"
              class="form-input input-with-prefix"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary search-play-btn">
            <span>View Ranks</span>
            <span aria-hidden="true">🔍</span>
          </button>
        </form>
      </section>

      <div class="builder-header" style="flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <p class="meta-line">@${escapeHtml(data.quiz.ownerUsername)} &#183; 👥 ${data.entries.length}</p>
          <h1 class="dashboard-heading">🏆 ${escapeHtml(data.quiz.title)}</h1>
        </div>
        ${
          !isOwner
            ? `<a href="/quiz/${encodeURIComponent(
                data.quiz.slug
              )}" class="btn btn-primary">🎮 Play Quiz</a>`
            : ''
        }
      </div>
    `;

    if (data.entries.length === 0) {
      root.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${headerHtml}
          <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
            <h2 style="font-size: 1.15rem; font-weight: 700;">No scores yet</h2>
            ${
              !isOwner
                ? `<a href="/quiz/${encodeURIComponent(
                    data.quiz.slug
                  )}" class="btn btn-primary" style="margin-top: 1rem;">🎮 Play First!</a>`
                : ''
            }
          </div>
        </div>
      `;
      wireSearch();
      return;
    }

    const topThree = data.entries.slice(0, 3);
    const podiumHtml = topThree
      .map((entry, idx) => {
        const cardCls =
          entry.rank === 1 ? 'podium-1' : entry.rank === 2 ? 'podium-2' : 'podium-3';
        const rankLabel =
          entry.rank === 1 ? '🥇 1st' : entry.rank === 2 ? '🥈 2nd' : '🥉 3rd';
        const avatarTone = idx === 0 ? 'cream' : idx === 1 ? 'lavender' : 'pink';

        return `
          <div class="podium-card ${cardCls}">
            <div class="card-header-row">
              <span style="font-size: 0.85rem; font-weight: 800;">${rankLabel}</span>
              <span class="meta-line tabular-nums">${entry.correctAnswers}/${entry.totalQuestions}</span>
            </div>
            <div class="profile-header" style="margin-top: 0.75rem;">
              ${renderAvatar(entry.participantName, 'md', avatarTone)}
              <div style="min-width: 0;">
                <p class="truncate" style="font-size: 0.95rem; font-weight: 800;">${escapeHtml(
                  entry.participantName
                )}</p>
                <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)}</p>
              </div>
            </div>
            <p class="tabular-nums" style="margin-top: 0.75rem; font-size: 1.65rem; font-weight: 800; color: var(--primary-lilac);">
              ${entry.matchPercentage}%
            </p>
          </div>
        `;
      })
      .join('');

    const rowsHtml = data.entries
      .map((entry) => {
        const isMe = user && user.username === entry.participantUsername;
        return `
          <tr class="${isMe ? 'is-me' : ''}">
            <td class="tabular-nums" style="font-weight: 800; white-space: nowrap;">#${entry.rank}</td>
            <td>
              <div class="list-row-left">
                ${renderAvatar(entry.participantName, 'sm', 'lavender')}
                <div style="min-width: 0;">
                  <p class="truncate" style="font-weight: 700; font-size: 0.9rem;">
                    ${escapeHtml(entry.participantName)}${isMe ? ' (You)' : ''}
                  </p>
                  <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)}</p>
                </div>
              </div>
            </td>
            <td class="text-right tabular-nums" style="font-weight: 600; color: var(--text-muted); white-space: nowrap;">
              ${entry.correctAnswers}/${entry.totalQuestions}
            </td>
            <td class="text-right tabular-nums" style="font-weight: 800; color: var(--primary-lilac); white-space: nowrap;">
              ${entry.matchPercentage}%
            </td>
          </tr>
        `;
      })
      .join('');

    root.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${headerHtml}
        <section class="podium-grid">${podiumHtml}</section>
        <section class="card table-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th class="text-right">Score</th>
                <th class="text-right">Match</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      </div>
    `;

    wireSearch();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Could not load leaderboard.';
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">Not Found</h1>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(msg)}</p>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1rem;">Dashboard</a>
      </div>
    `;
  }

  function wireSearch() {
    const form = document.getElementById('search-leaderboard-form');
    const input = document.getElementById('search-leaderboard-input');
    if (!form || !input) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const target = input.value.trim().toLowerCase().replace(/^@+/, '');
      if (!target) return;
      window.location.href = `/leaderboard/${encodeURIComponent(target)}`;
    });
  }
}

initLeaderboard();
