import { api, ApiError } from './api.js';
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
  root.innerHTML = `${renderSkeleton(4)}<div style="margin-top: 1.5rem;">${renderSkeleton(3)}</div>`;

  const subId = Number(getRouteSegment(1));
  if (!Number.isInteger(subId)) {
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h1 style="font-size: 1.5rem; font-weight: 800;">Result unavailable</h1>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">Invalid result link.</p>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1.5rem;">Go to Dashboard</a>
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
      : Number(result.matchPercentage.toFixed(2));

    root.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div class="card result-card">
          <div class="avatar-overlap">
            ${renderAvatar(result.participant.name, 'lg', 'pink')}
            ${renderAvatar(result.owner.name, 'lg', 'lavender')}
          </div>

          <p class="meta-line" style="margin-top: 1.25rem;">
            ${escapeHtml(result.quizTitle)} &#183; Created by ${escapeHtml(result.owner.name)}
          </p>

          <p class="result-percentage tabular-nums">${formattedPct}%</p>

          <h1 style="margin-top: 0.75rem; font-size: 1.35rem; font-weight: 800;">
            You got ${formattedPct}% correct!
          </h1>

          <div style="margin-top: 1.25rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; max-width: 460px; margin-left: auto; margin-right: auto;">
            <div style="min-width: 0; background-color: var(--bg-cream); border-radius: var(--radius-inner); padding: 0.85rem 0.5rem;">
              <p class="meta-line">Total Questions</p>
              <p class="tabular-nums" style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 800;">${result.totalQuestions}</p>
            </div>
            <div style="min-width: 0; background-color: var(--bg-lavender); border-radius: var(--radius-inner); padding: 0.85rem 0.5rem;">
              <p class="meta-line">Correct Answers</p>
              <p class="tabular-nums" style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 800;">${result.correctAnswers}</p>
            </div>
            <div style="min-width: 0; background-color: var(--bg-pink); border-radius: var(--radius-inner); padding: 0.85rem 0.5rem;">
              <p class="meta-line">Match Percentage</p>
              <p class="tabular-nums" style="margin-top: 0.25rem; font-size: 1.25rem; font-weight: 800;">${formattedPct}%</p>
            </div>
          </div>

          <p style="margin-top: 1rem; font-size: 0.95rem; color: var(--text-body); max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            ${escapeHtml(result.friendlyMessage)}
          </p>

          <div style="margin-top: 1.75rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/leaderboard/${encodeURIComponent(result.quizSlug)}" class="btn btn-primary">
              View Leaderboard
            </a>
            <a href="/create-quiz" class="btn btn-ghost">Make Your Own Quiz</a>
          </div>
        </div>

        <div class="card-pink">
          <p class="best-friend-kicker">Shareable Result Card</p>
          <p style="margin-top: 0.5rem; font-size: 1.25rem; font-weight: 800;">
            "${escapeHtml(result.shareText)}"
          </p>
          <p class="truncate" style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
            ${escapeHtml(quizShareUrl)}
          </p>

          <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="copy-share-btn" class="btn btn-sm btn-outline-soft">
              Copy Share Text
            </button>
            <button type="button" id="native-share-btn" class="btn btn-sm" style="background-color: var(--secondary-text-accent); color: #FFFFFF;">
              Share Challenge
            </button>
          </div>
        </div>
      </div>
    `;

    const copyBtn = document.getElementById('copy-share-btn');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(
        `${result.shareText} ${quizShareUrl}`,
        'Shareable result message copied!'
      );
      if (ok) {
        copyBtn.textContent = 'Copied';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Share Text';
        }, 2000);
      }
    });

    document.getElementById('native-share-btn').addEventListener('click', () => {
      shareUrl({
        title: result.quizTitle,
        text: result.shareText,
        url: quizShareUrl,
      });
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Could not load quiz result.';
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h1 style="font-size: 1.5rem; font-weight: 800;">Result unavailable</h1>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(msg)}</p>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1.5rem;">Go to Dashboard</a>
      </div>
    `;
  }
}

initQuizResult();
