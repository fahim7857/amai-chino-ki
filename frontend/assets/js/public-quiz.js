import { api, ApiError } from './api.js';
import {
  copyToClipboard,
  escapeHtml,
  getCurrentUser,
  getRouteSegment,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
  showToast,
} from './ui.js';

async function initPublicQuiz() {
  const user = await getCurrentUser();
  renderNavbar(user, window.location.pathname);

  const root = document.getElementById('public-quiz-root');
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.25rem;">${renderSkeleton(4)}</div>`;

  const slug = getRouteSegment(1) || 'fahim';
  const state = {
    quiz: null,
    currentIndex: 0,
    answers: {},
    submitting: false,
  };

  try {
    const res = await api.public.getQuiz(slug);
    state.quiz = res.quiz;
    document.title = `${state.quiz.title} — Who Knows Me Better?`;
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Quiz not found.';
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
        <h1 style="font-size: 1.35rem; font-weight: 800;">Quiz Not Found</h1>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(msg)}</p>
        <a href="/dashboard" class="btn btn-primary" style="margin-top: 1rem;">Dashboard</a>
      </div>
    `;
    return;
  }

  function render() {
    const qz = state.quiz;
    const total = qz.questions.length;
    const redirectParam = encodeURIComponent(`/quiz/${qz.slug}`);

    const introCardHtml = `
      <div class="card">
        <div class="card-header-row">
          <div class="profile-header" style="min-width: 0;">
            ${renderAvatar(qz.owner.name, 'md', 'lavender', qz.owner.avatarUrl)}
            <div style="min-width: 0;">
              <p class="meta-line truncate">@${escapeHtml(qz.owner.username)}</p>
              <h1 style="font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em;">${escapeHtml(
                qz.title
              )}</h1>
            </div>
          </div>
          <a href="/leaderboard/${encodeURIComponent(qz.slug)}" class="btn btn-sm btn-lavender">🏆 Leaderboard</a>
        </div>
      </div>
    `;

    let bodyCardHtml = '';

    if (!user) {
      bodyCardHtml = `
        <div class="card-pink" style="text-align: center; padding: 2rem 1rem;">
          <h2 style="font-size: 1.25rem; font-weight: 800;">🔑 Login to Play</h2>
          <div style="margin-top: 1.25rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/login?redirect=${redirectParam}" class="btn btn-primary">Login</a>
            <a href="/register?redirect=${redirectParam}" class="btn btn-outline-soft">Register</a>
          </div>
        </div>
      `;
    } else if (qz.isOwner) {
      bodyCardHtml = `
        <div class="card-lavender" style="text-align: center; padding: 2rem 1rem;">
          <h2 style="font-size: 1.25rem; font-weight: 800;">This is your quiz!</h2>
          <div style="margin-top: 1.25rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="owner-copy-btn" class="btn btn-outline-soft">📋 Copy Link</button>
            <a href="/create-quiz/${qz.id}" class="btn btn-primary">✏️ Edit</a>
          </div>
        </div>
      `;
    } else if (qz.existingSubmissionId) {
      bodyCardHtml = `
        <div class="card-mint" style="text-align: center; padding: 2rem 1rem;">
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--mint-text);">
            Already played! ✅
          </h2>
          <div style="margin-top: 1.25rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/quiz-result/${qz.existingSubmissionId}" class="btn btn-primary">Result</a>
            <a href="/leaderboard/${encodeURIComponent(qz.slug)}" class="btn btn-outline-soft">🏆 Leaderboard</a>
          </div>
        </div>
      `;
    } else {
      const currentQ = qz.questions[state.currentIndex];
      const answeredCount = Object.keys(state.answers).length;
      const progressPct = total > 0 ? ((state.currentIndex + 1) / total) * 100 : 0;

      bodyCardHtml = `
        <div class="card">
          <div class="progress-meta">
            <span>${escapeHtml(currentQ.category || 'Question')}</span>
            <span class="tabular-nums">${state.currentIndex + 1} / ${total}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPct}%"></div>
          </div>

          <h2 style="margin-top: 1.25rem; font-size: 1.35rem; font-weight: 800; line-height: 1.3;">
            ${escapeHtml(currentQ.question_text)}
          </h2>

          <div class="mcq-list" style="margin-top: 1rem;">
            ${currentQ.options
              .map((opt, optIdx) => {
                const isSelected = state.answers[currentQ.id] === opt.id;
                const letter = String.fromCharCode(65 + optIdx);
                return `
                  <button type="button" class="mcq-option ${
                    isSelected ? 'selected' : ''
                  }" data-opt-id="${opt.id}" style="min-height: 52px;">
                    <span><strong>${letter}.</strong> ${escapeHtml(opt.option_text)}</span>
                    <span class="mcq-radio">${isSelected ? '✓' : ''}</span>
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="step-dots" style="margin-top: 1.25rem;">
            ${qz.questions
              .map((q, idx) => {
                const cls =
                  idx === state.currentIndex
                    ? 'current'
                    : state.answers[q.id] !== undefined
                      ? 'answered'
                      : '';
                return `<button type="button" class="step-dot ${cls}" data-step-idx="${idx}" aria-label="Question ${
                  idx + 1
                }"></button>`;
              })
              .join('')}
          </div>

          <div class="quiz-nav-footer" style="margin-top: 1.25rem;">
            <button type="button" id="prev-q-btn" class="btn btn-outline-soft" ${
              state.currentIndex === 0 ? 'disabled' : ''
            }>⬅️ Prev</button>
            ${
              state.currentIndex < total - 1
                ? `<button type="button" id="next-q-btn" class="btn btn-primary">Next ➡️</button>`
                : `<button type="button" id="submit-quiz-btn" class="btn btn-primary" ${
                    answeredCount < total ? 'disabled' : ''
                  }>Submit (${answeredCount}/${total}) ✅</button>`
            }
          </div>
        </div>
      `;
    }

    root.innerHTML = `<div style="display: flex; flex-direction: column; gap: 1.25rem;">${introCardHtml}${bodyCardHtml}</div>`;

    const ownerCopyBtn = document.getElementById('owner-copy-btn');
    if (ownerCopyBtn) {
      ownerCopyBtn.addEventListener('click', () =>
        copyToClipboard(window.location.href, 'Link copied! 📋')
      );
    }

    const currentQ = qz.questions[state.currentIndex];
    document.querySelectorAll('[data-opt-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!user || qz.isOwner || qz.existingSubmissionId) return;
        const optId = Number(btn.getAttribute('data-opt-id'));
        state.answers[currentQ.id] = optId;
        render();
      });
    });

    document.querySelectorAll('[data-step-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-step-idx'));
        if (Number.isInteger(idx) && idx >= 0 && idx < total) {
          state.currentIndex = idx;
          render();
        }
      });
    });

    const prevBtn = document.getElementById('prev-q-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.currentIndex > 0) {
          state.currentIndex -= 1;
          render();
        }
      });
    }

    const nextBtn = document.getElementById('next-q-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.currentIndex < total - 1) {
          state.currentIndex += 1;
          render();
        }
      });
    }

    const submitBtn = document.getElementById('submit-quiz-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (state.submitting) return;

        const unanswered = qz.questions.filter((q) => state.answers[q.id] === undefined);
        if (unanswered.length > 0) {
          showToast('error', `Answer all questions (${unanswered.length} left).`);
          return;
        }

        state.submitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
          const payloadAnswers = Object.entries(state.answers).map(([qid, oid]) => ({
            question_id: Number(qid),
            selected_option_id: Number(oid),
          }));

          const res = await api.public.submitQuiz(qz.slug, payloadAnswers);
          showToast('success', 'Submitted! 🎉');
          window.location.href = `/quiz-result/${res.submission.id}`;
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Submission failed.');
          state.submitting = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      });
    }
  }

  render();
}

initPublicQuiz();
