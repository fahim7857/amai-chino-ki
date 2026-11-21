import { api, ApiError } from './api.js';
import {
  copyToClipboard,
  escapeHtml,
  getCurrentUser,
  getRouteSegment,
  openConfirmModal,
  renderAvatar,
  renderNavbar,
  renderSkeleton,
  showToast,
} from './ui.js';

async function initPublicQuiz() {
  const user = await getCurrentUser();
  renderNavbar(user, window.location.pathname);

  const root = document.getElementById('public-quiz-root');
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.5rem;">${renderSkeleton(5)}</div>`;

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
    const msg = err instanceof ApiError ? err.message : 'Could not load this quiz right now.';
    root.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h1 style="font-size: 1.5rem; font-weight: 800;">Quiz not found</h1>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">${escapeHtml(msg)}</p>
        <a href="/" class="btn btn-primary" style="margin-top: 1.5rem;">Back to Home</a>
      </div>
    `;
    return;
  }

  function render() {
    const qz = state.quiz;
    const total = qz.questions.length;
    const ownerFirst = qz.owner.name.split(' ')[0];
    const redirectParam = encodeURIComponent(`/quiz/${qz.slug}`);

    const introCardHtml = `
      <div class="card">
        <div class="card-header-row">
          <div class="profile-header" style="min-width: 0;">
            ${renderAvatar(qz.owner.name, 'md', 'lavender')}
            <div style="min-width: 0;">
              <p class="meta-line truncate">${escapeHtml(qz.owner.name)} &#183; @${escapeHtml(
      qz.owner.username
    )}</p>
              <h1 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em;">${escapeHtml(
                qz.title
              )}</h1>
            </div>
          </div>
          <a href="/leaderboard/${encodeURIComponent(qz.slug)}" class="btn btn-sm btn-lavender">Leaderboard</a>
        </div>
        ${
          qz.description
            ? `<p style="margin-top: 0.85rem; font-size: 0.9rem; color: var(--text-muted); line-height: 1.55;">${escapeHtml(
                qz.description
              )}</p>`
            : ''
        }
        <p class="meta-line tabular-nums" style="margin-top: 0.85rem;">
          ${total} Questions &#183; ${qz.participantCount} Friend${
      qz.participantCount === 1 ? '' : 's'
    } Played
        </p>
      </div>
    `;

    let bodyCardHtml = '';

    if (!user) {
      bodyCardHtml = `
        <div class="card-pink" style="text-align: center; padding: 2.25rem;">
          <h2 style="font-size: 1.35rem; font-weight: 800;">Log in to submit your answers</h2>
          <p style="margin-top: 0.65rem; font-size: 0.9rem; color: var(--text-body); max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.55;">
            So ${escapeHtml(ownerFirst)} knows who scored what on their leaderboard, please log in or create a quick username first. You'll come right back to this quiz!
          </p>
          <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/login?redirect=${redirectParam}" class="btn btn-primary">Login to Play</a>
            <a href="/register?redirect=${redirectParam}" class="btn btn-outline-soft">Create Account</a>
          </div>
        </div>
      `;
    } else if (qz.isOwner) {
      bodyCardHtml = `
        <div class="card-lavender" style="text-align: center; padding: 2.25rem;">
          <h2 style="font-size: 1.35rem; font-weight: 800;">This is your own quiz!</h2>
          <p style="margin-top: 0.65rem; font-size: 0.9rem; color: var(--text-body); max-width: 440px; margin-left: auto; margin-right: auto;">
            Share this link with your friends so they can guess your favourites and climb your leaderboard.
          </p>
          <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="owner-copy-btn" class="btn btn-outline-soft">Copy Link</button>
            <a href="/create-quiz/${qz.id}" class="btn btn-primary">Edit Questions</a>
          </div>
        </div>
      `;
    } else if (qz.existingSubmissionId) {
      bodyCardHtml = `
        <div class="card-mint" style="text-align: center; padding: 2.25rem;">
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--mint-text);">
            You've already taken ${escapeHtml(ownerFirst)}'s quiz!
          </h2>
          <p style="margin-top: 0.65rem; font-size: 0.9rem; color: #2E5E42;">
            Each friend gets one official attempt per quiz to keep the leaderboard fair.
          </p>
          <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="/quiz-result/${qz.existingSubmissionId}" class="btn btn-primary">View Your Result</a>
            <a href="/leaderboard/${encodeURIComponent(qz.slug)}" class="btn btn-outline-soft">See Leaderboard</a>
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
            <span class="tabular-nums">Question ${state.currentIndex + 1} of ${total}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPct}%"></div>
          </div>

          <h2 style="margin-top: 1.5rem; font-size: 1.45rem; font-weight: 800; line-height: 1.3;">
            ${escapeHtml(currentQ.question_text)}
          </h2>

          <div class="mcq-list">
            ${currentQ.options
              .map((opt) => {
                const isSelected = state.answers[currentQ.id] === opt.id;
                return `
                  <button type="button" class="mcq-option ${
                    isSelected ? 'selected' : ''
                  }" data-opt-id="${opt.id}">
                    <span>${escapeHtml(opt.option_text)}</span>
                    <span class="mcq-radio">${isSelected ? '&#10003;' : ''}</span>
                  </button>
                `;
              })
              .join('')}
          </div>

          <div class="step-dots">
            ${qz.questions
              .map((q, idx) => {
                const cls =
                  idx === state.currentIndex
                    ? 'current'
                    : state.answers[q.id] !== undefined
                      ? 'answered'
                      : '';
                return `<button type="button" class="step-dot ${cls}" data-step-idx="${idx}" aria-label="Jump to question ${
                  idx + 1
                }"></button>`;
              })
              .join('')}
          </div>

          <div class="quiz-nav-footer">
            <button type="button" id="prev-q-btn" class="btn btn-outline-soft" ${
              state.currentIndex === 0 ? 'disabled' : ''
            }>&#8592; Previous</button>
            ${
              state.currentIndex < total - 1
                ? `<button type="button" id="next-q-btn" class="btn btn-primary">Next &#8594;</button>`
                : `<button type="button" id="submit-quiz-btn" class="btn btn-primary">Submit (${answeredCount}/${total})</button>`
            }
          </div>
        </div>
      `;
    }

    root.innerHTML = `<div style="display: flex; flex-direction: column; gap: 1.5rem;">${introCardHtml}${bodyCardHtml}</div>`;

    const ownerCopyBtn = document.getElementById('owner-copy-btn');
    if (ownerCopyBtn) {
      ownerCopyBtn.addEventListener('click', () =>
        copyToClipboard(window.location.href, 'Quiz link copied!')
      );
    }

    const currentQ = qz.questions[state.currentIndex];
    document.querySelectorAll('[data-opt-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.answers[currentQ.id] = Number(btn.getAttribute('data-opt-id'));
        render();
      });
    });

    document.querySelectorAll('[data-step-idx]').forEach((dot) => {
      dot.addEventListener('click', () => {
        state.currentIndex = Number(dot.getAttribute('data-step-idx'));
        render();
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
      submitBtn.addEventListener('click', () => {
        const answeredCount = Object.keys(state.answers).length;
        if (answeredCount !== total) {
          const firstMissing = qz.questions.findIndex((q) => state.answers[q.id] === undefined);
          if (firstMissing >= 0) {
            state.currentIndex = firstMissing;
            render();
          }
          showToast('error', 'Please answer every question before submitting.');
          return;
        }

        openConfirmModal({
          title: 'Ready to submit your answers?',
          message: `You answered all ${total} questions for ${ownerFirst}. Once submitted, your official score will be added to their leaderboard.`,
          confirmLabel: 'Submit Answers',
          cancelLabel: 'Review Answers',
          onConfirm: async () => {
            if (state.submitting) return;
            state.submitting = true;
            try {
              const payload = qz.questions.map((q) => ({
                questionId: q.id,
                selectedOptionId: state.answers[q.id],
              }));
              const submitRes = await api.public.submitQuiz(qz.slug, payload);
              window.location.href = `/quiz-result/${submitRes.result.submissionId}`;
            } catch (err) {
              state.submitting = false;
              showToast('error', err instanceof ApiError ? err.message : 'Failed to submit answers.');
              throw err;
            }
          },
        });
      });
    }
  }

  render();
}

initPublicQuiz();
