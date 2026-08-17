(() => {
  const roleLabels = { owner: 'Owner', admin: 'Ligaleitung', member: 'Member' };
  const INVITE_BASE_URL = new URL('set-password.html', window.location.origin).toString();
  let initialized = false;
  let loading = false;
  let accountCheckTimer = null;
  let lastAccountCheckEmail = '';

  function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getLeagueId() { return window.RCCLeagueContext?.getLeagueId?.() || null; }
  function showFeedback(message, isError=false) { const el=document.getElementById('league-members-feedback'); if(!el)return; el.hidden=!message; el.textContent=message||''; el.classList.toggle('notice-error',Boolean(isError)); }
  function setMemberPanelVisible(panel, visible) { if(!panel)return; panel.hidden=!visible; panel.style.setProperty('display',visible?'block':'none','important'); if(visible) panel.open=true; }
  function getAccountCheckEl() { return document.getElementById('league-member-account-status'); }
  function showAccountStatus(message='', isError=false) { const el=getAccountCheckEl(); if(!el)return; el.hidden=!message; el.textContent=message; el.classList.toggle('notice-error',Boolean(isError)); }

  function ensureTeamTab() {
    const tabsRoot=document.getElementById('admin-mobile-tabs');
    if(!tabsRoot)return;
    let button=tabsRoot.querySelector('[data-admin-tab-target="admin-section-members"]');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='admin-mobile-tab';
      button.dataset.adminTabTarget='admin-section-members';
      button.setAttribute('role','tab');
      button.setAttribute('aria-selected','false');
      button.textContent='Team';
      tabsRoot.appendChild(button);
    }
    if(tabsRoot.dataset.rccMembersTabBound==='true')return;
    tabsRoot.addEventListener('click',(event)=>{
      const target=event.target.closest('[data-admin-tab-target]');
      if(!target||!tabsRoot.contains(target))return;
      const memberPanel=document.getElementById('admin-section-members');
      const showMembers=target.dataset.adminTabTarget==='admin-section-members';
      setMemberPanelVisible(memberPanel,showMembers);
      if(showMembers){
        tabsRoot.querySelectorAll('[data-admin-tab-target]').forEach((tab)=>{
          const active=tab===target;
          tab.classList.toggle('is-active',active);
          tab.setAttribute('aria-selected',String(active));
        });
        document.querySelectorAll('.admin-layout > details').forEach((section)=>{
          if(section.id==='admin-section-auth'||section.id==='admin-section-members')return;
          section.hidden=true;
        });
        memberPanel?.scrollIntoView?.({behavior:'smooth',block:'start'});
      }
    });
    tabsRoot.dataset.rccMembersTabBound='true';
  }

  async function isPlatformOwner() {
    const { data, error } = await window.supabaseClient.rpc('is_platform_owner');
    if (error) return false;
    return data === true;
  }

  function loadOwnerSwitcher() {
    if (document.querySelector('script[data-rcc-owner-switcher]')) return;
    const script=document.createElement('script');
    script.src='assets/js/pages/admin-owner-switcher.js';
    script.dataset.rccOwnerSwitcher='true';
    document.head.appendChild(script);
  }

  function bindReliableLogout() {
    const buttons = [document.getElementById('admin-banner-logout-btn'),document.getElementById('admin-quick-logout-btn')].filter(Boolean);
    buttons.forEach((button) => {
      if (button.dataset.rccLogoutBound === 'true') return;
      button.dataset.rccLogoutBound = 'true';
      button.addEventListener('click', async (event) => {
        event.preventDefault(); event.stopImmediatePropagation(); button.disabled = true;
        try {
          const { error } = await window.supabaseClient.auth.signOut({ scope: 'local' });
          if (error) throw error;
          try { window.sessionStorage?.removeItem('rcc.activeLeagueSlug.v1'); window.sessionStorage?.removeItem('rcc.lastTenantSlug.v1'); } catch (_error) {}
          window.location.reload();
        } catch (error) { console.error('Logout fehlgeschlagen.', error); button.disabled=false; window.alert(`Logout fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`); }
      }, true);
    });
  }

  async function checkExistingAccount(emailOverride='') {
    const leagueId=getLeagueId();
    const input=document.getElementById('league-member-email');
    const email=String(emailOverride||input?.value||'').trim().toLowerCase();
    if(!leagueId||!email||!email.includes('@')) { showAccountStatus(''); return null; }
    lastAccountCheckEmail=email;
    showAccountStatus('RaceVora-Konto wird geprüft...');
    try {
      const {data,error}=await window.supabaseClient.functions.invoke('manage-league-member',{body:{action:'check',leagueId,email}});
      if(error)throw error;
      if(email!==lastAccountCheckEmail)return data;
      if(data?.accountExists){
        if(data?.alreadyMember){
          showAccountStatus(`Diese E-Mail besitzt bereits ein gültiges RaceVora Konto und ist bereits Mitglied dieser Liga${data.currentRole?` (${roleLabels[data.currentRole]||data.currentRole})`:''}.`);
        } else {
          showAccountStatus('Diese E-Mail besitzt bereits ein gültiges RaceVora Konto. Beim Hinzufügen wird keine neue Einladungs-Mail benötigt.');
        }
      } else {
        showAccountStatus('Für diese E-Mail existiert noch kein RaceVora Konto. Beim Hinzufügen wird eine Einladungs-Mail versendet.');
      }
      return data;
    } catch(error) {
      console.error('Account-Prüfung fehlgeschlagen.',error);
      if(email===lastAccountCheckEmail)showAccountStatus('RaceVora-Kontostatus konnte gerade nicht geprüft werden.',true);
      return null;
    }
  }

  function bindAccountCheck() {
    const input=document.getElementById('league-member-email');
    if(!input||input.dataset.rccAccountCheckBound==='true')return;
    input.dataset.rccAccountCheckBound='true';
    input.addEventListener('input',()=>{
      clearTimeout(accountCheckTimer);
      lastAccountCheckEmail=String(input.value||'').trim().toLowerCase();
      showAccountStatus('');
      accountCheckTimer=setTimeout(()=>checkExistingAccount(),500);
    });
    input.addEventListener('blur',()=>{ clearTimeout(accountCheckTimer); checkExistingAccount(); });
  }

  async function ensurePanel(platformOwner) {
    const existingPanel = document.getElementById('admin-section-members');
    if (existingPanel) {
      setMemberPanelVisible(existingPanel,false);
      ensureTeamTab();
      bindAccountCheck();
      return;
    }
    const layout=document.querySelector('.admin-layout'); if(!layout)return;
    const panel=document.createElement('details'); panel.className='panel admin-panel-wide'; panel.id='admin-section-members';
    panel.innerHTML=`<summary><strong>Liga-Team & Zugänge</strong></summary><section class="panel admin-panel-wide admin-panel-accent"><h3>Mitglieder & Rollen</h3><div class="notice">Die Ligaleitung kann Member und weitere Ligaleitungen verwalten. Die Owner-Rolle ist geschützt.</div><div class="form-grid section-spacer-top"><div class="field"><label for="league-member-email">E-Mail</label><input id="league-member-email" type="email" placeholder="name@example.com"><div id="league-member-account-status" class="notice" hidden></div></div><div class="field"><label for="league-member-role">Rolle</label><select id="league-member-role"><option value="member">Member</option><option value="admin">Ligaleitung</option>${platformOwner?'<option value="owner">Owner</option>':''}</select></div></div><div class="card-actions"><button type="button" class="button-primary" id="league-member-add-btn">Person hinzufügen / einladen</button><button type="button" class="button-secondary" id="league-members-refresh-btn">Liste aktualisieren</button></div><div id="league-members-feedback" class="notice" hidden></div><div class="section-spacer-top"><h4>Aktuelle Mitglieder</h4><div id="league-members-list" class="stack-list"><div class="notice">Mitglieder werden geladen...</div></div></div></section>`; layout.appendChild(panel); setMemberPanelVisible(panel,false); ensureTeamTab();
    document.getElementById('league-member-add-btn')?.addEventListener('click', inviteMember);
    document.getElementById('league-members-refresh-btn')?.addEventListener('click', loadMembers);
    document.getElementById('league-members-list')?.addEventListener('change', onRoleChange);
    document.getElementById('league-members-list')?.addEventListener('click', onMemberAction);
    bindAccountCheck();
  }

  async function renderMember(member) {
    const platformOwner=await isPlatformOwner();
    return `<article class="list-card" data-member-user-id="${escapeHtml(member.user_id)}"><div class="card-title-row"><div><strong>${escapeHtml(member.email||'Unbekannter Nutzer')}</strong><br><span class="muted">${escapeHtml(roleLabels[member.role]||member.role)}</span></div><div class="card-actions"><select class="league-member-role-select" data-user-id="${escapeHtml(member.user_id)}">${platformOwner?'<option value="owner">Owner</option>':''}<option value="admin">Ligaleitung</option><option value="member">Member</option></select><button type="button" class="button-secondary button-danger league-member-remove-btn" data-user-id="${escapeHtml(member.user_id)}" data-email="${escapeHtml(member.email||'')}">Entfernen</button></div></div></article>`;
  }

  async function loadMembers(){ if(loading)return; const list=document.getElementById('league-members-list'), leagueId=getLeagueId(); if(!list||!leagueId)return; loading=true; list.innerHTML='<div class="notice">Mitglieder werden geladen...</div>'; showFeedback(''); try { const {data,error}=await window.supabaseClient.rpc('list_league_members',{p_league_id:leagueId}); if(error)throw error; const platformOwner=await isPlatformOwner(); const members=(data||[]).filter((member)=>platformOwner||member.role!=='owner'); const cards=await Promise.all(members.map(renderMember)); list.innerHTML=cards.length?cards.join(''):'<div class="notice">Noch keine Mitglieder vorhanden.</div>'; members.forEach(member=>{const select=list.querySelector(`.league-member-role-select[data-user-id="${CSS.escape(String(member.user_id))}"]`); if(select&&[...select.options].some(o=>o.value===member.role))select.value=member.role;}); } catch(error){console.error(error); list.innerHTML='<div class="notice notice-error">Mitglieder konnten nicht geladen werden.</div>';} finally{loading=false;} }

  async function inviteMember(){ const leagueId=getLeagueId(), email=String(document.getElementById('league-member-email')?.value||'').trim().toLowerCase(), role=String(document.getElementById('league-member-role')?.value||'member'); if(!leagueId||!email||!email.includes('@'))return showFeedback('Bitte eine gültige E-Mail-Adresse eingeben.',true); if(role==='owner'&&!await isPlatformOwner())return showFeedback('Nur der Plattform-Owner kann Owner vergeben.',true); const button=document.getElementById('league-member-add-btn'); if(button)button.disabled=true; showFeedback('Einladung wird verarbeitet...'); try{const redirectUrl=new URL(INVITE_BASE_URL); redirectUrl.searchParams.set('league',window.RCCLeagueContext?.getSlug?.()||'rcc'); const {data,error}=await window.supabaseClient.functions.invoke('manage-league-member',{body:{action:'add',leagueId,email,role,redirectTo:redirectUrl.toString()}}); if(error)throw error; if(!data?.ok)throw new Error(data?.error||'Einladung fehlgeschlagen'); document.getElementById('league-member-email').value=''; lastAccountCheckEmail=''; showAccountStatus(''); showFeedback(data.invited?`Einladung an ${email} wurde versendet.`:data.accountExisted?`Diese E-Mail besitzt bereits ein gültiges RaceVora Konto. ${email} wurde als ${roleLabels[role]} hinzugefügt.`:`${email} wurde als ${roleLabels[role]} hinzugefügt.`); await loadMembers();}catch(error){console.error(error);showFeedback(`Hinzufügen fehlgeschlagen: ${error.message||'Unbekannter Fehler'}`,true);}finally{if(button)button.disabled=false;} }
  async function onRoleChange(event){const select=event.target.closest('.league-member-role-select');if(!select)return;const leagueId=getLeagueId(),userId=select.dataset.userId,role=select.value;if(!leagueId||!userId)return;try{const {error}=await window.supabaseClient.rpc('set_league_member_role',{p_league_id:leagueId,p_user_id:userId,p_role:role});if(error)throw error;showFeedback(`Rolle wurde auf ${roleLabels[role]||role} geändert.`);await loadMembers();}catch(error){console.error(error);showFeedback(`Rolle konnte nicht geändert werden: ${error.message}`,true);await loadMembers();}}
  async function onMemberAction(event){const button=event.target.closest('.league-member-remove-btn');if(!button)return;const leagueId=getLeagueId(),userId=button.dataset.userId,email=button.dataset.email||'dieses Mitglied';if(!leagueId||!userId||!window.confirm(`${email} wirklich aus dieser Liga entfernen?`))return;button.disabled=true;try{const {error}=await window.supabaseClient.rpc('remove_league_member',{p_league_id:leagueId,p_user_id:userId});if(error)throw error;showFeedback(`${email} wurde aus der Liga entfernt.`);await loadMembers();}catch(error){console.error(error);showFeedback(`Entfernen fehlgeschlagen: ${error.message}`,true);button.disabled=false;}}

  async function init(){if(initialized)return;bindReliableLogout();const context=await window.RCCData?.getLeagueContext?.().catch(()=>null);const platformOwner=await isPlatformOwner();if(platformOwner)loadOwnerSwitcher();if(!context?.leagueId||(!platformOwner&&!['owner','admin'].includes(context.role)))return;await ensurePanel(platformOwner);initialized=true;await loadMembers();}
  window.RCCLeagueMembers={init,loadMembers};
})();