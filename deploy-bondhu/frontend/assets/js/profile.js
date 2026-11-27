import { api, ApiError } from './api.js';
import {
  BASE_PATH,
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
                  <a href="${BASE_PATH}/create-quiz/${q.id}" class="btn btn-sm btn-outline-soft">✏️ Edit</a>
                  ${
                    q.status === 'published'
                      ? `
                        <a href="${BASE_PATH}/quiz/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-lavender">🎮 Open</a>
                        <a href="${BASE_PATH}/leaderboard/${encodeURIComponent(q.slug)}" class="btn btn-sm btn-mint">🏆 Ranks</a>
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
                  <a href="${BASE_PATH}/quiz-result/${item.submission_id}" class="btn btn-sm btn-lavender">Result</a>
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
              <div style="position: relative; display: inline-block;">
                <div id="avatar-container">
                  ${renderAvatar(user.name, 'lg', 'lavender', user.avatarUrl)}
                </div>
                <label for="avatar-file-input" class="avatar-upload-badge" title="Upload new photo" aria-label="Upload photo">
                  📷
                </label>
                <input type="file" id="avatar-file-input" accept="image/*" style="display: none;" />
              </div>
              <div>
                <h1 style="font-size: 1.35rem; font-weight: 800;">${escapeHtml(user.name)}</h1>
                <p class="meta-line">@${escapeHtml(user.username)}</p>
                <button type="button" id="change-photo-btn" class="btn btn-sm btn-outline-soft" style="margin-top: 0.5rem; font-size: 0.8rem; padding: 0.25rem 0.65rem;">
                  📷 Change Photo
                </button>
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
              <a href="${BASE_PATH}/quiz" class="btn btn-sm btn-primary">➕ New Quiz</a>
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

      const fileInput = document.getElementById('avatar-file-input');
      const changeBtn = document.getElementById('change-photo-btn');
      if (fileInput) {
        if (changeBtn) {
          changeBtn.addEventListener('click', () => fileInput.click());
        }
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          if (!file.type.startsWith('image/')) {
            showToast('error', 'Please select a valid image file.');
            return;
          }

          if (file.size > 5 * 1024 * 1024) {
            showToast('error', 'Image size must be less than 5MB.');
            return;
          }

          const reader = new FileReader();
          reader.onload = async () => {
            const base64Data = reader.result;
            showToast('info', 'Uploading to Cloudinary... ⏳');
            try {
              const res = await api.auth.uploadProfilePicture(base64Data);
              user.avatarUrl = res.avatarUrl;
              showToast('success', 'Profile picture updated! 📸');
              await loadAndRender();
            } catch (err) {
              showToast('error', err instanceof ApiError ? err.message : 'Upload failed. Check Cloudinary credentials.');
            }
          };
          reader.readAsDataURL(file);
        });
      }

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
