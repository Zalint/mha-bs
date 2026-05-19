/* ============================================================
   MHA - Bureau de Suivi | App shell injector
   Usage:
     <body data-page="dashboard" data-role="cabinet">
     <script src="../assets/shell.js"></script>
   ============================================================ */

(function () {
  const ROOT_PREFIX = (location.pathname.includes('/cabinet/') || location.pathname.includes('/bs/')) ? '..' : '.';

  const NAV = {
    cabinet: [
      { group: 'Vue SG' },
      { id: 'dashboard',        label: 'Dashboard global',         icon: 'layout-dashboard', href: '/cabinet/dashboard.html' },
      { id: 'directive-pres',   label: 'Directive présidentielle', icon: 'landmark', children: [
        { id: 'ci', label: 'Conseil inter-ministériel', href: '/cabinet/conseil-interministeriel.html', badge: '65' },
        { id: 'cm', label: 'Conseil des ministres',     href: '/cabinet/conseil-ministres.html',        badge: '123' },
        { id: 'sg', label: 'Coordination SGG/SG',       href: '/cabinet/coordination-sg.html',          badge: '10' },
      ]},
      { id: 'reco-mha',         label: 'Recommandations MHA',      icon: 'clipboard-list', children: [
        { id: 'copil',    label: 'COPIL',    href: '/cabinet/copil.html',    badge: '40' },
        { id: 'reformes', label: 'Réformes', href: '/cabinet/reformes.html', badge: '13' },
        { id: 'cngi',     label: 'CNGI',     href: '/cabinet/cngi.html',     badge: '11' },
      ]},
      { id: 'reunions-tech',    label: 'Suivi Réunions techniques', icon: 'calendar',        href: '/cabinet/reunions-techniques.html', badge: '19' },
      { id: 'missions',         label: 'Suivi missions terrain',   icon: 'map-pin',          href: '/cabinet/missions-terrain.html',    badge: '4'  },
      { id: 'interpellations',  label: 'Interpellations parlementaires', icon: 'mic',        href: '/cabinet/interpellations.html',     badge: '12' },
      { id: 'par-direction',    label: 'Répartition par direction', icon: 'building-2',      href: '/cabinet/par-direction.html' },
    ],
    bs: [
      { group: 'Espace Bureau de Suivi' },
      { id: 'bs-liste',     label: 'File de travail',          icon: 'inbox',         href: '/bs/liste.html',    badge: '16' },
      { id: 'bs-alertes',   label: 'Mes alertes',              icon: 'bell',          href: '/bs/alertes.html' },
      { id: 'bs-fiche',     label: 'Nouvelle recommandation',  icon: 'file-plus',     href: '/bs/fiche.html' },
      { id: 'bs-matrice',   label: 'Saisie matrices',          icon: 'grid-3x3',      href: '/bs/matrice.html' },
      { id: 'bs-reunion',   label: 'Réunion / mission',        icon: 'calendar-plus', href: '/bs/reunion.html' },
      { id: 'bs-import',    label: 'Import Excel',             icon: 'upload',        href: '/bs/import.html' },
      { id: 'bs-export',    label: 'Export & rapports',        icon: 'download',      href: '/bs/export.html' },
    ],
  };

  const PAGE_INFO = {
    'dashboard':       { crumbs: ['SG', 'Dashboard global'] },
    'ci':              { crumbs: ['SG', 'Directive présidentielle', 'Conseil inter-ministériel'] },
    'cm':              { crumbs: ['SG', 'Directive présidentielle', 'Conseil des ministres'] },
    'sg':              { crumbs: ['SG', 'Directive présidentielle', 'Coordination SGG/SG'] },
    'copil':           { crumbs: ['SG', 'Recommandations MHA', 'COPIL'] },
    'reformes':        { crumbs: ['SG', 'Recommandations MHA', 'Réformes'] },
    'cngi':            { crumbs: ['SG', 'Recommandations MHA', 'CNGI'] },
    'reunions-tech':   { crumbs: ['SG', 'Suivi Réunions techniques'] },
    'missions':        { crumbs: ['SG', 'Suivi missions terrain'] },
    'interpellations': { crumbs: ['SG', 'Interpellations parlementaires'] },
    'par-direction':   { crumbs: ['SG', 'Répartition par direction'] },
    'bs-liste':        { crumbs: ['BS', 'File de travail'] },
    'bs-alertes':      { crumbs: ['BS', 'Mes alertes'] },
    'bs-fiche':        { crumbs: ['BS', 'Fiche recommandation'] },
    'bs-matrice':      { crumbs: ['BS', 'Saisie matrices'] },
    'bs-reunion':      { crumbs: ['BS', 'Réunion / mission'] },
    'bs-import':       { crumbs: ['BS', 'Import Excel'] },
    'bs-export':       { crumbs: ['BS', 'Export & rapports'] },
  };

  function href(path) { return ROOT_PREFIX + path; }

  function buildSidebar(role, currentPage) {
    const items = NAV[role] || NAV.cabinet;
    let html = `
      <div class="brand">
        <div class="brand-mark">M</div>
        <div class="brand-text">
          <b>MHA · Suivi</b>
          <span style="color:#94A3B8">Bureau de Suivi</span>
        </div>
      </div>
    `;
    items.forEach(it => {
      if (it.group) {
        html += `<div class="nav-group">${it.group}</div>`;
        return;
      }
      // Parent with children (not clickable, just a group header)
      if (it.children && it.children.length) {
        const hasActiveChild = it.children.some(c => c.id === currentPage);
        html += `<div class="nav-parent ${hasActiveChild ? 'open' : 'open'}">
          <div class="nav-item nav-parent-head">
            <i data-lucide="${it.icon}" class="nav-icon"></i>
            <span>${it.label}</span>
            <i data-lucide="chevron-down" class="nav-chevron"></i>
          </div>
          <div class="nav-children">
            ${it.children.map(c => {
              const active = c.id === currentPage ? 'active' : '';
              const badge = c.badge ? `<span class="badge">${c.badge}</span>` : '';
              return `<a class="nav-item nav-child ${active}" href="${href(c.href)}">
                <span class="nav-bullet"></span>
                <span>${c.label}</span>${badge}
              </a>`;
            }).join('')}
          </div>
        </div>`;
        return;
      }
      // Leaf item
      const active = it.id === currentPage ? 'active' : '';
      const badge = it.badge ? `<span class="badge">${it.badge}</span>` : '';
      html += `<a class="nav-item ${active}" href="${href(it.href)}">
        <i data-lucide="${it.icon}" class="nav-icon"></i>
        <span>${it.label}</span>${badge}
      </a>`;
    });
    html += `
      <div class="role-switch" role="tablist" aria-label="Changer de rôle">
        <button data-role="cabinet" class="${role==='cabinet'?'active':''}">SG</button>
        <button data-role="bs"      class="${role==='bs'?'active':''}">Bureau Suivi</button>
      </div>
    `;
    return html;
  }

  function buildTopbar(currentPage) {
    const info = PAGE_INFO[currentPage] || { crumbs: ['MHA'] };
    const crumbHtml = info.crumbs.map((c, i, a) =>
      i === a.length - 1 ? `<b>${c}</b>` : `${c} <span style="color:var(--color-fg-muted)">/</span> `
    ).join(' ');
    return `
      <div class="crumbs">${crumbHtml}</div>
      <div class="spacer"></div>
      <div class="search">
        <i data-lucide="search" class="icon-sm" style="color:var(--color-fg-muted)"></i>
        <input type="text" placeholder="Rechercher une recommandation, une rencontre…" aria-label="Recherche globale" />
        <kbd style="font-size:11px;color:var(--color-fg-muted);font-family:var(--font-mono)">Ctrl K</kbd>
      </div>
      <button class="icon-btn" aria-label="Notifications" title="Notifications">
        <i data-lucide="bell"></i>
      </button>
      <div class="user-pill">
        <div class="avatar" aria-hidden="true">SD</div>
        <div style="font-size:13px"><div style="font-weight:600">Saliou D.</div><div style="color:var(--color-fg-muted);font-size:11.5px">Bureau de Suivi</div></div>
      </div>
    `;
  }

  function init() {
    const body = document.body;
    const currentPage = body.dataset.page || 'dashboard';
    // role auto-detect from page id
    const role = body.dataset.role || (currentPage.startsWith('bs-') ? 'bs' : 'cabinet');

    // Inject shell
    const existing = document.getElementById('app-content') || document.body.firstElementChild;
    const contentHtml = document.getElementById('app-content') ? document.getElementById('app-content').innerHTML : document.body.innerHTML;

    body.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" aria-label="Navigation principale">${buildSidebar(role, currentPage)}</aside>
        <div class="main">
          <header class="topbar">${buildTopbar(currentPage)}</header>
          <main class="page" id="app-content">${contentHtml}</main>
        </div>
      </div>
    `;

    // Role switch
    body.querySelectorAll('.role-switch button').forEach(btn => {
      btn.addEventListener('click', () => {
        const newRole = btn.dataset.role;
        const fallback = newRole === 'bs' ? '/bs/liste.html' : '/cabinet/dashboard.html';
        location.href = href(fallback);
      });
    });

    // Render Lucide icons
    if (window.lucide) window.lucide.createIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
