(() => {
  const form = document.getElementById('withdrawal-form');
  const review = document.getElementById('withdrawal-review');
  const receipt = document.getElementById('withdrawal-receipt');
  const status = document.getElementById('withdrawal-status');
  const prepareButton = document.getElementById('withdrawal-prepare');
  const confirmButton = document.getElementById('withdrawal-confirm');
  const editButton = document.getElementById('withdrawal-edit');
  const downloadButton = document.getElementById('withdrawal-download');

  let prepared = null;
  let latestReceipt = null;

  function setStatus(message = '', level = 'info') {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message;
    status.dataset.level = level;
  }

  function escapeText(value) {
    return String(value ?? '').trim();
  }

  function collect() {
    const data = new FormData(form);
    return {
      consumer_name: escapeText(data.get('consumer_name')),
      contract_identifier: escapeText(data.get('contract_identifier')),
      confirmation_email: escapeText(data.get('confirmation_email')).toLowerCase(),
      website: escapeText(data.get('website')),
    };
  }

  function valid(data) {
    if (data.consumer_name.length < 2) return 'Bitte gib deinen vollständigen Namen an.';
    if (data.contract_identifier.length < 3) return 'Bitte gib deine RaceVora-Account-E-Mail, Liga oder Vertragskennung an.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.confirmation_email)) return 'Bitte gib eine gültige E-Mail-Adresse für die Eingangsbestätigung an.';
    return '';
  }

  function renderReview(data) {
    document.getElementById('withdrawal-review-name').textContent = data.consumer_name;
    document.getElementById('withdrawal-review-contract').textContent = data.contract_identifier;
    document.getElementById('withdrawal-review-email').textContent = data.confirmation_email;
    document.getElementById('withdrawal-review-statement').textContent = `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Nutzung von RaceVora.`;
    review.hidden = false;
    review.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    confirmButton.focus({ preventScroll: true });
  }

  function prepare(event) {
    event.preventDefault();
    setStatus('');
    const data = collect();
    const error = valid(data);
    if (error) {
      setStatus(error, 'error');
      return;
    }
    prepared = data;
    Array.from(form.elements).forEach((field) => {
      if (field instanceof HTMLInputElement && field.name !== 'website') field.disabled = true;
    });
    prepareButton.disabled = true;
    renderReview(data);
  }

  function edit() {
    prepared = null;
    review.hidden = true;
    Array.from(form.elements).forEach((field) => { field.disabled = false; });
    prepareButton.disabled = false;
    form.querySelector('input[name="consumer_name"]')?.focus();
  }

  async function submitConfirmed() {
    if (!prepared || !window.supabaseClient?.functions?.invoke) {
      setStatus('Der Widerruf kann gerade nicht übermittelt werden. Bitte versuche es erneut oder schreibe an kontakt@racevora.com.', 'error');
      return;
    }

    confirmButton.disabled = true;
    editButton.disabled = true;
    setStatus('Widerruf wird sicher übermittelt …');

    try {
      const { data, error } = await window.supabaseClient.functions.invoke('submit-consumer-withdrawal', {
        body: { ...prepared, confirmed: true },
      });
      if (error) throw error;
      if (!data?.ok || !data?.reference) throw new Error(data?.error || 'Ungültige Serverantwort');

      latestReceipt = data.receipt || {
        reference: data.reference,
        submitted_at: data.submitted_at,
        statement: data.statement,
        confirmation_email: data.confirmation_email,
        consumer_name: prepared.consumer_name,
        contract_identifier: prepared.contract_identifier,
      };

      document.getElementById('withdrawal-receipt-reference').textContent = latestReceipt.reference || data.reference;
      document.getElementById('withdrawal-receipt-time').textContent = new Date(latestReceipt.submitted_at || data.submitted_at).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'long' });
      document.getElementById('withdrawal-receipt-email').textContent = latestReceipt.confirmation_email || prepared.confirmation_email;
      document.getElementById('withdrawal-receipt-statement').textContent = latestReceipt.statement || data.statement;
      document.getElementById('withdrawal-mail-state').textContent = data.confirmation_sent
        ? `Die Eingangsbestätigung wurde an ${latestReceipt.confirmation_email || prepared.confirmation_email} versendet.`
        : `Dein Widerruf ist gespeichert. Die E-Mail-Bestätigung konnte noch nicht zugestellt werden; lade den Beleg unten zusätzlich herunter.`;

      form.hidden = true;
      review.hidden = true;
      receipt.hidden = false;
      setStatus(`Widerruf eingegangen · Referenz ${data.reference}`, data.confirmation_sent ? 'success' : 'info');
      receipt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Withdrawal submission failed:', error);
      setStatus('Die elektronische Übermittlung ist fehlgeschlagen. Bitte versuche es erneut. Zur Fristwahrung kannst du deinen Widerruf zusätzlich an kontakt@racevora.com senden.', 'error');
      confirmButton.disabled = false;
      editButton.disabled = false;
    }
  }

  function downloadReceipt() {
    if (!latestReceipt) return;
    const timestamp = new Date(latestReceipt.submitted_at).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'long' });
    const text = [
      'RaceVora · Eingangsbeleg Widerruf',
      '',
      `Referenz: ${latestReceipt.reference}`,
      `Name: ${latestReceipt.consumer_name}`,
      `Vertrags-/Accountkennung: ${latestReceipt.contract_identifier}`,
      `Bestätigungs-E-Mail: ${latestReceipt.confirmation_email}`,
      `Eingang: ${timestamp}`,
      `UTC-Zeitstempel: ${latestReceipt.submitted_at}`,
      '',
      'Widerrufserklärung:',
      latestReceipt.statement,
      '',
      'Betreiber: Richard Rewitzer / RaceVora',
      'Hohenzollernstr. 9, 72622 Nürtingen, Deutschland',
      'kontakt@racevora.com',
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `racevora-widerruf-${latestReceipt.reference}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  form?.addEventListener('submit', prepare);
  editButton?.addEventListener('click', edit);
  confirmButton?.addEventListener('click', submitConfirmed);
  downloadButton?.addEventListener('click', downloadReceipt);
})();
