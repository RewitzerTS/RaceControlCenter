(() => {
  const normalize = (value) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g,'ss').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc = (value) => window.escapeHtml?.(String(value ?? '')) ?? String(value ?? '');
  const parse = (text) => {
    const lines=String(text||'').split(/\r?\n/).filter(Boolean); if(lines.length<2)return[];
    const delim=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':',';
    const split=(line)=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===delim&&!q){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;};
    const headers=split(lines[0]).map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase());
    return lines.slice(1).map(line=>{const vals=split(line);return headers.reduce((o,h,i)=>(o[h]=vals[i]??'',o),{});});
  };
  async function renderCleanPreview(){
    const preview=document.getElementById('csv-import-preview'), field=document.getElementById('csv-preview');
    if(!preview||!field?.value.trim())return;
    const rows=parse(field.value); if(!rows.length)return;
    const {data:drivers,error}=await window.supabaseClient.from('drivers').select('id, display_name, gamertag, league_team, car_name');
    if(error)return;
    const map=new Map(); (drivers||[]).forEach(d=>[d.gamertag,d.display_name].filter(Boolean).forEach(k=>map.set(normalize(k),d)));
    const body=rows.map(row=>{
      const raw=String(row['fahrer']||'').trim(), d=map.get(normalize(raw));
      const driver=d?.gamertag||raw||'—', team=d?.league_team||d?.car_name||'—';
      const problem=!d?'<div><span class="preview-badge preview-badge--error">⚠ Nicht zugeordnet</span></div>':'';
      return `<tr><td>${esc(row['pos']||'—')}</td><td><strong>${esc(driver)}</strong>${problem}</td><td>${esc(team)}</td><td>${esc(row['startposition']||'—')}</td><td>${esc(row['boxenstopps']||'—')}</td><td>${esc(row['schnellste runde']||'—')}</td><td>${esc(row['renndauer']||'—')}</td><td><strong>${esc(row['punkte']||'0')}</strong></td></tr>`;
    }).join('');
    preview.innerHTML=`<div class="notice">${rows.length} Ergebniszeilen · Bitte vor dem Import kurz prüfen.</div><table class="admin-preview-table"><thead><tr><th>Pos.</th><th>Fahrer</th><th>Team</th><th>Grid</th><th>Stopps</th><th>Beste</th><th>Zeit</th><th>Punkte</th></tr></thead><tbody>${body}</tbody></table>`;
  }
  function improveRawCsvUi(){
    const field=document.getElementById('csv-preview'); if(!field||field.closest('.rcc-raw-csv-details'))return;
    const parent=field.parentElement; if(!parent)return;
    const details=document.createElement('details'); details.className='rcc-raw-csv-details';
    const summary=document.createElement('summary'); summary.innerHTML='<strong>Technische CSV anzeigen</strong>';
    parent.insertBefore(details,field); details.append(summary,field);
    const label=parent.querySelector('label[for="csv-preview"]'); if(label)label.hidden=true;
  }
  function bind(){improveRawCsvUi();const file=document.getElementById('csv-file');file?.addEventListener('change',()=>setTimeout(renderCleanPreview,250));document.getElementById('csv-preview')?.addEventListener('input',()=>setTimeout(renderCleanPreview,100));document.addEventListener('rcc:ai-results-to-csv',()=>setTimeout(renderCleanPreview,100));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();