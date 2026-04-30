ensureAuthed();

// Redirecionar admin para admin-dashboard
(async function() {
  const role = await checkUserRole();
  if (role === 'admin') {
    window.location.href = 'admin-dashboard.html';
    return;
  }
  await mountShell({ title: 'Meu Painel' });
  loadDashboard();
})();

async function loadDashboard() {
  const content = document.querySelector('[data-shell-content]');
  content.innerHTML = '<p class="p">Carregando...</p>';

  try {
    const [instances, flows, limits, subscription] = await Promise.all([
      apiFetch('/api/instances'),
      apiFetch('/api/flows'),
      apiFetch('/api/plans/limits'),
      apiFetch('/api/subscriptions/my')
    ]);

    const all = instances.instances || [];
    const connected = all.filter(i => i.status === 'connected').length;
    const flowsList = flows.flows || [];
    const sub = subscription.subscription;

    content.innerHTML = `
      <div class="grid">
        <!-- Plano Atual -->
        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">💎 Meu Plano</p>
          </div>
          <div class="card-b">
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;">
              <div style="background:linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,255,136,0.1)); padding:16px 24px; border-radius:12px;">
                <p style="font-size:1.5rem;font-weight:800;color:#00d4ff;margin:0;">${sub ? sub.plan_name : 'Sem plano'}</p>
                <p class="p" style="margin:4px 0 0;">${sub ? `Status: ${sub.status}` : 'Assine um plano para começar'}</p>
              </div>
              <div style="flex:1;">
                <div style="margin-bottom:12px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span class="p">Instâncias</span>
                    <span class="p">${limits.instances.current} / ${limits.instances.max}</span>
                  </div>
                  <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden;">
                    <div style="background:${limits.instances.current >= limits.instances.max ? '#ff4466' : '#00d4ff'};height:100%;width:${Math.min(100, (limits.instances.current / limits.instances.max) * 100)}%;"></div>
                  </div>
                </div>
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span class="p">Fluxos</span>
                    <span class="p">${limits.flows.current} / ${limits.flows.max}</span>
                  </div>
                  <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden;">
                    <div style="background:${limits.flows.current >= limits.flows.max ? '#ff4466' : '#00d4ff'};height:100%;width:${Math.min(100, (limits.flows.current / limits.flows.max) * 100)}%;"></div>
                  </div>
                </div>
              </div>
              ${!sub ? '<a class="btn primary" href="plans.html">Assinar Plano</a>' : ''}
            </div>
          </div>
        </div>

        <!-- Resumo Rápido -->
        <div class="card" style="grid-column: span 4;">
          <div class="card-b" style="text-align:center;">
            <p style="font-size:2.5rem;font-weight:800;color:#00d4ff;margin:0;">${all.length}</p>
            <p class="p">Instâncias</p>
            <p style="font-size:0.875rem;color:#00ff88;">${connected} conectadas</p>
          </div>
        </div>
        <div class="card" style="grid-column: span 4;">
          <div class="card-b" style="text-align:center;">
            <p style="font-size:2.5rem;font-weight:800;color:#00d4ff;margin:0;">${flowsList.length}</p>
            <p class="p">Fluxos</p>
            <p style="font-size:0.875rem;color:rgba(255,255,255,0.5);">${flowsList.filter(f => f.is_active).length} ativos</p>
          </div>
        </div>
        <div class="card" style="grid-column: span 4;">
          <div class="card-b" style="text-align:center;">
            <p style="font-size:2.5rem;font-weight:800;color:${limits.apiEvents.enabled ? '#00ff88' : '#ff4466'};margin:0;">${limits.apiEvents.enabled ? '✓' : '✗'}</p>
            <p class="p">API Eventos</p>
            <p style="font-size:0.875rem;color:rgba(255,255,255,0.5);">${limits.apiEvents.enabled ? 'Habilitado' : 'Não disponível'}</p>
          </div>
        </div>

        <!-- Ações Rápidas -->
        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">⚡ Ações Rápidas</p>
          </div>
          <div class="card-b">
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <a class="btn primary" href="instances.html">📱 Gerenciar Instâncias</a>
              <a class="btn primary" href="flows.html">🔄 Gerenciar Fluxos</a>
              <a class="btn" href="analytics.html">📊 Ver Analytics</a>
              <a class="btn" href="settings.html">⚙️ Configurações</a>
            </div>
          </div>
        </div>

        <!-- Minhas Instâncias -->
        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">📱 Minhas Instâncias</p>
            <a class="btn small primary" href="instances.html">+ Nova Instância</a>
          </div>
          <div class="card-b">
            ${all.length === 0 ? '<p class="p">Nenhuma instância criada. <a href="instances.html">Criar agora</a></p>' : `
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:12px;">
                ${all.slice(0, 6).map(inst => `
                  <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px;">
                    <div style="width:12px;height:12px;border-radius:50%;background:${inst.status === 'connected' ? '#00ff88' : inst.status === 'connecting' ? '#ffaa00' : '#ff4466'};"></div>
                    <div style="flex:1;">
                      <p style="margin:0;font-weight:600;">${inst.instance_name}</p>
                      <p style="margin:0;font-size:0.75rem;color:rgba(255,255,255,0.5);">${inst.status || 'pending'}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
              ${all.length > 6 ? `<p class="p" style="margin-top:12px;"><a href="instances.html">Ver todas (${all.length})</a></p>` : ''}
            `}
          </div>
        </div>
      </div>
    `;

  } catch (e) {
    console.error('Erro:', e);
    content.innerHTML = '<p class="p" style="color:#ff4466;">Erro ao carregar dashboard.</p>';
  }
}
