(async function() {
  ensureAuthed();
  await mountShell({ title: '⚙️ Configurações' });
  renderSettings();
})();

async function renderSettings() {
  const content = document.querySelector('[data-shell-content]');
  if (!content) return;

  content.innerHTML = '<p class="p">Carregando...</p>';

  try {
    const [limitsRes, subscriptionRes, instancesRes] = await Promise.all([
      apiFetch('/api/plans/limits'),
      apiFetch('/api/subscriptions/my'),
      apiFetch('/api/instances')
    ]);

    const limits = limitsRes;
    const subscription = subscriptionRes.subscription;
    const instances = instancesRes.instances || [];

    // Gerar URL base do SaaS
    const saasUrl = window.location.origin;

    content.innerHTML = `
      <div class="grid">
        <div class="card" style="grid-column: span 6;">
          <div class="card-h">
            <p class="h2">👤 Minha Conta</p>
          </div>
          <div class="card-b">
            <div style="margin-bottom: 16px;">
              <label class="p" style="display:block; margin-bottom: 6px;">Email</label>
              <input class="input" type="email" id="userEmail" disabled value="${localStorage.getItem('user_email') || ''}" />
            </div>
            <div style="margin-bottom: 16px;">
              <label class="p" style="display:block; margin-bottom: 6px;">Nova Senha</label>
              <input class="input" type="password" id="newPassword" placeholder="Deixe em branco para manter" />
            </div>
            <div style="margin-bottom: 16px;">
              <label class="p" style="display:block; margin-bottom: 6px;">Confirmar Nova Senha</label>
              <input class="input" type="password" id="confirmPassword" placeholder="Confirme a nova senha" />
            </div>
            <button class="btn primary" id="btnSavePassword">Alterar Senha</button>
          </div>
        </div>

        <div class="card" style="grid-column: span 6;">
          <div class="card-h">
            <p class="h2">💎 Meu Plano</p>
          </div>
          <div class="card-b">
            <div style="background: rgba(0, 212, 255, 0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p class="h3" style="margin: 0 0 8px; color: #00d4ff;">${subscription ? subscription.plan_name : 'Sem plano ativo'}</p>
              ${subscription ? `
                <p class="p" style="margin: 0; font-size: 0.9rem;">
                  Status: <strong style="color: ${subscription.status === 'active' ? '#00ff88' : '#ffaa00'}">${subscription.status}</strong>
                </p>
              ` : '<p class="p" style="margin: 0;">Assine um plano para desbloquear recursos.</p>'}
            </div>
            
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span class="p">Instâncias</span>
                <span class="p">${limits.instances.current} / ${limits.instances.max}</span>
              </div>
              <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: ${limits.instances.current >= limits.instances.max ? '#ff4466' : '#00d4ff'}; height: 100%; width: ${(limits.instances.current / limits.instances.max) * 100}%;"></div>
              </div>
            </div>

            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span class="p">Fluxos</span>
                <span class="p">${limits.flows.current} / ${limits.flows.max}</span>
              </div>
              <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: ${limits.flows.current >= limits.flows.max ? '#ff4466' : '#00d4ff'}; height: 100%; width: ${(limits.flows.current / limits.flows.max) * 100}%;"></div>
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between;">
                <span class="p">API Eventos</span>
                <span class="p" style="color: ${limits.apiEvents.enabled ? '#00ff88' : '#ff4466'};">
                  ${limits.apiEvents.enabled ? '✓ Habilitado' : '✗ Não disponível'}
                </span>
              </div>
            </div>

            <a class="btn small" href="plans.html">Gerenciar Plano</a>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">🔑 API Token</p>
          </div>
          <div class="card-b">
            <p class="p" style="margin-bottom: 12px;">Use este token para integrar com APIs externas (eventos de compra, webhooks, etc.)</p>
            <div style="display: flex; gap: 8px;">
              <input class="input" type="text" id="apiToken" readonly value="${localStorage.getItem('jwt_token') || ''}" style="flex: 1; font-family: monospace; font-size: 0.85rem;" />
              <button class="btn small" id="btnCopyToken">Copiar</button>
            </div>
            <p class="p" style="margin-top: 8px; font-size: 0.8rem; color: rgba(255,255,255,0.5);">
              ⚠️ Mantenha este token em segurança. Não compartilhe publicamente.
            </p>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">� Integração com Plataformas Externas</p>
          </div>
          <div class="card-b">
            <p class="p" style="margin-bottom: 16px;">Use estas informações para conectar sua plataforma de cursos ou outro sistema ao SaaS WhatsApp.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
              <div>
                <label class="p" style="display:block; margin-bottom: 6px; color: rgba(255,255,255,0.6);">URL do SaaS</label>
                <div style="display: flex; gap: 8px;">
                  <input class="input" type="text" id="saasUrl" readonly value="${saasUrl}" style="flex: 1; font-family: monospace;" />
                  <button class="btn small" onclick="copyToClipboard('saasUrl')">Copiar</button>
                </div>
              </div>
              <div>
                <label class="p" style="display:block; margin-bottom: 6px; color: rgba(255,255,255,0.6);">Token de Autenticação</label>
                <div style="display: flex; gap: 8px;">
                  <input class="input" type="text" id="integrationToken" readonly value="${localStorage.getItem('jwt_token') || ''}" style="flex: 1; font-family: monospace; font-size: 0.8rem;" />
                  <button class="btn small" onclick="copyToClipboard('integrationToken')">Copiar</button>
                </div>
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <label class="p" style="display:block; margin-bottom: 8px; color: rgba(255,255,255,0.6);">Suas Instâncias WhatsApp</label>
              ${instances.length > 0 ? `
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: rgba(255,255,255,0.05);">
                        <th style="padding: 12px; text-align: left; color: #00d4ff;">ID</th>
                        <th style="padding: 12px; text-align: left; color: #00d4ff;">Nome</th>
                        <th style="padding: 12px; text-align: left; color: #00d4ff;">Status</th>
                        <th style="padding: 12px; text-align: center; color: #00d4ff;">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${instances.map(inst => `
                        <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                          <td style="padding: 12px; font-family: monospace; font-weight: bold; color: #00ff88;">${inst.id}</td>
                          <td style="padding: 12px;">${inst.name || 'Sem nome'}</td>
                          <td style="padding: 12px;">
                            <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: ${inst.is_connected ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,102,0.2)'}; color: ${inst.is_connected ? '#00ff88' : '#ff4466'};">
                              ${inst.is_connected ? '● Conectado' : '○ Desconectado'}
                            </span>
                          </td>
                          <td style="padding: 12px; text-align: center;">
                            <button class="btn small" onclick="copyToClipboard(null, '${inst.id}')">Copiar ID</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="background: rgba(255,170,0,0.1); border: 1px solid rgba(255,170,0,0.3); border-radius: 8px; padding: 16px; text-align: center;">
                  <p class="p" style="margin: 0; color: #ffaa00;">Nenhuma instância criada. <a href="instances.html" style="color: #00d4ff;">Criar instância</a></p>
                </div>
              `}
            </div>

            <div style="background: rgba(160,32,240,0.1); border: 1px solid rgba(160,32,240,0.3); border-radius: 8px; padding: 16px;">
              <p class="h3" style="margin: 0 0 8px; color: #A020F0;">📋 Como configurar na plataforma de cursos:</p>
              <ol style="margin: 0; padding-left: 20px; color: rgba(255,255,255,0.8); line-height: 1.8;">
                <li>Acesse <strong>Admin → Pagamentos → Integração SaaS</strong></li>
                <li>Cole a <strong>URL do SaaS</strong> acima</li>
                <li>Cole o <strong>Token de Autenticação</strong></li>
                <li>Digite o <strong>ID da Instância</strong> que deseja usar</li>
                <li>Ative a integração e salve</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column: span 12;">
          <div class="card-h">
            <p class="h2">� Documentação da API</p>
          </div>
          <div class="card-b">
            <p class="p" style="margin-bottom: 12px;">Endpoints disponíveis para integração:</p>
            <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 0.85rem;">
              <p style="margin: 0 0 8px; color: #00ff88;">POST /api/triggers/create</p>
              <p style="margin: 0 0 4px; color: rgba(255,255,255,0.7);">Dispara mensagem WhatsApp via instância</p>
              <pre style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow-x: auto;">{
  "instance_id": 1,
  "phone": "5511999999999",
  "event": "purchase_completed",
  "data": {
    "customer_name": "João Silva",
    "product_name": "Curso XYZ",
    "amount": 297.00
  }
}</pre>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnCopyToken').addEventListener('click', () => {
      const tokenInput = document.getElementById('apiToken');
      tokenInput.select();
      document.execCommand('copy');
      alert('Token copiado!');
    });

    // Função global para copiar campos
    window.copyToClipboard = function(inputId, value) {
      if (inputId) {
        const input = document.getElementById(inputId);
        if (input) {
          input.select();
          document.execCommand('copy');
          alert('Copiado!');
        }
      } else if (value) {
        navigator.clipboard.writeText(value).then(() => {
          alert('ID ' + value + ' copiado!');
        });
      }
    };

    document.getElementById('btnSavePassword').addEventListener('click', async () => {
      const newPass = document.getElementById('newPassword').value;
      const confirmPass = document.getElementById('confirmPassword').value;

      if (!newPass) {
        alert('Digite a nova senha');
        return;
      }

      if (newPass !== confirmPass) {
        alert('As senhas não coincidem');
        return;
      }

      if (newPass.length < 6) {
        alert('A senha deve ter pelo menos 6 caracteres');
        return;
      }

      alert('Funcionalidade de alteração de senha será implementada em breve.');
    });

  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    content.innerHTML = '<p class="p" style="color: #ff4466;">Erro ao carregar configurações.</p>';
  }
}
