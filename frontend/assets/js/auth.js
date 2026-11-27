import { api, ApiError } from './api.js';
import { BASE_PATH, getCurrentUser, getQueryParam, renderNavbar } from './ui.js';

const pageType = document.body.getAttribute('data-auth-page');
const redirectParam = getQueryParam('redirect');

function showError(msg) {
  const box = document.getElementById('auth-error');
  if (!box) return;
  if (!msg) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.textContent = msg;
  box.classList.remove('hidden');
}

function wirePasswordToggle(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input || !btn) return;

  btn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

function redirectAfterAuth() {
  if (redirectParam && redirectParam.startsWith('/')) {
    const target = redirectParam.startsWith(BASE_PATH)
      ? redirectParam
      : `${BASE_PATH}${redirectParam}`;
    window.location.href = target;
  } else {
    window.location.href = `${BASE_PATH}/`;
  }
}

async function initAuthPage() {
  const user = await getCurrentUser();
  if (user) {
    redirectAfterAuth();
    return;
  }

  renderNavbar(null, window.location.pathname);

  if (pageType === 'login') {
    const switchLink = document.getElementById('switch-to-register');
    if (switchLink && redirectParam) {
      switchLink.href = `${BASE_PATH}/register?redirect=${encodeURIComponent(redirectParam)}`;
    }

    wirePasswordToggle('login-password', 'toggle-password-btn');

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');

    usernameInput.addEventListener('input', () => {
      usernameInput.value = usernameInput.value.toLowerCase().replace(/\s+/g, '');
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';

      try {
        await api.auth.login({
          username: usernameInput.value.trim().toLowerCase(),
          password: passwordInput.value,
        });
        redirectAfterAuth();
      } catch (err) {
        showError(err instanceof ApiError ? err.message : 'Invalid username or password.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
      }
    });
  } else if (pageType === 'register') {
    const switchLink = document.getElementById('switch-to-login');
    if (switchLink && redirectParam) {
      switchLink.href = `${BASE_PATH}/login?redirect=${encodeURIComponent(redirectParam)}`;
    }

    wirePasswordToggle('reg-password', 'toggle-password-btn');

    const nameInput = document.getElementById('reg-name');
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const usernameHint = document.getElementById('username-hint');
    const submitBtn = document.getElementById('register-submit-btn');

    let usernameTaken = false;
    let checkTimer = null;

    usernameInput.addEventListener('input', () => {
      const cleaned = usernameInput.value.toLowerCase().replace(/\s+/g, '');
      usernameInput.value = cleaned;

      if (checkTimer) clearTimeout(checkTimer);

      if (!cleaned) {
        usernameHint.classList.add('hidden');
        usernameTaken = false;
        return;
      }

      if (!/^[a-z0-9_]{3,24}$/.test(cleaned)) {
        usernameHint.classList.remove('hidden', 'ok', 'muted');
        usernameHint.classList.add('error');
        usernameHint.textContent = 'Use 3–24 letters, numbers, or _';
        usernameTaken = false;
        return;
      }

      usernameHint.classList.remove('hidden', 'ok', 'error');
      usernameHint.classList.add('muted');
      usernameHint.textContent = 'Checking...';

      checkTimer = setTimeout(async () => {
        try {
          const res = await api.auth.checkUsername(cleaned);
          if (res.available) {
            usernameTaken = false;
            usernameHint.classList.remove('muted', 'error');
            usernameHint.classList.add('ok');
            usernameHint.textContent = `@${res.username} is available`;
          } else {
            usernameTaken = true;
            usernameHint.classList.remove('muted', 'ok');
            usernameHint.classList.add('error');
            usernameHint.textContent = `@${res.username} taken`;
          }
        } catch {
          usernameHint.classList.add('hidden');
        }
      }, 280);
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');

      const name = nameInput.value.trim();
      const username = usernameInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (!name) {
        showError('Please enter your name.');
        return;
      }
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        showError('Username must be 3-24 characters.');
        return;
      }
      if (usernameTaken) {
        showError('Username already taken.');
        return;
      }
      if (password.length < 6) {
        showError('Password min 6 characters.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait...';

      try {
        await api.auth.register({ name, username, password });
        redirectAfterAuth();
      } catch (err) {
        showError(err instanceof ApiError ? err.message : 'Registration failed.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
      }
    });
  }
}

initAuthPage();
