ensureAuthed();

(async function() {
  await mountShell({ title: 'Instâncias' });
  await render();
})();

function describeApiError(e) {
  const parts = [];
  if (e && e.message) parts.push(e.message);
  if (e && e.data) {
    if (typeof e.data === 'string') {
      parts.push(e.data);
    } else {
      if (e.data.error && e.data.error !== e.message) parts.push(e.data.error);
      if (e.data.details) parts.push(e.data.details);
      if (e.data.status) parts.push(`status: ${e.data.status}`);
    }
  }
  return parts.filter(Boolean).join(' | ') || 'Falha na requisição';
}

function governanceBadges(instance) {
  const badges = [];
  if (Number(instance.flow_active || 0) === 1) {
    badges.push('<span class="badge connected"><span class="b"></span>🟢 Fluxo Ativo</span>');
  }
  if (Number(instance.human_active || 0) === 1) {
    badges.push('<span class="badge connecting"><span class="b"></span>🟡 Atendimento Humano</span>');
  }
  if (Number(instance.blocked_active || 0) === 1) {
    badges.push('<span class="badge disconnected"><span class="b"></span>🔴 Usuário Bloqueado</span>');
  }
  if (Number(instance.inactivity_active || 0) === 1) {
    badges.push('<span class="badge"><span class="b" style="background:var(--warning)"></span>⏳ Em Inatividade</span>');
  }

  if (badges.length === 0) {
    return '<span class="p" style="font-size:12px; color:var(--muted)">Sem regras ativas</span>';
  }

  return `<div class="row" style="gap:6px; margin-top:8px">${badges.join('')}</div>`;
}

function statusBadge(status) {
  const s = (status || 'disconnected').toLowerCase();
  if (s === 'connected') return `<span class="badge connected"><span class="b"></span>connected</span>`;
  if (s === 'connecting') return `<span class="badge connecting"><span class="b"></span>connecting</span>`;
  return `<span class="badge disconnected"><span class="b"></span>disconnected</span>`;
}

function openModal(title, bodyHtml) {
  let modal = document.getElementById('modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="box">
        <div class="box-h">
          <div class="row" style="gap:10px">
            <p class="h2" id="modalTitle" style="margin:0"></p>
          </div>
          <button class="btn small" id="modalClose">Fechar</button>
        </div>
        <div class="box-b" id="modalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.getElementById('modalClose').addEventListener('click', closeModal);
  }
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('open');
}

let statusPollTimer = null;
let lastStatuses = new Map();
let qrModalInstanceId = null;
let qrConnectedHandled = false;
let flowOptions = [];
let socketClient = null;

function flowNameById(flowId) {
  if (!flowId) return 'Sem fluxo';
  const f = flowOptions.find((x) => Number(x.id) === Number(flowId));
  return f ? f.name : `Fluxo #${flowId}`;
}

function flowSelectHtml(instance) {
  const current = instance.flow_id ? Number(instance.flow_id) : 0;
  const options = ['<option value="">Sem fluxo</option>']
    .concat(flowOptions.map((f) => {
      const selected = Number(f.id) === current ? 'selected' : '';
      return `<option value="${f.id}" ${selected}>${escapeHtml(f.name)}</option>`;
    }))
    .join('');

  return `
    <div class="row" style="gap:8px; align-items:center">
      <select class="input" data-flow-select="${instance.id}" style="min-width:160px; max-width:200px">${options}</select>
      <button class="btn small" data-act="bind-flow" data-id="${instance.id}">Vincular</button>
    </div>
  `;
}

