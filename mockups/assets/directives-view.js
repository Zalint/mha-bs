/* ============================================================
   MHA - Bureau de Suivi | Directives view (CI / CM / SG)
   Initialized via:  initDirectivesView({ type, title, sub })
   Requires:         window.MHA_DATA loaded
   ============================================================ */

window.initDirectivesView = function (cfg) {
  const PLAN_ALL = window.MHA_DATA.plan;
  const PLAN = cfg.type ? PLAN_ALL.filter(r => r.TYPE_RENCONTRE === cfg.type) : PLAN_ALL;
  const today = new Date('2026-05-14');

  // === Stat strip ===
  const states = PLAN.reduce((a, r) => { a[r.ETAT] = (a[r.ETAT] || 0) + 1; return a; }, {});
  const total = PLAN.length;
  const real = states['Réalisée'] || 0;
  const tauxExec = total ? Math.round(real / total * 1000) / 10 : 0;
  const enRetard = PLAN.filter(r => {
    if (r.ETAT !== 'En cours' && r.ETAT !== 'En attente') return false;
    if (!r.ECHEANCE) return false;
    return parseDate(r.ECHEANCE) < today;
  }).length;
  document.getElementById('stat-strip').innerHTML = `
    <div class="cell"><div class="lab">Total</div><div class="val">${total}</div><div class="sub">${cfg.subStrip || 'directives'}</div></div>
    <div class="cell success"><div class="lab">Réalisées</div><div class="val">${real}</div><div class="sub">${tauxExec} %</div></div>
    <div class="cell warning"><div class="lab">En cours</div><div class="val">${states['En cours']||0}</div><div class="sub">${total?Math.round((states['En cours']||0)/total*100):0} %</div></div>
    <div class="cell info"><div class="lab">En attente</div><div class="val">${states['En attente']||0}</div><div class="sub">${total?Math.round((states['En attente']||0)/total*100):0} %</div></div>
    <div class="cell"><div class="lab">Inéligibles</div><div class="val">${states['Inéligible']||0}</div><div class="sub">hors périmètre</div></div>
    <div class="cell danger"><div class="lab">Échéance dépassée</div><div class="val">${enRetard}</div><div class="sub">à relancer</div></div>
  `;

  // === Filter selects ===
  const years = [...new Set(PLAN.map(r => r.DATE_RENCONTRE && r.DATE_RENCONTRE.slice(-4)).filter(Boolean))].sort();
  const rencs = [...new Set(PLAN.map(r => r.RENCONTRE).filter(Boolean))];
  const fy = document.getElementById('f-year');
  const fr = document.getElementById('f-rencontre');
  years.forEach(y => fy.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`));
  rencs.sort().forEach(r => fr.insertAdjacentHTML('beforeend', `<option value="${esc(r)}">${esc(capitalize(r)).slice(0, 80)}${r.length>80?'…':''}</option>`));

  // === State ===
  const state = { etat: '', year: '', rencontre: '', search: '' };

  function render() {
    const rows = PLAN.filter(r => {
      if (state.etat && r.ETAT !== state.etat) return false;
      if (state.year && (!r.DATE_RENCONTRE || !r.DATE_RENCONTRE.endsWith(state.year))) return false;
      if (state.rencontre && r.RENCONTRE !== state.rencontre) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        if (!(r.DIRECTIVES||'').toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => parseDate(b.DATE_RENCONTRE) - parseDate(a.DATE_RENCONTRE));

    document.getElementById('count-label').textContent = rows.length + ' directives affichées';
    document.getElementById('pager-info').textContent = `Page 1 / ${Math.max(1, Math.ceil(rows.length/50))} · ${rows.length} sur ${total} directives`;

    const html = rows.slice(0, 50).map(r => {
      const echeance = r.ECHEANCE || '—';
      const isLate = (r.ETAT === 'En cours' || r.ETAT === 'En attente') && r.ECHEANCE && parseDate(r.ECHEANCE) < today;
      const retard = isLate ? Math.round((today - parseDate(r.ECHEANCE)) / 86400000) : null;
      return `<tr>
        <td><span class="col-num">${esc(r.CODE_DIRECTIVE||'—')}</span></td>
        <td class="directive-cell">
          <div class="directive-text">${esc(r.DIRECTIVES||'')}</div>
          <div class="directive-meta">${esc(r.MINISTERES_ASSOCIES||'')}</div>
        </td>
        <td class="rencontre-cell">
          <div>${esc(capitalize(r.RENCONTRE||'')).slice(0,80)}${(r.RENCONTRE||'').length>80?'…':''}</div>
          <div class="col-num" style="color:var(--color-fg-muted);font-size:11.5px;margin-top:2px">${esc(r.DATE_RENCONTRE||'')}</div>
        </td>
        <td class="col-num">${esc(echeance)}</td>
        <td>${stateBadge(r.ETAT)}</td>
        <td style="text-align:right">${retard !== null ? `<span class="num" style="color:var(--color-danger);font-weight:600">+${retard} j</span>` : `<span style="color:var(--color-fg-muted)">—</span>`}</td>
      </tr>`;
    }).join('');
    document.getElementById('tbl-body').innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--color-fg-muted)">Aucune directive ne correspond aux filtres.</td></tr>';
  }

  document.querySelectorAll('.filter-chip[data-etat]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-etat]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.etat = chip.dataset.etat;
      render();
    });
  });
  fy.addEventListener('change', e => { state.year = e.target.value; render(); });
  fr.addEventListener('change', e => { state.rencontre = e.target.value; render(); });
  document.getElementById('f-search').addEventListener('input', e => { state.search = e.target.value; render(); });

  render();

  function stateBadge(etat) {
    const map = {
      'Réalisée':   ['realisee'],
      'En cours':   ['encours'],
      'En attente': ['attente'],
      'Inéligible': ['ineligible'],
    };
    const [cls] = map[etat] || ['neutral'];
    return `<span class="badge ${cls}"><span class="dot"></span>${esc(etat||'—')}</span>`;
  }
  function parseDate(s) { if (!s) return new Date(0); const p = s.split('-'); if (p.length === 3 && p[0].length === 2) return new Date(`${p[2]}-${p[1]}-${p[0]}`); return new Date(s); }
  function esc(s) { return String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
};

window.directivesViewBody = function (cfg) {
  return `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:8px">
      <div>
        <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;background:var(--color-primary-100);color:var(--color-primary-700);border-radius:6px;font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">
          <i data-lucide="landmark" style="width:14px;height:14px"></i> Directive présidentielle
        </div>
        <h1 class="page-title">${cfg.title}</h1>
        <p class="page-sub">${cfg.sub}</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn btn-secondary" type="button"><i data-lucide="download" class="icon-sm"></i> Exporter</button>
        <a class="btn btn-primary" href="../bs/fiche.html"><i data-lucide="plus" class="icon-sm"></i> Nouvelle directive</a>
      </div>
    </div>

    <div class="stat-strip" id="stat-strip"></div>

    <div class="filters">
      <div>
        <label class="field-label" for="f-year">Année</label>
        <select id="f-year" class="select"><option value="">Toutes</option></select>
      </div>
      <div>
        <label class="field-label" for="f-rencontre">Rencontre</label>
        <select id="f-rencontre" class="select" style="min-width:300px"><option value="">Toutes</option></select>
      </div>
      <div>
        <label class="field-label" for="f-search">Recherche directive</label>
        <input id="f-search" class="input" type="text" placeholder="mot-clé dans le texte…" style="min-width:240px">
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:flex-end">
        <button class="filter-chip active" data-etat="">Toutes</button>
        <button class="filter-chip" data-etat="Réalisée">Réalisée</button>
        <button class="filter-chip" data-etat="En cours">En cours</button>
        <button class="filter-chip" data-etat="En attente">En attente</button>
        <button class="filter-chip" data-etat="Inéligible">Inéligible</button>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-head">
        <h2>Liste des directives</h2>
        <span class="meta" id="count-label">— directives affichées</span>
        <div style="margin-left:auto" class="meta">Tri : <b style="color:var(--color-fg)">Date rencontre ↓</b></div>
      </div>
      <div class="table-scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:90px">Code</th>
              <th>Directive</th>
              <th>Rencontre</th>
              <th>Échéance</th>
              <th>État</th>
              <th style="width:90px;text-align:right">Retard</th>
            </tr>
          </thead>
          <tbody id="tbl-body"></tbody>
        </table>
      </div>
      <div class="pager">
        <span id="pager-info">— sur — directives</span>
        <div class="pages">
          <button>«</button><button class="active">1</button><button>2</button><button>3</button><button>»</button>
        </div>
      </div>
    </div>
  `;
};

window.directivesViewStyles = `
  .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .stat-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: var(--color-border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 16px; }
  .stat-strip .cell { background: var(--color-surface); padding: 14px 18px; }
  .stat-strip .cell .lab { font-size: 11.5px; color: var(--color-fg-muted); text-transform: uppercase; letter-spacing: .04em; font-weight: 500; }
  .stat-strip .cell .val { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--color-fg); margin-top: 2px; font-variant-numeric: tabular-nums; }
  .stat-strip .cell .sub { font-size: 11.5px; color: var(--color-fg-muted); margin-top: 2px; }
  .stat-strip .cell.success .val { color: var(--color-success); }
  .stat-strip .cell.warning .val { color: var(--color-warning); }
  .stat-strip .cell.danger .val { color: var(--color-danger); }
  .stat-strip .cell.info .val { color: var(--color-primary); }
  .table-wrap { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
  .table-head { display: flex; align-items: center; padding: 14px 18px; gap: 10px; border-bottom: 1px solid var(--color-border); }
  .table-head h2 { margin: 0; font-size: 14.5px; font-weight: 600; }
  .table-head .meta { color: var(--color-fg-muted); font-size: 12.5px; }
  .table-scroll { max-height: 600px; overflow: auto; }
  .pager { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid var(--color-border); font-size: 13px; color: var(--color-fg-muted); }
  .pager .pages { display: flex; gap: 4px; }
  .pager .pages button { width: 32px; height: 32px; border: 1px solid var(--color-border); background: var(--color-surface); border-radius: 6px; cursor: pointer; font-family: var(--font-mono); font-size: 12px; }
  .pager .pages button.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
  .directive-cell { max-width: 460px; }
  .directive-text { font-size: 13px; line-height: 1.5; color: var(--color-fg); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .directive-meta { font-size: 11.5px; color: var(--color-fg-muted); margin-top: 4px; font-family: var(--font-mono); }
  .rencontre-cell { max-width: 260px; font-size: 12.5px; line-height: 1.4; color: var(--color-fg-2); }
  .col-num { font-family: var(--font-mono); font-size: 12.5px; }
`;
