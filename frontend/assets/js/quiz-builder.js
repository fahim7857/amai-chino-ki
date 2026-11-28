import { api, ApiError } from './api.js';
import {
  BILINGUAL_SUGGESTIONS,
  CATEGORY_LABELS,
  CATEGORY_SUGGESTIONS,
  convertSuggestion,
  getCategorySuggestion,
  QUESTION_CATEGORIES,
} from './suggestions.js';
import {
  BASE_PATH,
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
  renderNavbar(user, '/quiz');

  const root = document.getElementById('builder-root');
  root.innerHTML = `${renderSkeleton(2)}<div style="margin-top: 1.25rem;">${renderSkeleton(4)}</div>`;

  const routeIdRaw = getRouteSegment(1);
  const quizIdParam = routeIdRaw && Number.isInteger(Number(routeIdRaw)) ? Number(routeIdRaw) : null;
  const draftStorageKey = `wkm_draft_question_${user.username}`;
  const langStorageKey = `wkm_suggestion_lang_${user.username}`;

  let savedLang = 'en';
  try {
    savedLang = localStorage.getItem(langStorageKey) || 'en';
  } catch {
    savedLang = 'en';
  }

  const state = {
    quiz: null,
    title: `How well do you know ${user.name.split(' ')[0]}?`,
    description: '',
    editingQuestionId: null,
    category: 'Favourite Food',
    lang: savedLang === 'bn' ? 'bn' : 'en',
    questionText: '',
    options: createDefaultOptions(),
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
      state.description = state.quiz.description || '';
    } else {
      try {
        const saved = localStorage.getItem(draftStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.questionText) state.questionText = parsed.questionText;
          if (parsed.category && QUESTION_CATEGORIES.includes(parsed.category)) {
            state.category = parsed.category;
          }
          if (parsed.lang && (parsed.lang === 'bn' || parsed.lang === 'en')) {
            state.lang = parsed.lang;
          }
          if (Array.isArray(parsed.options) && parsed.options.length >= 4) {
            state.options = parsed.options;
          }
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    showToast('error', err instanceof ApiError ? err.message : 'Could not load quiz.');
  }

  function persistDraft() {
    if (state.editingQuestionId !== null) return;
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          category: state.category,
          lang: state.lang,
          questionText: state.questionText,
          options: state.options,
        })
      );
    } catch {
      // ignore
    }
  }

  async function ensureQuizExists() {
    if (state.quiz) return state.quiz;
    const res = await api.quizzes.create({
      title: state.title.trim() || `Quiz by ${user.name.split(' ')[0]}`,
      description: state.description.trim(),
      slug: user.username,
    });
    state.quiz = res.quiz;
    return state.quiz;
  }

  function applySuggestion(cat, targetLang = state.lang) {
    const sug = getCategorySuggestion(cat, targetLang);
    if (!sug) return;
    state.questionText = sug.question;
    state.options = sug.options.map((text, idx) => ({
      text,
      isCorrect: idx === 0,
    }));
    persistDraft();
    render();
  }

  function switchSuggestionLanguage(newLang) {
    if (state.lang === newLang) return;
    state.lang = newLang;
    try {
      localStorage.setItem(langStorageKey, newLang);
    } catch {
      // ignore
    }

    // Identify if current question or category can be converted automatically
    let detectedCategory = state.category;
    let matchedCorrectIndex = state.options.findIndex((o) => o.isCorrect);
    if (matchedCorrectIndex < 0) matchedCorrectIndex = 0;

    // Check if the current question matches any known category in either language
    for (const [catName, bilingual] of Object.entries(BILINGUAL_SUGGESTIONS)) {
      if (
        state.questionText === bilingual.en.question ||
        state.questionText === bilingual.bn.question
      ) {
        detectedCategory = catName;
        state.category = catName;
        break;
      }
    }

    const targetSug = getCategorySuggestion(detectedCategory, newLang);
    if (targetSug) {
      state.questionText = targetSug.question;
      state.options = targetSug.options.map((text, idx) => ({
        text,
        isCorrect: idx === matchedCorrectIndex,
      }));
    }

    persistDraft();
    render();
  }

  function resetQuestionEditor() {
    state.editingQuestionId = null;
    state.questionText = '';
    state.options = createDefaultOptions();
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    render();
  }

  function validateEditor() {
    if (state.questionText.trim().length < 1) {
      return 'Please enter a question.';
    }
    if (state.options.length < 4 || state.options.length > 5) {
      return '4 or 5 options required.';
    }
    for (let i = 0; i < state.options.length; i += 1) {
      if (!state.options[i].text.trim()) {
        return `Option ${i + 1} is empty.`;
      }
    }
    if (state.options.filter((o) => o.isCorrect).length !== 1) {
      return 'Select 1 correct answer (click the green checkmark).';
    }
    return null;
  }

  function render() {
    const q = state.quiz;
    const isLive = q && q.status === 'published';
    const statusBadge = isLive
      ? '<span style="color: #137333; font-weight: 700;">Live ✅</span>'
      : '<span style="color: #B06000; font-weight: 700;">Draft 📝</span>';

    const labels = CATEGORY_LABELS[state.lang] || CATEGORY_LABELS.en;
    const categoryOptionsHtml = QUESTION_CATEGORIES.map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          state.category === cat ? 'selected' : ''
        }>${escapeHtml(labels[cat] || cat)}</option>`
    ).join('');

    const editorBodyHtml = `
      <form id="question-form" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
        <div class="category-row" style="display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 1 1 200px; min-width: 0;">
            <label for="q-category" class="form-label-sm">Topic / বিষয়</label>
            <select id="q-category" class="form-select">${categoryOptionsHtml}</select>
          </div>

          <div style="flex-shrink: 0;">
            <label class="form-label-sm" style="display: block; margin-bottom: 0.35rem;">Suggestion Language</label>
            <div class="lang-switch-group" style="display: inline-flex; border-radius: 999px; background: #F1F3F4; padding: 3px; gap: 3px; border: 1px solid #E0E0E0;">
              <button
                type="button"
                id="lang-btn-en"
                class="lang-pill-btn ${state.lang === 'en' ? 'active' : ''}"
                style="border: none; border-radius: 999px; padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; ${
                  state.lang === 'en' ? 'background: #6C5CE7; color: #fff; box-shadow: 0 2px 4px rgba(108,92,231,0.3);' : 'background: transparent; color: #555;'
                }"
              >English</button>
              <button
                type="button"
                id="lang-btn-bn"
                class="lang-pill-btn ${state.lang === 'bn' ? 'active' : ''}"
                style="border: none; border-radius: 999px; padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; ${
                  state.lang === 'bn' ? 'background: #6C5CE7; color: #fff; box-shadow: 0 2px 4px rgba(108,92,231,0.3);' : 'background: transparent; color: #555;'
                }"
              >বাংলা</button>
            </div>
          </div>

          <div style="flex-shrink: 0;">
            <button type="button" id="use-suggestion-btn" class="btn btn-pink" style="min-height: 44px;">✨ Suggest</button>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.25rem;">
            <label for="q-text" class="form-label-sm" style="margin: 0;">Question (Emojis & Symbols Allowed ✨)</label>
            <div class="emoji-toolbar" id="emoji-toolbar">
              <button type="button" class="btn-emoji" data-emoji="😊" title="Smile">😊</button>
              <button type="button" class="btn-emoji" data-emoji="😂" title="Laugh">😂</button>
              <button type="button" class="btn-emoji" data-emoji="❤️" title="Heart">❤️</button>
              <button type="button" class="btn-emoji" data-emoji="🔥" title="Fire">🔥</button>
              <button type="button" class="btn-emoji" data-emoji="✨" title="Sparkles">✨</button>
              <button type="button" class="btn-emoji" data-emoji="🎉" title="Party">🎉</button>
              <button type="button" class="btn-emoji" data-emoji="🍕" title="Pizza">🍕</button>
              <button type="button" class="btn-emoji" data-emoji="⭐" title="Star">⭐</button>
              <button type="button" class="btn-emoji" data-emoji="❓" title="Question">❓</button>
              <button type="button" class="btn-emoji" data-emoji="🤔" title="Thinking">🤔</button>
            </div>
          </div>
          <input
            id="q-text"
            type="text"
            maxlength="280"
            placeholder="${
              state.lang === 'bn'
                ? 'প্রশ্নটি এখানে লিখুন (যেমন: আমার সবচেয়ে প্রিয় খাবার কোনটি? 🍕❤️)'
                : 'Write question here (e.g. What is my favorite food? 🍕❤️)'
            }"
            value="${escapeHtml(state.questionText)}"
            class="form-input"
            required
          />
        </div>

        <div>
          <div class="card-header-row" style="margin-bottom: 0.5rem;">
            <span class="form-label-sm" style="margin: 0;">Options (Click ✓ for Correct Answer)</span>
            ${
              state.options.length < 5
                ? '<button type="button" id="add-option-btn" class="text-link" style="font-size: 0.8rem; font-weight: 700;">+ Option</button>'
                : ''
            }
          </div>
          <div id="options-editor-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${state.options
              .map(
                (opt, idx) => `
              <div class="option-editor-row">
                <button
                  type="button"
                  class="correct-toggle-btn ${opt.isCorrect ? 'is-correct' : ''}"
                  data-correct-idx="${idx}"
                  aria-label="Mark option ${idx + 1} as correct"
                  title="Mark as correct"
                >✓</button>
                <input
                  type="text"
                  maxlength="140"
                  placeholder="${state.lang === 'bn' ? `অপশন ${idx + 1}` : `Option ${idx + 1}`}"
                  value="${escapeHtml(opt.text)}"
                  data-opt-idx="${idx}"
                  class="form-input ${opt.isCorrect ? 'option-correct' : ''}"
                  required
                />
                ${
                  state.options.length > 4
                    ? `<button type="button" class="btn-icon danger" data-remove-idx="${idx}" aria-label="Remove option">✕</button>`
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;">
          ${
            state.editingQuestionId
              ? '<button type="button" id="cancel-edit-btn" class="btn btn-outline-soft">Cancel</button>'
              : ''
          }
          <button type="submit" id="save-question-btn" class="btn btn-primary">
            ${state.editingQuestionId ? '💾 Update' : '➕ Add Question'}
          </button>
        </div>
      </form>
    `;

    const questionsListHtml =
      !q || q.questions.length === 0
        ? `
          <div class="empty-state">
            <p class="empty-state-title">No questions yet</p>
            <p class="empty-state-desc">Add your first question on the left!</p>
          </div>
        `
        : `<div class="list-divide">${q.questions
            .map((item, idx) => {
              const correctOpt = item.options.find((o) => o.is_correct === 1);
              return `
                <div class="saved-question-item">
                  <div style="min-width: 0;">
                    <p class="meta-line">${idx + 1}. ${escapeHtml(item.category)}</p>
                    <p style="margin-top: 0.2rem; font-size: 0.95rem; font-weight: 700;">${escapeHtml(
                      item.question_text
                    )}</p>
                    ${
                      correctOpt
                        ? `<p style="margin-top: 0.15rem; font-size: 0.8rem; font-weight: 700; color: #137333;">✓ ${escapeHtml(
                            correctOpt.option_text
                          )}</p>`
                        : ''
                    }
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0;">
                    <button type="button" class="btn btn-sm btn-lavender" data-edit-qid="${
                      item.id
                    }" style="min-height: 32px; padding: 0.2rem 0.65rem;">✏️ Edit</button>
                    <button type="button" class="btn-icon danger" data-del-qid="${
                      item.id
                    }" aria-label="Delete question">✕</button>
                  </div>
                </div>
              `;
            })
            .join('')}</div>`;

    root.innerHTML = `
      <!-- Search Any User's Exam -->
      <section class="search-user-card">
        <div class="search-user-header">
          <span class="search-user-icon">🔍</span>
          <h2 class="search-user-title">Play Friend's Exam</h2>
        </div>
        <form id="search-quiz-form-builder" class="search-user-form">
          <div class="input-prefix-wrap search-input-wrap">
            <span class="input-prefix">@</span>
            <input
              id="search-username-input-builder"
              type="text"
              placeholder="Username (e.g. fahim)"
              autocomplete="off"
              class="form-input input-with-prefix"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary search-play-btn">
            <span>Play Exam</span>
            <span aria-hidden="true">🎮</span>
          </button>
        </form>
      </section>

      <!-- Quiz Header -->
      <div class="builder-header">
        <div>
          <p class="meta-line">${statusBadge}</p>
          <h1 class="dashboard-heading">✏️ My Quiz</h1>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          ${
            isLive
              ? `<a href="${BASE_PATH}/quiz/${encodeURIComponent(
                  q.slug
                )}" class="btn btn-outline-soft">🔗 View Quiz</a>`
              : ''
          }
          <button type="button" id="publish-quiz-btn" class="btn btn-primary" ${
            !q || q.question_count === 0 ? 'disabled' : ''
          }>🚀 Publish</button>
        </div>
      </div>

      <div class="builder-grid">
        <!-- Question Editor -->
        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">${
              state.editingQuestionId ? '✏️ Edit Question' : '➕ Add Question'
            }</h2>
          </div>
          ${editorBodyHtml}
        </div>

        <!-- Quiz Details & Questions List -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <form id="quiz-meta-form" class="card" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <h2 class="card-title">Quiz Name</h2>
            <div style="display: flex; gap: 0.5rem; align-items: stretch;">
              <input id="quiz-title-input" type="text" maxlength="120" value="${escapeHtml(
                state.title
              )}" class="form-input" placeholder="Quiz Title" required />
              <button type="submit" id="save-meta-btn" class="btn btn-primary" style="flex-shrink: 0;">
                💾 Save
              </button>
            </div>
          </form>

          <div class="card">
            <div class="card-header-row">
              <h2 class="card-title">📋 Questions (${q ? q.questions.length : 0})</h2>
            </div>
            ${questionsListHtml}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Search friend's exam
    const searchForm = document.getElementById('search-quiz-form-builder');
    const searchInput = document.getElementById('search-username-input-builder');
    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const targetUser = searchInput.value.trim().toLowerCase().replace(/^@+/, '');
        if (!targetUser) return;
        window.location.href = `${BASE_PATH}/quiz/${encodeURIComponent(targetUser)}`;
      });
    }

    const publishBtn = document.getElementById('publish-quiz-btn');
    if (publishBtn) {
      publishBtn.addEventListener('click', async () => {
        if (!state.quiz) return;
        publishBtn.disabled = true;
        publishBtn.textContent = 'Publishing...';
        try {
          const res = await api.quizzes.publish(state.quiz.id);
          state.quiz = res.quiz;
          showToast('success', 'Quiz published! 🚀');
          render();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Could not publish.');
          publishBtn.disabled = false;
          render();
        }
      });
    }

    const titleInput = document.getElementById('quiz-title-input');
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        state.title = titleInput.value;
      });
    }

    const metaForm = document.getElementById('quiz-meta-form');
    if (metaForm) {
      metaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.title.trim()) {
          showToast('error', 'Enter a quiz title.');
          return;
        }
        const btn = document.getElementById('save-meta-btn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
          if (!state.quiz) {
            await ensureQuizExists();
            showToast('success', 'Quiz created! 🚀');
          } else {
            const res = await api.quizzes.update(state.quiz.id, {
              title: state.title.trim(),
              description: state.description.trim(),
            });
            state.quiz = res.quiz;
            showToast('success', 'Saved! ✅');
          }
          render();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Could not save.');
          btn.disabled = false;
          render();
        }
      });
    }

    // Language pills (English / বাংলা)
    const langBtnEn = document.getElementById('lang-btn-en');
    const langBtnBn = document.getElementById('lang-btn-bn');
    if (langBtnEn) {
      langBtnEn.addEventListener('click', () => switchSuggestionLanguage('en'));
    }
    if (langBtnBn) {
      langBtnBn.addEventListener('click', () => switchSuggestionLanguage('bn'));
    }

    const catSelect = document.getElementById('q-category');
    if (catSelect) {
      catSelect.addEventListener('change', () => {
        state.category = catSelect.value;
        if (!state.questionText.trim() && state.options.every((o) => !o.text.trim())) {
          applySuggestion(state.category, state.lang);
        } else {
          // If the question currently matches another suggestion, automatically update it to new category
          applySuggestion(state.category, state.lang);
        }
      });
    }

    const sugBtn = document.getElementById('use-suggestion-btn');
    if (sugBtn) {
      sugBtn.addEventListener('click', () => {
        applySuggestion(state.category, state.lang);
      });
    }

    const qInput = document.getElementById('q-text');
    if (qInput) {
      qInput.addEventListener('input', () => {
        state.questionText = qInput.value;
        persistDraft();
      });
    }

    document.querySelectorAll('.btn-emoji').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (!emoji || !qInput) return;
        const start = qInput.selectionStart ?? qInput.value.length;
        const end = qInput.selectionEnd ?? qInput.value.length;
        const val = qInput.value;
        qInput.value = val.slice(0, start) + emoji + val.slice(end);
        state.questionText = qInput.value;
        persistDraft();
        qInput.focus();
        const nextPos = start + emoji.length;
        qInput.setSelectionRange(nextPos, nextPos);
      });
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

    const qForm = document.getElementById('question-form');
    if (qForm) {
      qForm.addEventListener('submit', async (e) => {
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
          showToast('success', state.editingQuestionId ? 'Updated! ✅' : 'Added! ✅');
          resetQuestionEditor();
        } catch (err) {
          showToast('error', err instanceof ApiError ? err.message : 'Failed to save.');
          saveBtn.disabled = false;
          saveBtn.textContent = state.editingQuestionId ? '💾 Update' : '➕ Add Question';
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
        render();
      });
    });

    document.querySelectorAll('[data-del-qid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qid = Number(btn.getAttribute('data-del-qid'));
        const item = state.quiz.questions.find((x) => x.id === qid);
        if (!item) return;

        openConfirmModal({
          title: 'Delete Question?',
          message: `Remove "${item.question_text}"?`,
          confirmLabel: 'Delete',
          destructive: true,
          onConfirm: async () => {
            const res = await api.quizzes.deleteQuestion(item.id);
            state.quiz = res.quiz;
            if (state.editingQuestionId === item.id) {
              resetQuestionEditor();
            } else {
              render();
            }
            showToast('success', 'Deleted. 🗑️');
          },
        });
      });
    });
  }

  render();
}

initQuizBuilder();
