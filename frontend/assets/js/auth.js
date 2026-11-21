import { api, ApiError } from './api.js';
import { getCurrentUser, getQueryParam, renderNavbar } from './ui.js';

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
    btn.textContent = isHidden ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

function redirectAfterAuth() {
  if (redirectParam && redirectParam.startsWith('/')) {
    window.location.href = redirectParam;
  } else {
    window.location.href = '/dashboard';
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
    const subtitle = document.getElementById('login-subtitle');
    if (subtitle && redirectParam) {
      subtitle.textContent = 'Log in with your username to continue to the quiz.';
    }
    const switchLink = document.getElementById('switch-to-register');
    if (switchLink && redirectParam) {
      switchLink.href = `/register?redirect=${encodeURIComponent(redirectParam)}`;
    }

    wirePasswordToggle('login-password', 'toggle-password-btn');

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');

    usernameInput.addEventListener('input', () => {
      usernameInput.value = usernameInput.value.toLowerCase().replace(/\s+/g, '');
    });

    document.querySelectorAll('[data-demo-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        usernameInput.value = btn.getAttribute('data-demo-user');
        passwordInput.value = 'demo1234';
        showError('');
      });
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

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
      switchLink.href = `/login?redirect=${encodeURIComponent(redirectParam)}`;
    }

    wirePasswordToggle('reg-password', 'toggle-password-btn');

    const nameInput = document.getElementById('reg-name');
    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const usernameHint = document.getElementById('username-hint');
    const passwordHint = document.getElementById('password-hint');
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
        usernameHint.textContent = 'Use 3–24 lowercase letters, numbers, or underscores.';
        usernameTaken = false;
        return;
      }

      usernameHint.classList.remove('hidden', 'ok', 'error');
      usernameHint.classList.add('muted');
      usernameHint.textContent = 'Checking availability...';

      checkTimer = setTimeout(async () => {
        try {
          const res = await api.auth.checkUsername(cleaned);
          if (res.available) {
            usernameTaken = false;
            usernameHint.classList.remove('muted', 'error');
            usernameHint.classList.add('ok');
            usernameHint.textContent = `@${res.username} is available!`;
          } else {
            usernameTaken = true;
            usernameHint.classList.remove('muted', 'ok');
            usernameHint.classList.add('error');
            usernameHint.textContent = `@${res.username} is already taken.`;
          }
        } catch {
          usernameHint.classList.add('hidden');
        }
      }, 280);
    });

    passwordInput.addEventListener('input', () => {
      const len = passwordInput.value.length;
      if (len === 0) {
        passwordHint.className = 'field-hint muted';
        passwordHint.textContent = 'Minimum 6 characters required.';
      } else if (len >= 6) {
        passwordHint.className = 'field-hint ok';
        passwordHint.textContent = 'Password length looks good.';
      } else {
        const left = 6 - len;
        passwordHint.className = 'field-hint error';
        passwordHint.textContent = `${left} more character${left === 1 ? '' : 's'} needed.`;
      }
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
        showError('Please choose a valid username (3–24 letters, numbers, or underscores).');
        return;
      }
      if (usernameTaken) {
        showError('That username is already taken.');
        return;
      }
      if (password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        await api.auth.register({ name, username, password });
        redirectAfterAuth();
      } catch (err) {
        showError(err instanceof ApiError ? err.message : 'Could not create your account.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register';
      }
    });
  }
}

initAuthPage();
