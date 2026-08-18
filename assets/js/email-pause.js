(() => {
  'use strict';

  if (window.RACEVORA_EMAIL_SENDING_PAUSED !== true) return;

  const message = String(window.RACEVORA_EMAIL_PAUSE_MESSAGE || 'Der RaceVora-E-Mail-Versand ist vorübergehend pausiert. Bitte versuche es später erneut.');
  const client = window.supabaseClient;
  if (!client?.auth || client.auth.__raceVoraEmailPausePatched) return;

  function pausedError() {
    const error = new Error(message);
    error.code = 'racevora_email_sending_paused';
    return error;
  }

  client.auth.signUp = async () => ({ data: null, error: pausedError() });
  client.auth.resend = async () => ({ data: null, error: pausedError() });
  client.auth.resetPasswordForEmail = async () => ({ data: null, error: pausedError() });
  client.auth.__raceVoraEmailPausePatched = true;

  if (client.functions?.invoke && !client.functions.__raceVoraEmailPausePatched) {
    const nativeInvoke = client.functions.invoke.bind(client.functions);
    client.functions.invoke = (functionName, options) => {
      if (String(functionName || '') === 'finalize-consumer-registration') {
        return Promise.resolve({ data: null, error: pausedError() });
      }
      return nativeInvoke(functionName, options);
    };
    client.functions.__raceVoraEmailPausePatched = true;
  }

  function applyUiState() {
    const registerSubmit = document.getElementById('register-submit');
    const recoverySubmit = document.getElementById('password-recovery-submit');
    const registerFeedback = document.getElementById('register-feedback');
    const recoveryFeedback = document.getElementById('password-recovery-feedback');

    if (registerSubmit) {
      registerSubmit.disabled = true;
      registerSubmit.textContent = 'Registrierung vorübergehend pausiert';
    }
    if (recoverySubmit) {
      recoverySubmit.disabled = true;
      recoverySubmit.textContent = 'E-Mail-Versand vorübergehend pausiert';
    }
    [registerFeedback, recoveryFeedback].forEach((node) => {
      if (!node) return;
      node.hidden = false;
      node.textContent = message;
      node.dataset.level = 'info';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyUiState, { once: true });
  else applyUiState();

  window.RaceVoraEmailPause = { enabled: true, message };
})();
