import { api, ApiError } from './api.js';
import {
  escapeHtml,
  openConfirmModal,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
  requireSession,
  showToast,
} from './ui.js';

async function initProfile() {
  const user = await requireSession();
  if (!user) return;
  renderNavbar(user, '/profile');

  const root = document.getElementById('profile-root');
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.25rem;">${renderSkeleton(3)}</div>`;

  async function loadAndRender() {
    try {
      const data = await api.public.getDashboardStats();
      const visibility = data.user.leaderboard_visibility || 'public';

      const myQuizzesHtml =
        data.quizzes.length > 0
          ? `<div class="list-divide">${data.quizzes
              .map(
                (q) => `
              <div class="list-row" style="flex-wrap: wrap; gap: 0.5rem;">
                <div style="min-width: 0;">
                  <p class="meta-line">${
                    q.status === 'published' ? 'Live ✅' : 'Draft 📝'
                  }</p>
                  <h3 class="truncate" style="margin-top: 0.15rem; font-size: 0.95rem; font-weight: 700;">${escapeHtml(
                    q.title
                  )}</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <a href="/create-quiz/${q.id}" class="btn btn-sm btn-outline-soft">✏️ Edit</a>
                  ${
                    q.status === 'published'
                      ? `
                        <a href="/quiz/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-lavender">🎮 Open</a>
                        <a href="/leaderboard/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-mint">🏆 Ranks</a>
                      `
                      : ''
                  }
                  <button type="button" class="btn-icon danger" data-delete-quiz="${
                    q.id
                  }" data-quiz-title="${escapeHtml(q.title)}" aria-label="Delete">✕</button>
                </div>
              </div>
            `
              )
              .join('')}</div>`
          : `<p style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted);">No quizzes created.</p>`;

      const takenHtml =
        data.quizzesTaken.length > 0
          ? `<div class="list-divide">${data.quizzesTaken
              .map(
                (item) => `
              <div class="list-row">
                <div style="min-width: 0;">
                  <p class="meta-line">@${escapeHtml(item.owner_username)} &#183; ${item.correct_answers}/${item.total_questions}</p>
                  <p class="truncate" style="margin-top: 0.15rem; font-size: 0.95rem; font-weight: 700;">${escapeHtml(
                    item.quiz_title
                  )}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                  <span class="tabular-nums" style="font-size: 1rem; font-weight: 800; color: var(--primary-lilac);">${
                    item.match_percentage
                  }%</span>
                  <a href="/quiz-result/${item.submission_id}" class="btn btn-sm btn-lavender">Result</a>
                </div>
              </div>
            `
              )
              .join('')}</div>`
          : `<p style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted);">No quizzes played yet.</p>`;

      root.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- User Info -->
          <section class="card" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div class="profile-header">
              ${renderAvatar(user.name, 'lg', 'lavender')}
              <div>
                <h1 style="font-size: 1.35rem; font-weight: 800;">${escapeHtml(user.name)}</h1>
                <p class="meta-line">@${escapeHtml(user.username)}</p>
              </div>
            </div>

            <div>
              <p class="form-label-sm">Leaderboard</p>
              <div class="segmented-control">
                <button type="button" class="segment-btn ${
                  visibility === 'public' ? 'active' : ''
                }" data-vis="public">Public</button>
                <button type="button" class="segment-btn ${
                  visibility === 'private' ? 'active' : ''
                }" data-vis="private">Private</button>
              </div>
            </div>
          </section>

          <!-- My Quizzes -->
          <section class="card">
            <div class="card-header-row">
              <h2 class="card-title">📝 My Quizzes</h2>
              <a href="/quiz" class="btn btn-sm btn-primary">➕ New Quiz</a>
            </div>
            ${myQuizzesHtml}
          </section>

          <!-- Quizzes Taken -->
          <section class="card">
            <h2 class="card-title">🎯 Quizzes Played</h2>
            ${takenHtml}
          </section>
        </div>
      `;

      document.querySelectorAll('[data-vis]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const next = btn.getAttribute('data-vis');
          try {
            await api.public.updateSettings(next);
            showToast('success', next === 'public' ? 'Public ✅' : 'Private 🔒');
            await loadAndRender();
          } catch (err) {
            showToast('error', err instanceof ApiError ? err.message : 'Error updating.');
          }
        });
      });

      document.querySelectorAll('[data-delete-quiz]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-delete-quiz'));
          const title = btn.getAttribute('data-quiz-title') || 'quiz';
          openConfirmModal({
            title: 'Delete Quiz?',
            message: `Remove "${title}"?`,
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: async () => {
              await api.quizzes.delete(id);
              showToast('success', 'Deleted. 🗑️');
              await loadAndRender();
            },
          });
        });
      });
    } catch {
      showToast('error', 'Could not load profile.');
      root.innerHTML = `<div class="card"><p>Could not load profile.</p></div>`;
    }
  }

  await loadAndRender();
}

initProfile();
