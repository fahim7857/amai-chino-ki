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
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.5rem;">${renderSkeleton(5)}</div>`;

  const slug = getRouteSegment(1) || (user ? user.username : 'fahim');

  try {
    const data = await api.public.getLeaderboard(slug);
    const isOwner = user && user.username === data.quiz.ownerUsername;
    const ownerFirst = data.quiz.ownerName.split(' ')[0];

    const headerHtml = `
      <div class="builder-header">
        <div>
          <p class="meta-line">
            ${escapeHtml(data.quiz.ownerName)} (@${escapeHtml(data.quiz.ownerUsername)}) &#183; ${
      data.entries.length
    } Participant${data.entries.length === 1 ? '' : 's'}
          </p>
          <h1 class="dashboard-heading">${escapeHtml(data.quiz.title)} — Leaderboard</h1>
        </div>
        ${
          !isOwner
            ? `<a href="/quiz/${encodeURIComponent(
                data.quiz.slug
              )}" class="btn btn-primary">Take This Quiz &#8594;</a>`
            : ''
        }
      </div>
    `;

    if (data.entries.length === 0) {
      root.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          ${headerHtml}
          <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
            <h2 style="font-size: 1.25rem; font-weight: 700;">No scores recorded yet</h2>
            <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">
              Be the first friend to take ${escapeHtml(ownerFirst)}'s quiz and claim the #1 spot!
            </p>
          </div>
        </div>
      `;
      return;
    }

    const topThree = data.entries.slice(0, 3);
    const podiumHtml = topThree
      .map((entry, idx) => {
        const cardCls =
          entry.rank === 1 ? 'podium-1' : entry.rank === 2 ? 'podium-2' : 'podium-3';
        const rankLabel =
          entry.rank === 1 ? '1st Place' : entry.rank === 2 ? '2nd Place' : '3rd Place';
        const avatarTone = idx === 0 ? 'cream' : idx === 1 ? 'lavender' : 'pink';

        return `
          <div class="podium-card ${cardCls}">
            <div class="card-header-row">
              <span style="font-size: 0.75rem; font-weight: 800;">${rankLabel}</span>
              <span class="meta-line tabular-nums">${entry.correctAnswers}/${
          entry.totalQuestions
        }</span>
            </div>
            <div class="profile-header" style="margin-top: 1rem;">
              ${renderAvatar(entry.participantName, 'md', avatarTone)}
              <div style="min-width: 0;">
                <p class="truncate" style="font-size: 1rem; font-weight: 800;">${escapeHtml(
                  entry.participantName
                )}</p>
                <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)}</p>
              </div>
            </div>
            <p class="tabular-nums" style="margin-top: 1rem; font-size: 1.875rem; font-weight: 800;">
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
                  <p class="truncate" style="font-weight: 700;">
                    ${escapeHtml(entry.participantName)}${isMe ? ' (You)' : ''}
                  </p>
                  <p class="truncate meta-line">@${escapeHtml(entry.participantUsername)}</p>
                </div>
              </div>
            </td>
            <td class="text-right tabular-nums" style="font-weight: 600; color: var(--text-muted); white-space: nowrap;">
              ${entry.correctAnswers} / ${entry.totalQuestions}
            </td>
            <td class="text-right tabular-nums" style="font-weight: 800; color: var(--primary-lilac); white-space: nowrap;">
              ${entry.matchPercentage}%
            </td>
          </tr>
        `;
      })
      .join('');

    root.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        ${headerHtml}
        <section class="podium-grid">${podiumHtml}</section>
        <section class="card table-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th class="text-right">Score</th>
                <th class="text-right">Match</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      </div>
    `;
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Could not load leaderboard.';
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h1 style="font-size: 1.5rem; font-weight: 800;">Leaderboard unavailable</h1>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(msg)}</p>
        <a href="/" class="btn btn-primary" style="margin-top: 1.5rem;">Back to Home</a>
      </div>
    `;
  }
}

initLeaderboard();
