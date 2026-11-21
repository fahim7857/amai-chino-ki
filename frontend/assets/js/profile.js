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
  root.innerHTML = `${renderSkeleton(3)}<div style="margin-top: 1.5rem;">${renderSkeleton(4)}</div>`;

  async function loadAndRender() {
    try {
      const data = await api.public.getDashboardStats();
      const visibility = data.user.leaderboard_visibility || 'public';
      const joinedDate = new Date(user.createdAt).toLocaleDateString();

      const myQuizzesHtml =
        data.quizzes.length > 0
          ? `<div class="list-divide">${data.quizzes
              .map(
                (q) => `
              <div class="list-row" style="flex-wrap: wrap;">
                <div>
                  <p class="meta-line">${
                    q.status === 'published' ? 'Published' : 'Draft'
                  } &#183; /quiz/${escapeHtml(q.slug)}</p>
                  <h3 style="margin-top: 0.2rem; font-size: 1rem; font-weight: 700;">${escapeHtml(
                    q.title
                  )}</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <a href="/create-quiz/${q.id}" class="btn btn-sm btn-outline-soft">Edit</a>
                  ${
                    q.status === 'published'
                      ? `
                        <a href="/quiz/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-lavender">Open</a>
                        <a href="/leaderboard/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-mint">Ranks</a>
                      `
                      : ''
                  }
                  <button type="button" class="btn-icon danger" data-delete-quiz="${
                    q.id
                  }" data-quiz-title="${escapeHtml(q.title)}" aria-label="Delete quiz">&#10005;</button>
                </div>
              </div>
            `
              )
              .join('')}</div>`
          : `<p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-muted);">You haven't created a quiz yet.</p>`;

      const takenHtml =
        data.quizzesTaken.length > 0
          ? `<div class="list-divide">${data.quizzesTaken
              .map(
                (item) => `
              <div class="list-row">
                <div style="min-width: 0;">
                  <p class="meta-line">${escapeHtml(item.owner_name)} (@${escapeHtml(
                  item.owner_username
                )}) &#183; ${item.correct_answers}/${item.total_questions} matched</p>
                  <p class="truncate" style="margin-top: 0.2rem; font-size: 1rem; font-weight: 700;">${escapeHtml(
                    item.quiz_title
                  )}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                  <span class="tabular-nums" style="font-size: 1.125rem; font-weight: 800; color: var(--primary-lilac);">${
                    item.match_percentage
                  }%</span>
                  <a href="/quiz-result/${item.submission_id}" class="btn btn-sm btn-lavender">Result</a>
                </div>
              </div>
            `
              )
              .join('')}</div>`
          : `<p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-muted);">
               You haven't taken any friend's quiz yet. Try <a href="/quiz/fahim" class="text-link">Fahim's sample quiz</a>!
             </p>`;

      root.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          <section class="card" style="display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
            <div class="profile-header">
              ${renderAvatar(user.name, 'lg', 'lavender')}
              <div>
                <h1 style="font-size: 1.5rem; font-weight: 800;">${escapeHtml(user.name)}</h1>
                <p class="meta-line" style="margin-top: 0.25rem; font-size: 0.85rem;">
                  @${escapeHtml(user.username)} &#183; Member since ${escapeHtml(joinedDate)}
                </p>
              </div>
            </div>

            <div>
              <p class="form-label-sm">Leaderboard Visibility</p>
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

          <section class="card">
            <div class="card-header-row">
              <h2 class="card-title">My Quizzes</h2>
              <a href="/create-quiz" class="btn btn-sm btn-primary">Create / Edit Quiz</a>
            </div>
            ${myQuizzesHtml}
          </section>

          <section class="card">
            <h2 class="card-title">Quizzes You've Taken</h2>
            ${takenHtml}
          </section>
        </div>
      `;

      document.querySelectorAll('[data-vis]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const next = btn.getAttribute('data-vis');
          try {
            await api.public.updateSettings(next);
            showToast(
              'success',
              next === 'public'
                ? 'Your leaderboard is now public.'
                : 'Your leaderboard is now private to you and participants.'
            );
            await loadAndRender();
          } catch (err) {
            showToast('error', err instanceof ApiError ? err.message : 'Could not update settings.');
          }
        });
      });

      document.querySelectorAll('[data-delete-quiz]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-delete-quiz'));
          const title = btn.getAttribute('data-quiz-title') || 'this quiz';
          openConfirmModal({
            title: 'Delete this quiz?',
            message: `Deleting "${title}" will permanently remove all its questions and friend leaderboard scores.`,
            confirmLabel: 'Delete Quiz',
            destructive: true,
            onConfirm: async () => {
              await api.quizzes.delete(id);
              showToast('success', 'Quiz deleted.');
              await loadAndRender();
            },
          });
        });
      });
    } catch {
      showToast('error', 'Could not load profile details.');
      root.innerHTML = `<div class="card"><p>Could not load profile right now.</p></div>`;
    }
  }

  await loadAndRender();
}

initProfile();
