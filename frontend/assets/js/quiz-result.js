import { api } from './api.js';
import {
  copyToClipboard,
  escapeHtml,
  getRouteSegment,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
  requireSession,
  shareUrl,
} from './ui.js';

async function initQuizResult() {
  const user = await requireSession();
  if (!user) return;
  renderNavbar(user, window.location.pathname);

  const root = document.getElementById('result-root');
  root.innerHTML = `${renderSkeleton(3)}<div style="margin-top: 1.25rem;">${renderSkeleton(2)}</div>`;

  const subId = Number(getRouteSegment(1));
  if (!Number.isInteger(subId)) {
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">Result Not Found</h1>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1rem;">Dashboard</a>
      </div>
    `;
    return;
  }

  try {
    const res = await api.public.getSubmission(subId);
    const result = res.result;
    const quizShareUrl = `${window.location.origin}/quiz/${result.quizSlug}`;

    const formattedPct = Number.isInteger(result.matchPercentage)
      ? result.matchPercentage
      : Number(result.matchPercentage.toFixed(1));

    root.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div class="card result-card" style="text-align: center;">
          <div class="avatar-overlap" style="justify-content: center;">
            ${renderAvatar(result.participant.name, 'lg', 'pink', result.participant.avatarUrl)}
            ${renderAvatar(result.owner.name, 'lg', 'lavender', result.owner.avatarUrl)}
          </div>

          <p class="meta-line" style="margin-top: 1rem;">
            ${escapeHtml(result.quizTitle)} &#183; @${escapeHtml(result.owner.username)}
          </p>

          <p class="result-percentage tabular-nums" style="font-size: 3rem; font-weight: 800; color: var(--primary-lilac); margin-top: 0.5rem;">
            ${formattedPct}%
          </p>

          <p style="font-size: 1.15rem; font-weight: 800; margin-top: 0.25rem;">
            ${result.correctAnswers} / ${result.totalQuestions} Correct 🎉
          </p>

          <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/leaderboard/${encodeURIComponent(result.quizSlug)}" class="btn btn-primary">
              🏆 Leaderboard
            </a>
            <a href="/quiz" class="btn btn-outline-soft">✏️ Make Quiz</a>
            <button type="button" id="share-result-btn" class="btn btn-pink">📤 Share</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('share-result-btn').addEventListener('click', () => {
      shareUrl({
        title: `I scored ${formattedPct}% on ${result.owner.name}'s quiz!`,
        text: `I scored ${formattedPct}% on ${result.owner.name}'s quiz! Can you beat me?`,
        url: quizShareUrl,
      });
    });
  } catch {
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">Result Not Found</h1>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1rem;">Dashboard</a>
      </div>
    `;
  }
}

initQuizResult();