async function render() {
  const content = document.querySelector('[data-shell-content]');
  content.innerHTML = `
    <div class="grid">
      <div class="card" style="grid-column: span 12;">
        <div class="card-h">
          <div>
            <p class="h2">Criar nova instância</p>
            <p class="p">Crie instâncias por cliente e conecte via QR Code.</p>
          </div>
        </div>
        <div class="card-b">
          <div class="row" style="gap:10px">
            <div style="flex:1; min-width:220px">
              <input class="input" id="instanceName" placeholder="Nome da instância (ex: meu-whatsapp)" />
            </div>
            <button class="btn primary" id="btnCreate">Criar</button>
            <button class="btn" id="btnReload">Atualizar</button>
          </div>
        </div>
      </div>

      <div class="card" style="grid-column: span 12;">
        <div class="card-h">
          <p class="h2">Lista de instâncias</p>
        </div>
        <div class="card-b">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Fluxo ativo</th>
                <th style="width:420px">Ações</th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnCreate').addEventListener('click', createInstance);
  document.getElementById('btnReload').addEventListener('click', loadInstances);

  await loadFlows();
  await loadInstances();
  initRealtime();
}

async function loadFlows() {
  try {
    const data = await apiFetch('/api/flows');
    flowOptions = data.flows || [];
  } catch (e) {
    flowOptions = [];
  }
}

async function loadInstances() {
  const tbody = document.getElementById('rows');
  tbody.innerHTML = `<tr><td colspan="5" style="background:transparent; border:none; color:var(--muted)">Carregando...</td></tr>`;

  try {
    const data = await apiFetch('/api/instances');
    const instances = data.instances || [];

    if (instances.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="background:transparent; border:none; color:var(--muted)">Nenhuma instância cadastrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = instances.map(i => {
      return `
        <tr>
          <td>${i.id}</td>
          <td>${escapeHtml(i.instance_name)}</td>
          <td>${statusBadge(i.status)}</td>
          <td>
            ${flowSelectHtml(i)}
            <div class="p" style="margin-top:6px; font-size:12px; color:var(--muted)">${escapeHtml(i.flow_name || flowNameById(i.flow_id))}</div>
            ${governanceBadges(i)}
          </td>
          <td>
            <div class="row" style="gap:8px">
              <button class="btn small primary" data-act="connect" data-id="${i.id}">Conectar</button>
              <button class="btn small" data-act="qrcode" data-id="${i.id}">QR Code</button>
              <button class="btn small" data-act="disconnect" data-id="${i.id}">Desconectar</button>
              <button class="btn small danger" data-act="delete" data-id="${i.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.getAttribute('data-act'), btn.getAttribute('data-id')));
    });

    lastStatuses = new Map(instances.map(i => [i.id, (i.status || 'disconnected')]));
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="background:transparent; border:none; color:var(--muted)">Erro: ${escapeHtml(e.message || 'falha')}</td></tr>`;
    toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
  }
}

async function pollStatuses() {
  try {
    const data = await apiFetch('/api/instances');
    const instances = data.instances || [];

    const next = new Map(instances.map(i => [i.id, (i.status || 'disconnected')]));
    let changed = false;
    for (const [id, st] of next.entries()) {
      const prev = lastStatuses.get(id);
      if (prev && prev !== st) changed = true;
    }
    if (changed) {
      await loadInstances();
    }

    if (qrModalInstanceId && !qrConnectedHandled) {
      const st = next.get(qrModalInstanceId);
      if (String(st || '').toLowerCase() === 'connected') {
        qrConnectedHandled = true;
        toast({ title: 'Sucesso', message: `Instância ${qrModalInstanceId} conectada`, type: 'success' });
        setTimeout(async () => {
          closeModal();
          qrModalInstanceId = null;
          qrConnectedHandled = false;
          await loadInstances();
        }, 3000);
      }
    }
  } catch (e) {
  }
}

async function createInstance() {
  const name = (document.getElementById('instanceName').value || '').trim();
  if (!name) {
    toast({ title: 'Atenção', message: 'Informe um nome para a instância', type: 'warning' });
    return;
  }

  try {
    await apiFetch('/api/instances', { method: 'POST', body: { instance_name: name } });
    toast({ title: 'OK', message: 'Instância criada com sucesso', type: 'success' });
    document.getElementById('instanceName').value = '';
    await loadInstances();
  } catch (e) {
    toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
  }
}

async function handleAction(action, id) {
  const instanceId = parseInt(id);

  if (action === 'connect') {
    try {
      await apiFetch(`/api/instances/${instanceId}/connect`, { method: 'POST' });
      toast({ title: 'Conectando', message: 'A conexão foi iniciada. Gere o QR Code.', type: 'success' });
      await loadInstances();
    } catch (e) {
      toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
    }
    return;
  }

  if (action === 'disconnect') {
    try {
      await apiFetch(`/api/instances/${instanceId}/disconnect`, { method: 'POST' });
      toast({ title: 'OK', message: 'Instância desconectada', type: 'success' });
      await loadInstances();
    } catch (e) {
      toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
    }
    return;
  }

  if (action === 'delete') {
    if (!confirm('Deseja excluir esta instância?')) return;
    try {
      await apiFetch(`/api/instances/${instanceId}`, { method: 'DELETE' });
      toast({ title: 'OK', message: 'Instância removida', type: 'success' });
      await loadInstances();
    } catch (e) {
      toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
    }
    return;
  }

  if (action === 'qrcode') {
    await showQrCode(instanceId);
    return;
  }

  if (action === 'bind-flow') {
    const el = document.querySelector(`[data-flow-select="${instanceId}"]`);
    const flowId = el ? el.value : '';
    try {
      await apiFetch(`/api/instances/${instanceId}/flow`, {
        method: 'PUT',
        body: { flow_id: flowId === '' ? null : Number(flowId) }
      });
      toast({ title: 'OK', message: 'Fluxo da instância atualizado', type: 'success' });
      await loadInstances();
    } catch (e) {
      toast({ title: 'Erro', message: describeApiError(e), type: 'danger' });
    }
    return;
  }
}

async function showQrCode(instanceId) {
  const knownStatus = (lastStatuses.get(instanceId) || '').toLowerCase();
  if (knownStatus === 'connected') {
    toast({ title: 'Instância conectada', message: 'Esta instância já está conectada.', type: 'warning' });
    return;
  }

  qrModalInstanceId = instanceId;
  qrConnectedHandled = false;
  openModal(`QR Code - Instância ${instanceId}`, `
    <div class="row" style="gap:10px; align-items:flex-start">
      <div style="flex:1">
        <p class="p" style="margin-top:0">Clique em <b>Atualizar QR</b> até aparecer a imagem. Depois escaneie no WhatsApp.</p>
        <div class="row" style="gap:8px">
          <button class="btn primary small" id="btnRefreshQr">Atualizar QR</button>
          <button class="btn small" id="btnClose">Fechar</button>
        </div>
      </div>
      <div style="width:260px">
        <div class="card" style="box-shadow:none">
          <div class="card-b" style="padding:14px">
            <div id="qrWrap" style="display:grid; place-items:center; min-height:240px; color:var(--muted)">Aguardando...</div>
          </div>
        </div>
      </div>
    </div>
  `);

  document.getElementById('btnClose').addEventListener('click', () => {
    qrModalInstanceId = null;
    qrConnectedHandled = false;
    closeModal();
  });
  document.getElementById('btnRefreshQr').addEventListener('click', () => loadQr(instanceId));
  await loadQr(instanceId);
}

async function loadQr(instanceId) {
  const qrWrap = document.getElementById('qrWrap');
  qrWrap.textContent = 'Carregando...';

  try {
    const data = await apiFetch(`/api/instances/${instanceId}/qrcode`);
    const src = data.qrcode;
    qrWrap.innerHTML = `<img alt="QR Code" src="${src}" style="width:220px; height:220px; border-radius:12px; background:#fff; padding:10px" />`;
  } catch (e) {
    const st = (e && e.data && e.data.status) ? String(e.data.status).toLowerCase() : '';
    if (st === 'connected') {
      qrWrap.textContent = 'Instância já conectada.';
      toast({ title: 'Instância conectada', message: 'Esta instância já está conectada.', type: 'warning' });
      return;
    }
    qrWrap.textContent = e.message || 'QR Code não disponível';
    toast({ title: 'QR Code', message: describeApiError(e), type: 'warning' });
  }
}

function initRealtime() {
  if (typeof window.io !== 'function') return;
  if (socketClient) return;

  const token = getToken();
  if (!token) return;

  const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  socketClient = window.io(base, {
    transports: ['websocket'],
    auth: { token }
  });

  socketClient.on('instance:event', (payload) => {
    const instanceId = Number(payload?.instanceId || 0);
    if (!instanceId) return;

    if (payload.status) {
      lastStatuses.set(instanceId, String(payload.status).toLowerCase());
      loadInstances().catch(() => {});
    }

    if (payload.event === 'INSTANCE_QR_UPDATED' && qrModalInstanceId === instanceId) {
      const qrWrap = document.getElementById('qrWrap');
      if (qrWrap && payload.qrcode) {
        qrWrap.innerHTML = `<img alt="QR Code" src="${payload.qrcode}" style="width:220px; height:220px; border-radius:12px; background:#fff; padding:10px" />`;
      }
    }

    if (payload.event === 'INSTANCE_CONNECTED' && qrModalInstanceId === instanceId) {
      qrConnectedHandled = true;
      toast({ title: 'Sucesso', message: `Instância ${instanceId} conectada`, type: 'success' });
      setTimeout(async () => {
        closeModal();
        qrModalInstanceId = null;
        qrConnectedHandled = false;
        await loadInstances();
      }, 3000);
    }

    if (payload.event === 'INSTANCE_LOGGED_OUT') {
      toast({ title: 'Sessão expirada', message: `Instância ${instanceId} foi desconectada do WhatsApp`, type: 'warning' });
    }
  });

  socketClient.on('connect', () => {
    if (qrModalInstanceId) {
      socketClient.emit('instance:subscribe', { instanceId: qrModalInstanceId });
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if (statusPollTimer) clearInterval(statusPollTimer);
statusPollTimer = setInterval(pollStatuses, 3000);
