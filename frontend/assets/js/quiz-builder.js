import { api, ApiError } from './api.js';
import { CATEGORY_SUGGESTIONS, QUESTION_CATEGORIES } from './suggestions.js';
import {
  escapeHtml,
  getRouteSegment,
  openConfirmModal,
  renderNavbar,
  renderSkeleton,
  requireSession,
  showToast,
} from './ui.js';

function createDefaultOptions() {
  return [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ];
}

async function initQuizBuilder() {
  const user = await requireSession();
  if (!user) return;
  renderNavbar(user, '/create-quiz');

  const root = document.getElementById('builder-root');
  root.innerHTML = `${renderSkeleton(3)}<div style="margin-top: 1.5rem;">${renderSkeleton(5)}</div>`;

  const routeIdRaw = getRouteSegment(1);
  const quizIdParam = routeIdRaw && Number.isInteger(Number(routeIdRaw)) ? Number(routeIdRaw) : null;
  const draftStorageKey = `wkm_draft_question_${user.username}`;

  const state = {
    quiz: null,
    title: `How well do you know ${user.name.split(' ')[0]}?`,
    description: 'Answer these multiple-choice questions about me to test our friendship!',
    editingQuestionId: null,
    category: 'Favourite Food',
    questionText: '',
    options: createDefaultOptions(),
    showPreview: false,
  };

  try {
    if (quizIdParam) {
      const res = await api.quizzes.get(quizIdParam);
      state.quiz = res.quiz;
    } else {
      const listRes = await api.quizzes.listMy();
      if (listRes.quizzes.length > 0) {
        state.quiz = listRes.quizzes[0];
      }
    }

    if (state.quiz) {
      state.title = state.quiz.title;
      state.description = state.quiz.description;
    } else {
      try {
        const saved = localStorage.getItem(draftStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.questionText) state.questionText = parsed.questionText;
          if (parsed.category && QUESTION_CATEGORIES.includes(parsed.category)) {
            state.category = parsed.category;
          }
          if (Array.isArray(parsed.options) && parsed.options.length >= 4) {
            state.options = parsed.options;
          }
        }
      } catch {
        // ignore storage parse error
      }
    }
  } catch (err) {
    showToast('error', err instanceof ApiError ? err.message : 'Failed to load quiz.');
  }

  function persistDraft() {
    if (state.editingQuestionId !== null) return;
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          category: state.category,
          questionText: state.questionText,
          options: state.options,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }

  async function ensureQuizExists() {
    if (state.quiz) return state.quiz;
    const res = await api.quizzes.create({
      title: state.title.trim() || `How well do you know ${user.name.split(' ')[0]}?`,
      description: state.description.trim(),
      slug: user.username,
    });
    state.quiz = res.quiz;
    return state.quiz;
  }

  function applySuggestion(cat) {
    const sug = CATEGORY_SUGGESTIONS[cat];
    if (!sug) return;
    state.questionText = sug.question;
    state.options = sug.options.map((text, idx) => ({
      text,
      isCorrect: idx === 0,
    }));
    persistDraft();
    render();
  }

  function resetQuestionEditor() {
    state.editingQuestionId = null;
    state.questionText = '';
    state.options = createDefaultOptions();
    state.showPreview = false;
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    render();
  }

  function validateEditor() {
    if (state.questionText.trim().length < 3) {
      return 'Question text must be at least 3 characters.';
    }
    if (state.options.length < 4 || state.options.length > 5) {
      return 'Every question must have 4 or 5 options.';
    }
    const seen = new Set();
    for (let i = 0; i < state.options.length; i += 1) {
      const trimmed = state.options[i].text.trim();
      if (!trimmed) {
        return `Option ${i + 1} cannot be empty.`;
      }
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) {
        return 'Duplicate options are not allowed.';
      }
      seen.add(lower);
    }
    if (state.options.filter((o) => o.isCorrect).length !== 1) {
      return 'Select exactly one correct answer.';
    }
    return null;
  }

  function render() {
    const q = state.quiz;
    const statusLabel = q
      ? q.status === 'published'
        ? q.has_unpublished_changes
          ? 'Unpublished draft edits'
          : 'Published'
        : 'Draft'
      : 'Draft';
    const versionLabel = q ? `Version ${q.active_version_number}` : 'New Quiz';
    const publishLabel =
      q?.status === 'published' && q.has_unpublished_changes
        ? 'Publish New Version'
        : q?.status === 'published'
          ? 'Published'
          : 'Publish Quiz';

    const categoryOptionsHtml = QUESTION_CATEGORIES.map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          state.category === cat ? 'selected' : ''
        }>${escapeHtml(cat)}</option>`
    ).join('');

    const editorBodyHtml = state.showPreview
      ? `
        <div style="margin-top: 1.5rem; background-color: var(--bg-cream); border-radius: var(--radius-inner); padding: 1.25rem; border: 1.5px solid var(--border-subtle);">
          <p class="meta-line">Preview &#183; ${escapeHtml(state.category)} &#183; Select 1 answer</p>
          <h3 style="margin-top: 0.5rem; font-size: 1.25rem; font-weight: 700;">
            ${escapeHtml(state.questionText.trim() || 'Your question will appear here...')}
          </h3>
          <div class="mcq-list" style="margin-top: 1rem;">
            ${state.options
              .map(
                (opt, idx) => `
              <div class="mcq-option ${opt.isCorrect ? 'correct-preview' : ''}" style="min-height: 52px; cursor: default;">
                <span>${escapeHtml(opt.text.trim() || `Option ${idx + 1}`)}</span>
                ${
                  opt.isCorrect
                    ? '<span style="font-size: 0.75rem; font-weight: 700;">&#10003; Correct Answer</span>'
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
      : `
        <form id="question-form" style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 1.15rem;">
          <div class="category-row">
            <div>
              <label for="q-category" class="form-label-sm">Category (Optional)</label>
              <select id="q-category" class="form-select">${categoryOptionsHtml}</select>
            </div>
            <div>
              <button type="button" id="use-suggestion-btn" class="btn btn-pink" style="width: 100%;">Use Suggestion</button>
            </div>
          </div>

          <div>
            <label for="q-text" class="form-label-sm">Question Text</label>
            <input
              id="q-text"
              type="text"
              maxlength="280"
              placeholder="e.g. What is my favourite food?"
              value="${escapeHtml(state.questionText)}"
              class="form-input"
            />
          </div>

          <div>
            <div class="card-header-row" style="margin-bottom: 0.5rem;">
              <span class="form-label-sm" style="margin: 0;">Answer Options (${state.options.length}/5) &#183; Pick 1 correct answer</span>
              ${
                state.options.length < 5
                  ? '<button type="button" id="add-option-btn" class="text-link" style="font-size: 0.75rem;">+ Add Option</button>'
                  : ''
              }
            </div>
            <div id="options-editor-list" style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${state.options
                .map(
                  (opt, idx) => `
                <div class="option-editor-row">
                  <button
                    type="button"
                    class="correct-toggle-btn ${opt.isCorrect ? 'is-correct' : ''}"
                    data-correct-idx="${idx}"
                    aria-label="Mark option ${idx + 1} as correct answer"
                    title="Mark as correct answer"
                  >&#10003;</button>
                  <input
                    type="text"
                    maxlength="140"
                    placeholder="Option ${idx + 1}"
                    value="${escapeHtml(opt.text)}"
                    data-opt-idx="${idx}"
                    class="form-input ${opt.isCorrect ? 'option-correct' : ''}"
                  />
                  ${
                    state.options.length > 4
                      ? `<button type="button" class="btn-icon danger" data-remove-idx="${idx}" aria-label="Remove option ${
                          idx + 1
                        }">&#10005;</button>`
                      : ''
                  }
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
            ${
              state.editingQuestionId
                ? '<button type="button" id="cancel-edit-btn" class="btn btn-outline-soft">Cancel Edit</button>'
                : ''
            }
            <button type="submit" id="save-question-btn" class="btn btn-primary">
              ${state.editingQuestionId ? 'Save Question Changes' : 'Save Question'}
            </button>
          </div>
        </form>
      `;

    const questionsListHtml =
      !q || q.questions.length === 0
        ? `
          <div class="empty-state">
            <p class="empty-state-title">No questions added yet</p>
            <p class="empty-state-desc">Pick a category suggestion on the left or write your own prompt.</p>
          </div>
        `
        : `<div class="list-divide">${q.questions
            .map((item, idx) => {
              const correctOpt = item.options.find((o) => o.is_correct === 1);
              return `
                <div class="saved-question-item">
                  <div style="min-width: 0;">
                    <p class="meta-line">${idx + 1}. ${escapeHtml(item.category)} &#183; ${
                item.options.length
              } choices</p>
                    <p style="margin-top: 0.25rem; font-size: 0.9rem; font-weight: 700;">${escapeHtml(
                      item.question_text
                    )}</p>
                    ${
                      correctOpt
                        ? `<p style="margin-top: 0.2rem; font-size: 0.75rem; font-weight: 600; color: #1F6A41;">Answer: ${escapeHtml(
                            correctOpt.option_text
                          )}</p>`
                        : ''
                    }
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.15rem; flex-shrink: 0;">
                    <button type="button" class="btn-icon" data-move-up="${idx}" ${
                idx === 0 ? 'disabled' : ''
              } aria-label="Move question up">&#8593;</button>
                    <button type="button" class="btn-icon" data-move-down="${idx}" ${
                idx === q.questions.length - 1 ? 'disabled' : ''
              } aria-label="Move question down">&#8595;</button>
                    <button type="button" class="btn btn-sm btn-lavender" data-edit-qid="${
                      item.id
                    }" style="min-height: 32px; padding: 0.2rem 0.65rem;">Edit</button>
                    <button type="button" class="btn-icon danger" data-del-qid="${
                      item.id
                    }" aria-label="Delete question">&#10005;</button>
                  </div>
                </div>
              `;
            })
            .join('')}</div>`;

    root.innerHTML = `
      <div class="builder-header">
        <div>
          <p class="meta-line">Quiz Builder &#183; ${escapeHtml(versionLabel)} &#183; ${escapeHtml(
      statusLabel
    )}</p>
          <h1 class="dashboard-heading">Craft your personal quiz</h1>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          ${
            q && q.status === 'published'
              ? `<a href="/quiz/${encodeURIComponent(
                  q.slug
                )}" class="btn btn-outline-soft">View Public Quiz</a>`
              : ''
          }
          <button type="button" id="publish-quiz-btn" class="btn btn-primary" ${
            !q || q.question_count === 0 ? 'disabled' : ''
          }>${escapeHtml(publishLabel)}</button>
        </div>
      </div>

      ${
        q?.status === 'published' && q.has_unpublished_changes
          ? `<div class="card-lavender" style="margin-top: 1.25rem; padding: 0.9rem 1.25rem; font-size: 0.875rem; color: #452882;">
               You are editing a new draft version (v${q.active_version_number}). Friends taking your quiz still see the live published version until you click <strong>Publish New Version</strong>.
             </div>`
          : ''
      }

      <div class="builder-grid">
        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">${
              state.editingQuestionId ? 'Edit Question' : 'Add Multiple-Choice Question'
            }</h2>
            <button type="button" id="toggle-preview-btn" class="btn btn-sm btn-lavender">
              ${state.showPreview ? 'Back to Editor' : 'Preview Question'}
            </button>
          </div>
          ${editorBodyHtml}
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <form id="quiz-meta-form" class="card" style="display: flex; flex-direction: column; gap: 1rem;">
            <h2 class="card-title">Quiz Details</h2>
            <div>
              <label for="quiz-title-input" class="form-label-sm">Quiz Title</label>
              <input id="quiz-title-input" type="text" maxlength="120" value="${escapeHtml(
                state.title
              )}" class="form-input" />
            </div>
            <div>
              <label for="quiz-desc-input" class="form-label-sm">Introduction for Friends</label>
              <textarea id="quiz-desc-input" maxlength="400" class="form-textarea">${escapeHtml(
                state.description
              )}</textarea>
            </div>
            <button type="submit" id="save-meta-btn" class="btn btn-ghost" style="align-self: flex-start;">
              ${q ? 'Update Details' : 'Create Quiz'}
            </button>
          </form>

          <div class="card">
            <div class="card-header-row">
              <h2 class="card-title">Your Questions (${q ? q.questions.length : 0})</h2>
              <span class="meta-line">MCQ only</span>
            </div>
            ${questionsListHtml}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('toggle-preview-btn').addEventListener('click', () => {
      state.showPreview = !state.showPreview;
      render();
    });

    const publishBtn = document.getElementById('publish-quiz-btn');
    publishBtn.addEventListener('click', async () => {
      if (!state.quiz) return;
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publishing...';
      try {
        const res = await api.quizzes.publish(state.quiz.id);
        state.quiz = res.quiz;
        showToast('success', 'Your quiz is published and ready to share!');
        render();
      } catch (err) {
        showToast('error', err instanceof ApiError ? err.message : 'Could not publish quiz.');
        publishBtn.disabled = false;
        render();
      }
    });

    const titleInput = document.getElementById('quiz-title-input');
    const descInput = document.getElementById('quiz-desc-input');
    titleInput.addEventListener('input', () => {
      state.title = titleInput.value;
    });
    descInput.addEventListener('input', () => {
      state.description = descInput.value;
    });

    document.getElementById('quiz-meta-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.title.trim()) {
        showToast('error', 'Quiz title cannot be empty.');
        return;
      }
      const btn = document.getElementById('save-meta-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        if (!state.quiz) {
          await ensureQuizExists();
          showToast('success', 'Quiz created! Now add your questions.');
        } else {
          const res = await api.quizzes.update(state.quiz.id, {
            title: state.title.trim(),
            description: state.description.trim(),
          });
          state.quiz = res.quiz;
          showToast('success', 'Quiz details updated.');
        }
        render();
      } catch (err) {
        showToast('error', err instanceof ApiError ? err.message : 'Could not save quiz details.');
        btn.disabled = false;
        render();
      }
    });

    if (!state.showPreview) {
      const catSelect = document.getElementById('q-category');
      catSelect.addEventListener('change', () => {
        state.category = catSelect.value;
        if (!state.questionText.trim() && state.options.every((o) => !o.text.trim())) {
          applySuggestion(state.category);
        } else {
          persistDraft();
        }
      });

      document.getElementById('use-suggestion-btn').addEventListener('click', () => {
        applySuggestion(state.category);
      });

      const qInput = document.getElementById('q-text');
      qInput.addEventListener('input', () => {
        state.questionText = qInput.value;
        persistDraft();
      });

      const addOptBtn = document.getElementById('add-option-btn');
      if (addOptBtn) {
        addOptBtn.addEventListener('click', () => {
          if (state.options.length < 5) {
            state.options.push({ text: '', isCorrect: false });
            persistDraft();
            render();
          }
        });
      }

      document.querySelectorAll('[data-opt-idx]').forEach((input) => {
        input.addEventListener('input', () => {
          const idx = Number(input.getAttribute('data-opt-idx'));
          state.options[idx].text = input.value;
          persistDraft();
        });
      });

      document.querySelectorAll('[data-correct-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-correct-idx'));
          state.options = state.options.map((o, i) => ({ ...o, isCorrect: i === idx }));
          persistDraft();
          render();
        });
      });

      document.querySelectorAll('[data-remove-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-remove-idx'));
          if (state.options.length <= 4) return;
          state.options = state.options.filter((_, i) => i !== idx);
          if (!state.options.some((o) => o.isCorrect)) {
            state.options[0].isCorrect = true;
          }
          persistDraft();
          render();
        });
      });

      const cancelEditBtn = document.getElementById('cancel-edit-btn');
      if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetQuestionEditor);
      }

      document.getElementById('question-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errMsg = validateEditor();
        if (errMsg) {
          showToast('error', errMsg);
          return;
        }
        const saveBtn = document.getElementById('save-question-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          const activeQuiz = await ensureQuizExists();
          const payload = {
            question_text: state.questionText.trim(),
            category: state.category,
            options: state.options.map((o) => ({
              option_text: o.text.trim(),
              is_correct: o.isCorrect ? 1 : 0,
            })),
          };
          const res = state.editingQuestionId
            ? await api.quizzes.updateQuestion(state.editingQuestionId, payload)
            : await api.quizzes.addQuestion(activeQuiz.id, payload);

          state.quiz = res.quiz;
          showToast('success', state.editingQuestionId ? 'Question updated!' : 'Question added to quiz!');
          resetQuestionEditor();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Failed to save question.');
          saveBtn.disabled = false;
          saveBtn.textContent = state.editingQuestionId ? 'Save Question Changes' : 'Save Question';
        }
      });
    }

    document.querySelectorAll('[data-edit-qid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qid = Number(btn.getAttribute('data-edit-qid'));
        const item = state.quiz.questions.find((x) => x.id === qid);
        if (!item) return;
        state.editingQuestionId = item.id;
        state.category = QUESTION_CATEGORIES.includes(item.category) ? item.category : 'Custom';
        state.questionText = item.question_text;
        state.options = item.options.map((o) => ({
          text: o.option_text,
          isCorrect: o.is_correct === 1,
        }));
        state.showPreview = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      });
    });

    document.querySelectorAll('[data-move-up]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-move-up'));
        if (idx <= 0) return;
        const reordered = [...state.quiz.questions];
        const [moved] = reordered.splice(idx, 1);
        reordered.splice(idx - 1, 0, moved);
        try {
          const res = await api.quizzes.reorderQuestions(
            state.quiz.id,
            reordered.map((x) => x.id)
          );
          state.quiz = res.quiz;
          showToast('info', 'Question order updated.');
          render();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Could not reorder questions.');
        }
      });
    });

    document.querySelectorAll('[data-move-down]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-move-down'));
        if (idx >= state.quiz.questions.length - 1) return;
        const reordered = [...state.quiz.questions];
        const [moved] = reordered.splice(idx, 1);
        reordered.splice(idx + 1, 0, moved);
        try {
          const res = await api.quizzes.reorderQuestions(
            state.quiz.id,
            reordered.map((x) => x.id)
          );
          state.quiz = res.quiz;
          showToast('info', 'Question order updated.');
          render();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Could not reorder questions.');
        }
      });
    });

    document.querySelectorAll('[data-del-qid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qid = Number(btn.getAttribute('data-del-qid'));
        const item = state.quiz.questions.find((x) => x.id === qid);
        if (!item) return;

        openConfirmModal({
          title: 'Delete this question?',
          message: `Are you sure you want to remove "${item.question_text}" from your quiz?`,
          confirmLabel: 'Delete Question',
          destructive: true,
          onConfirm: async () => {
            const res = await api.quizzes.deleteQuestion(item.id);
            state.quiz = res.quiz;
            if (state.editingQuestionId === item.id) {
              resetQuestionEditor();
            } else {
              render();
            }
            showToast('success', 'Question removed.');
          },
        });
      });
    });
  }

  render();
}

initQuizBuilder();
