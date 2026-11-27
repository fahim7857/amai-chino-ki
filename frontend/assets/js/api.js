export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE_PATH = '/bondhu';

function withBase(url) {
  if (url.startsWith(BASE_PATH + '/') || url === BASE_PATH) return url;
  return url.startsWith('/') ? `${BASE_PATH}${url}` : url;
}

async function request(url, options = {}) {
  const res = await fetch(withBase(url), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error || 'Something went wrong. Please try again.',
      res.status,
      data.code || 'API_ERROR'
    );
  }
  return data;
}

export const api = {
  auth: {
    me: () => request('/api/auth/me'),
    checkUsername: (username) =>
      request(`/api/auth/check-username?username=${encodeURIComponent(username)}`),
    register: (payload) =>
      request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    login: (payload) =>
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    logout: () =>
      request('/api/auth/logout', {
        method: 'POST',
      }),
    uploadProfilePicture: (image) =>
      request('/api/auth/profile-picture', {
        method: 'POST',
        body: JSON.stringify({ image }),
      }),
  },
  quizzes: {
    listMy: () => request('/api/quizzes/my'),
    get: (id) => request(`/api/quizzes/${id}`),
    create: (payload) =>
      request('/api/quizzes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id, payload) =>
      request(`/api/quizzes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id) =>
      request(`/api/quizzes/${id}`, {
        method: 'DELETE',
      }),
    publish: (id) =>
      request(`/api/quizzes/${id}/publish`, {
        method: 'POST',
      }),
    addQuestion: (quizId, payload) =>
      request(`/api/quizzes/${quizId}/questions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    updateQuestion: (questionId, payload) =>
      request(`/api/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    deleteQuestion: (questionId) =>
      request(`/api/questions/${questionId}`, {
        method: 'DELETE',
      }),
    reorderQuestions: (quizId, orderedQuestionIds) =>
      request(`/api/quizzes/${quizId}/questions/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ orderedQuestionIds }),
      }),
  },
  public: {
    getQuiz: (slug) => request(`/api/public/quiz/${encodeURIComponent(slug)}`),
    submitQuiz: (slug, answers) =>
      request(`/api/public/quiz/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    getLeaderboard: (slug) => request(`/api/public/quiz/${encodeURIComponent(slug)}/leaderboard`),
    getSubmission: (id) => request(`/api/submissions/${id}`),
    getDashboardStats: () => request('/api/dashboard/stats'),
    updateSettings: (leaderboard_visibility) =>
      request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ leaderboard_visibility }),
      }),
    getUserProfile: (username) => request(`/api/users/${encodeURIComponent(username)}`),
  },
};
