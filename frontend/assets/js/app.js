import { getCurrentUser, renderNavbar } from './ui.js';

async function initLandingPage() {
  const user = await getCurrentUser();
  renderNavbar(user, '/');

  const primaryCta = document.getElementById('hero-primary-cta');
  const secondaryCta = document.getElementById('hero-secondary-cta');
  const footerLink = document.getElementById('footer-auth-link');

  if (user) {
    if (primaryCta) {
      primaryCta.href = '/create-quiz';
      primaryCta.querySelector('span').textContent = 'Open Quiz Builder';
    }
    if (secondaryCta) {
      secondaryCta.href = '/dashboard';
      secondaryCta.textContent = 'Go to Dashboard';
    }
    if (footerLink) {
      footerLink.href = '/dashboard';
      footerLink.textContent = 'Dashboard';
    }
  }

  // Interactive Sample Quiz Preview
  const sampleContainer = document.getElementById('sample-options');
  const sampleFeedback = document.getElementById('sample-feedback');

  if (sampleContainer) {
    const buttons = sampleContainer.querySelectorAll('.mcq-option');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((other) => {
          other.classList.remove('selected', 'correct-preview');
          const rightSlot = other.lastElementChild;
          if (rightSlot) {
            rightSlot.className = 'mcq-radio';
            rightSlot.removeAttribute('style');
            rightSlot.innerHTML = '';
          }
        });

        btn.classList.add('selected');
        const rightSlot = btn.lastElementChild;
        if (rightSlot) {
          rightSlot.className = '';
          rightSlot.style.fontSize = '0.75rem';
          rightSlot.style.fontWeight = '700';
          rightSlot.innerHTML = '&#10003; Picked';
        }
        if (sampleFeedback) {
          sampleFeedback.textContent = 'Option selected — scores are revealed only after submitting.';
        }
      });
    });
  }
}

initLandingPage();
