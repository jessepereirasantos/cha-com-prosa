let currentUserRole = null;

function logout() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_role');
  window.location.href = 'index.html';
}

function setActiveNav() {
  const file = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === file) a.classList.add('active');
  });
}

function setupNavigationListeners() {
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http')) {
        window.location.href = href;
      }
    });
  });
}

async function checkUserRole() {
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.user) {
      currentUserRole = res.user.role;
      localStorage.setItem('user_role', res.user.role);
      return res.user.role;
    }
  } catch (e) {
    console.error('Erro ao verificar role:', e);
  }
  return localStorage.getItem('user_role') || 'client';
}

function isAdmin() {
  return currentUserRole === 'admin' || localStorage.getItem('user_role') === 'admin';
}

function getAdminSidenav() {
  return `
    <div class="sidebar-section">
      <div class="sidebar-section-title">Principal</div>
      <a data-nav href="admin-dashboard.html"><span class="nav-icon">📊</span> Dashboard</a>
      <a data-nav href="admin-clients.html"><span class="nav-icon">👥</span> Clientes</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Gestão</div>
      <a data-nav href="admin-plans.html"><span class="nav-icon">📋</span> Planos</a>
      <a data-nav href="admin-coupons.html"><span class="nav-icon">🎟️</span> Cupons</a>
      <a data-nav href="admin-subscriptions.html"><span class="nav-icon">💳</span> Assinaturas</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Sistema</div>
      <a data-nav href="admin-instances.html"><span class="nav-icon">📱</span> Instâncias</a>
      <a data-nav href="admin-flows.html"><span class="nav-icon">🔄</span> Fluxos</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Configurações</div>
      <a data-nav href="admin-branding.html"><span class="nav-icon">🎨</span> Branding</a>
      <a data-nav href="settings.html"><span class="nav-icon">⚙️</span> Config</a>
    </div>
  `;
}

function getClientSidenav() {
  return `
    <div class="sidebar-section">
      <div class="sidebar-section-title">Principal</div>
      <a data-nav href="dashboard.html"><span class="nav-icon">🏠</span> Dashboard</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">WhatsApp</div>
      <a data-nav href="instances.html"><span class="nav-icon">📱</span> Instâncias</a>
      <a data-nav href="flows.html"><span class="nav-icon">🔄</span> Fluxos</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Relatórios</div>
      <a data-nav href="analytics.html"><span class="nav-icon">📊</span> Analytics</a>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Conta</div>
      <a data-nav href="plans.html"><span class="nav-icon">💎</span> Meu Plano</a>
      <a data-nav href="perfil.html"><span class="nav-icon">👤</span> Meu Perfil</a>
      <a data-nav href="settings.html"><span class="nav-icon">⚙️</span> Configurações</a>
    </div>
  `;
}

function getBranding() {
  const stored = localStorage.getItem('platform_branding');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  return {
    name: 'Eloha Bots',
    logo: null,
    primaryColor: '#6d5efc',
    secondaryColor: '#00d4ff'
  };
}

async function mountShell({ title } = {}) {
  const root = document.querySelector('[data-shell]');
  if (!root) return;

  await checkUserRole();
  const admin = isAdmin();
  const sidenavHtml = admin ? getAdminSidenav() : getClientSidenav();
  const branding = getBranding();
  const roleLabel = admin ? '<span class="role-badge">ADMIN</span>' : '';

  root.innerHTML = `
    <div class="app-layout">
      <aside class="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            ${branding.logo ? `<img src="${branding.logo}" alt="Logo" class="sidebar-logo">` : '<span class="sidebar-dot"></span>'}
            <span class="sidebar-title">${branding.name}</span>
            ${roleLabel}
          </div>
        </div>
        <nav class="sidebar-nav">
          ${sidenavHtml}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <span class="user-email">${localStorage.getItem('user_email') || 'Usuário'}</span>
          </div>
          <button class="btn small danger" id="btnLogout">Sair</button>
        </div>
      </aside>
      <main class="app-main">
        <header class="app-header">
          <h1 class="page-title">${title || ''}</h1>
        </header>
        <div class="app-content" data-shell-content></div>
      </main>
    </div>
  `;

  const btn = document.getElementById('btnLogout');
  if (btn) btn.addEventListener('click', logout);
  setActiveNav();
  setupNavigationListeners();
  applyBrandingColors(branding);
}

function applyBrandingColors(branding) {
  document.documentElement.style.setProperty('--primary', branding.primaryColor);
  document.documentElement.style.setProperty('--primary2', branding.secondaryColor);
}
