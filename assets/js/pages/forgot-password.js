(() => {
  const form = document.getElementById('password-recovery-form');
  const emailInput = document.getElementById('password-recovery-email');
  const submitButton = document.getElementById('password-recovery-submit');
  const feedback = document.getElementById('password-recovery-feedback');

  function showFeedback(message, isError = false) {
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.textContent = message || '';
    feedback.classList.toggle('notice-error', Boolean(isError));
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = String(emailInput?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showFeedback('Bitte eine gültige E-Mail-Adresse eingeben.', true);
      return;
    }

    if (submitButton) submitButton.disabled = true;
    showFeedback('Reset-Link wird versendet …');

    try {
      const redirectTo = new URL('set-password.html?mode=recovery', window.location.origin).toString();
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      showFeedback('Wenn ein Account mit dieser E-Mail-Adresse existiert, wurde ein Reset-Link versendet. Bitte prüfe auch deinen Spam-Ordner.');
      if (emailInput) emailInput.value = '';
    } catch (error) {
      console.error('Password recovery failed:', error);
      showFeedback('Der Reset-Link konnte gerade nicht versendet werden. Bitte versuche es später erneut.', true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
})();
