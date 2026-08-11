(() => {
  const roleLabels = {
    owner: 'Owner',
    admin: 'Admin',
    steward: 'Steward',
    member: 'Mitglied'
  };

  let initialized = false;
  let loading = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getLeagueId() {
    return window.RCCLeagueContext?.getLeagueId?.() || null;
  }

  function getCurrentRole() {
    return window.RCCLeagueContext?.getRole?.() || null;
  }

  function isOwner() {
    return getCurrentRole() === 'owner';
  }

  function showFeedback(message, isError = false) {
    const el = document.getElementById('league-members-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function ensurePanel() {
    if (document.getElementById('admin-section-members')) return;
    const layout = document.querySelector('.admin-layout');
    if (!layout) return;

    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = 'admin-section-members';
    panel.innerHTML = `
      <summary><strong>Liga-Mitglieder</strong></summary>
      <section class="panel admin-panel-wide admin-panel-accent">
        <h3>Mitglieder & Rollen</h3>
        <div class="notice">Owner und Admins können Personen zur aktuellen Liga hinzufügen. Neue Personen erhalten automatisch eine Supabase-Einladung per E-Mail.</div>
        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="league-member-email">E-Mail</label>
            <input id="league-member-email" type="email" placeholder="name@example.com">
          </div>
          <div class="field">
            <label for="league-member-role">Rolle</label>
            <select id="league-member-role">
              <option value="member">Mitglied</option>
              <option value="steward">Steward</option>
              <option value="admin">Admin</option>
              <option value="owner" data-owner-only>Owner</option>
            </select>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="button-primary" id="league-member-add-btn">Person hinzufügen / einladen</button>
          <button type="button" class="button-secondary" id="league-members-refresh-btn">Liste aktualisieren</button>
        </div>
        <div id="league-members-feedback" class="notice" hidden></div>
        <div class="section-spacer-top">
          <h4>Aktuelle Mitglieder</h4>
          <div id="league-members-list" class="stack-list"><div class="notice">Mitglieder werden geladen...</div></div>
        </div>
      </section>`;
    layout.appendChild(panel);

    const ownerOption = panel.querySelector('[data-owner-only]');
    if (ownerOption) ownerOption.hidden = !isOwner();

    document.getElementById('league-member-add-btn')?.addEventListener('click', inviteMember);
    document.getElementById('league-members-refresh-btn')?.addEventListener('click', loadMembers);
    document.getElementById('league-members-list')?.addEventListener('change', onRoleChange);
    document.getElementById('league-members-list')?.addEventListener('click', onMemberAction);
  }

  function renderMember(member) {
    const ownerProtected = member.role === 'owner' && !isOwner();
    const ownerOptions = isOwner() ? '<option value="owner">Owner</option>' : '';
    return `
      <article class="list-card" data-member-user-id="${escapeHtml(member.user_id)}">
        <div class="card-title-row">
          <div>
            <strong>${escapeHtml(member.email || 'Unbekannter Nutzer')}</strong><br>
            <span class="muted">${escapeHtml(roleLabels[member.role] || member.role)}</span>
          </div>
          <div class="card-actions">
            <select class="league-member-role-select" data-user-id="${escapeHtml(member.user_id)}" ${ownerProtected ? 'disabled' : ''}>
              ${ownerOptions}
              <option value="admin">Admin</option>
              <option value="steward">Steward</option>
              <option value="member">Mitglied</option>
            </select>
            <button type="button" class="button-secondary button-danger league-member-remove-btn" data-user-id="${escapeHtml(member.user_id)}" data-email="${escapeHtml(member.email || '')}" ${ownerProtected ? 'disabled' : ''}>Entfernen</button>
          </div>
        </div>
      </article>`;
  }

  async function loadMembers() {
    if (loading) return;
    const list = document.getElementById('league-members-list');
    const leagueId = getLeagueId();
    if (!list || !leagueId) return;
    loading = true;
    list.innerHTML = '<div class="notice">Mitglieder werden geladen...</div>';
    showFeedback('');

    try {
      const { data, error } = await window.supabaseClient.rpc('list_league_members', { p_league_id: leagueId });
      if (error) throw error;
      const members = data || [];
      list.innerHTML = members.length ? members.map(renderMember).join('') : '<div class="notice">Noch keine Mitglieder vorhanden.</div>';
      members.forEach((member) => {
        const select = list.querySelector(`.league-member-role-select[data-user-id="${CSS.escape(String(member.user_id))}"]`);
        if (select) select.value = member.role;
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="notice notice-error">Mitglieder konnten nicht geladen werden.</div>';
    } finally {
      loading = false;
    }
  }

  async function inviteMember() {
    const leagueId = getLeagueId();
    const email = String(document.getElementById('league-member-email')?.value || '').trim().toLowerCase();
    const role = String(document.getElementById('league-member-role')?.value || 'member');
    if (!leagueId || !email || !email.includes('@')) {
      showFeedback('Bitte eine gültige E-Mail-Adresse eingeben.', true);
      return;
    }
    if (role === 'owner' && !isOwner()) {
      showFeedback('Nur ein Owner kann einen weiteren Owner hinzufügen.', true);
      return;
    }

    const button = document.getElementById('league-member-add-btn');
    if (button) button.disabled = true;
    showFeedback('Einladung wird verarbeitet...');

    try {
      const redirectUrl = new URL('set-password.html', window.location.href);
      redirectUrl.searchParams.set('league', window.RCCLeagueContext?.getSlug?.() || 'rcc');
      const { data, error } = await window.supabaseClient.functions.invoke('manage-league-member', {
        body: { leagueId, email, role, redirectTo: redirectUrl.toString() }
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Einladung fehlgeschlagen');

      document.getElementById('league-member-email').value = '';
      showFeedback(data.invited
        ? `Einladung an ${email} wurde versendet und die Rolle ${roleLabels[role]} vorgemerkt.`
        : `${email} wurde als ${roleLabels[role]} zur Liga hinzugefügt.`);
      await loadMembers();
    } catch (error) {
      console.error(error);
      showFeedback(`Hinzufügen fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function onRoleChange(event) {
    const select = event.target.closest('.league-member-role-select');
    if (!select) return;
    const leagueId = getLeagueId();
    const userId = select.dataset.userId;
    const role = select.value;
    if (!leagueId || !userId) return;

    try {
      const { error } = await window.supabaseClient.rpc('set_league_member_role', {
        p_league_id: leagueId,
        p_user_id: userId,
        p_role: role
      });
      if (error) throw error;
      showFeedback(`Rolle wurde auf ${roleLabels[role] || role} geändert.`);
      await loadMembers();
    } catch (error) {
      console.error(error);
      showFeedback(`Rolle konnte nicht geändert werden: ${error.message}`, true);
      await loadMembers();
    }
  }

  async function onMemberAction(event) {
    const button = event.target.closest('.league-member-remove-btn');
    if (!button) return;
    const leagueId = getLeagueId();
    const userId = button.dataset.userId;
    const email = button.dataset.email || 'dieses Mitglied';
    if (!leagueId || !userId) return;
    if (!window.confirm(`${email} wirklich aus dieser Liga entfernen?`)) return;

    button.disabled = true;
    try {
      const { error } = await window.supabaseClient.rpc('remove_league_member', {
        p_league_id: leagueId,
        p_user_id: userId
      });
      if (error) throw error;
      showFeedback(`${email} wurde aus der Liga entfernt.`);
      await loadMembers();
    } catch (error) {
      console.error(error);
      showFeedback(`Entfernen fehlgeschlagen: ${error.message}`, true);
      button.disabled = false;
    }
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.().catch(() => null);
    if (!context?.leagueId || !['owner', 'admin'].includes(context.role)) return;
    ensurePanel();
    initialized = true;
    await loadMembers();
  }

  window.RCCLeagueMembers = { init, loadMembers };
})();
