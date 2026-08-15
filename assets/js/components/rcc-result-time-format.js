(() => {
  if (window.RCCResultTimeFormat) return;

  const TARGET_PATTERN = /^[+-]?\d{2,}:\d{2},\d{3}$/;
  const RACE_STATUS_FIELDS = new Set(['raceTime', 'race_time']);
  const RACE_STATUS_CODES = new Set(['DNF', 'DNS', 'DSQ', 'DNQ', 'RET']);

  function normalize(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const signMatch = raw.match(/^([+-])/);
    const sign = signMatch ? signMatch[1] : '';
    let body = sign ? raw.slice(1).trim() : raw;
    body = body.replace(/\s+/g, '').replace(/\.(?=\d{1,3}$)/, ',');

    let millis = '000';
    const commaIndex = body.lastIndexOf(',');
    if (commaIndex >= 0) {
      const fractional = body.slice(commaIndex + 1);
      if (!/^\d{1,3}$/.test(fractional)) return null;
      millis = fractional.padEnd(3, '0').slice(0, 3);
      body = body.slice(0, commaIndex);
    }

    const parts = body.split(':');
    if (parts.some((part) => !/^\d+$/.test(part))) return null;

    let totalMinutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      seconds = Number(parts[2]);
      if (minutes >= 60 || seconds >= 60) return null;
      totalMinutes = hours * 60 + minutes;
    } else if (parts.length === 2) {
      totalMinutes = Number(parts[0]);
      seconds = Number(parts[1]);
      if (seconds >= 60) return null;
    } else if (parts.length === 1) {
      const totalSeconds = Number(parts[0]);
      totalMinutes = Math.floor(totalSeconds / 60);
      seconds = totalSeconds % 60;
    } else {
      return null;
    }

    if (!Number.isSafeInteger(totalMinutes) || !Number.isSafeInteger(seconds)) return null;
    return `${sign}${String(totalMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${millis}`;
  }

  function normalizeRaceStatus(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    const code = raw.toUpperCase();
    if (RACE_STATUS_CODES.has(code)) return code;

    const lapMatch = raw.match(/^\+\s*(\d+)\s*(runde|runden|lap|laps)$/i);
    if (lapMatch) {
      const count = Number(lapMatch[1]);
      if (!Number.isSafeInteger(count) || count < 1) return null;
      return `+ ${count} ${count === 1 ? 'Runde' : 'Runden'}`;
    }

    return null;
  }

  function acceptsRaceStatus(input) {
    return Boolean(input && RACE_STATUS_FIELDS.has(String(input.dataset?.field || '')));
  }

  function normalizeInput(input) {
    if (!input) return true;
    const raw = String(input.value || '').trim();
    if (!raw) {
      input.setCustomValidity('');
      return true;
    }

    if (acceptsRaceStatus(input)) {
      const status = normalizeRaceStatus(raw);
      if (status) {
        input.value = status;
        input.setCustomValidity('');
        return true;
      }
    }

    const normalized = normalize(raw);
    if (!normalized || !TARGET_PATTERN.test(normalized)) {
      input.setCustomValidity(
        acceptsRaceStatus(input)
          ? 'Bitte Zeit als mm:ss,mmm oder einen Rennstatus wie DNF bzw. + 1 Runde eingeben.'
          : 'Bitte Zeit im Format mm:ss,mmm eingeben, z. B. 01:23,456.'
      );
      return false;
    }

    input.value = normalized;
    input.setCustomValidity('');
    return true;
  }

  function normalizeWithin(root = document) {
    const inputs = [...root.querySelectorAll?.('.manual-results-time') || []];
    let firstInvalid = null;
    inputs.forEach((input) => {
      if (!normalizeInput(input) && !firstInvalid) firstInvalid = input;
    });
    return { valid: !firstInvalid, firstInvalid };
  }

  function handleBlur(event) {
    const input = event.target?.closest?.('.manual-results-time');
    if (!input) return;
    normalizeInput(input);
  }

  function handleSaveCapture(event) {
    const button = event.target?.closest?.('#rcc-save-ai-draft, #rcc-save-manual-draft');
    if (!button) return;
    const scope = button.closest('.rcc-results-workflow-panel, details, section') || document;
    const result = normalizeWithin(scope);
    if (result.valid) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    result.firstInvalid?.focus();
    result.firstInvalid?.reportValidity();
  }

  function normalizeAddedInputs(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('.manual-results-time')) normalizeInput(node);
    node.querySelectorAll?.('.manual-results-time').forEach(normalizeInput);
  }

  document.addEventListener('blur', handleBlur, true);
  document.addEventListener('click', handleSaveCapture, true);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach(normalizeAddedInputs));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.RCCResultTimeFormat = {
    normalize,
    normalizeRaceStatus,
    normalizeInput,
    normalizeWithin,
    pattern: TARGET_PATTERN
  };
})();
