import { AppError } from './errors.js';

// Username: ONLY lowercase letters, numbers, and underscores (NO emojis, NO symbols)
export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export const QUESTION_CATEGORIES = [
  'Favourite Food',
  'Favourite Color',
  'Favourite Flower',
  'Favourite Movie',
  'Favourite Actor',
  'Favourite Singer',
  'Favourite Hobby',
  'Favourite Place',
  'Favourite Sport',
  'Favourite Season',
  'Favourite Animal',
  'Dream Destination',
  'Personality',
  'Lifestyle',
  'Custom',
];

export function normalizeUsername(raw) {
  if (typeof raw !== 'string') {
    throw new AppError('Username is required', 400, 'INVALID_USERNAME');
  }
  const normalized = raw.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    throw new AppError(
      'Username must be 3–24 characters using only lowercase letters, numbers, or underscores (no emojis or symbols allowed).',
      400,
      'INVALID_USERNAME'
    );
  }
  return normalized;
}

export function validateName(raw) {
  if (typeof raw !== 'string') {
    throw new AppError('Name is required', 400, 'INVALID_NAME');
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new AppError('Name must be between 1 and 80 characters.', 400, 'INVALID_NAME');
  }
  return trimmed;
}

export function validatePassword(raw) {
  if (typeof raw !== 'string') {
    throw new AppError('Password is required', 400, 'INVALID_PASSWORD');
  }
  if (raw.length < 6 || raw.length > 128) {
    throw new AppError('Password must be at least 6 characters long.', 400, 'INVALID_PASSWORD');
  }
  return raw;
}

export function validateQuestionPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Question payload is required.', 400, 'INVALID_QUESTION');
  }

  // Question text supports any unicode character including emojis and special symbols
  const rawText = typeof body.question_text === 'string' ? body.question_text.trim() : '';
  if (rawText.length < 1 || rawText.length > 280) {
    throw new AppError('Question text must be between 1 and 280 characters.', 400, 'INVALID_QUESTION');
  }

  const rawCategory =
    typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Custom';

  const rawOptions = Array.isArray(body.options) ? body.options : [];
  if (rawOptions.length < 4 || rawOptions.length > 5) {
    throw new AppError('Every question must have 4 or 5 answer options.', 400, 'INVALID_OPTIONS');
  }

  const seenTexts = new Set();
  let correctCount = 0;

  const validatedOptions = rawOptions.map((opt, idx) => {
    const optObj = opt && typeof opt === 'object' ? opt : {};
    const text = typeof optObj.option_text === 'string' ? optObj.option_text.trim() : '';
    if (text.length < 1 || text.length > 140) {
      throw new AppError(
        `Option ${idx + 1} cannot be empty or exceed 140 characters.`,
        400,
        'INVALID_OPTIONS'
      );
    }
    const dedupeKey = text.toLowerCase();
    if (seenTexts.has(dedupeKey)) {
      throw new AppError(
        'Duplicate answer options are not allowed in the same question.',
        400,
        'DUPLICATE_OPTIONS'
      );
    }
    seenTexts.add(dedupeKey);

    const isCorrect = optObj.is_correct === true || optObj.is_correct === 1 ? 1 : 0;
    if (isCorrect === 1) {
      correctCount += 1;
    }

    return {
      option_text: text,
      is_correct: isCorrect,
      option_order: idx + 1,
    };
  });

  if (correctCount !== 1) {
    throw new AppError('Every question must have exactly one correct answer.', 400, 'INVALID_CORRECT_OPTION');
  }

  return {
    question_text: rawText,
    category: rawCategory,
    options: validatedOptions,
  };
}

export function slugify(input) {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'quiz';
}
