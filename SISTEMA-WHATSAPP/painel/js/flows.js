ensureAuthed();

(async function() {
  await mountShell({ title: 'Fluxos' });
  render();
})();

const DEFAULT_FLOW_DATA = {
  steps: {
    start: {
      message: 'Olá! Digite 1 para continuar',
      options: [{ trigger: '1', next: 'end', response: 'Perfeito. Obrigado!' }]
    }
  }
};

let flowDraftData = null;
let builderState = null;
const BUILDER_NODE_WIDTH = 160;
const BUILDER_NODE_HEIGHT = 110;

const RULE_TYPES = [
  { value: 'message', label: 'Mensagem' },
  { value: 'delay', label: 'Delay' },
  { value: 'menu', label: 'Menu de opções' },
  { value: 'buttons', label: 'Botões' },
  { value: 'list', label: 'Lista de opções' },
  { value: 'image', label: 'Imagem' },
  { value: 'audio', label: 'Áudio' },
  { value: 'video', label: 'Vídeo' },
  { value: 'return_menu', label: 'Retornar ao Menu' },
  { value: 'end_flow', label: 'Finalizar Atendimento' },
  { value: 'rule_limit_access', label: 'Regra: Limite de acesso' },
  { value: 'rule_inactivity', label: 'Regra: Inatividade' },
  { value: 'rule_block_user', label: 'Regra: Bloqueio temporário' },
  { value: 'rule_human_takeover', label: 'Regra: Atendimento humano' },
  { value: 'rule_business_hours', label: 'Regra: Janela de atendimento' },
  { value: 'rule_reset', label: 'Regra: Reset de fluxo' }
];

function getFlowIdFromRoute() {
  const u = new URL(window.location.href);
  const queryId = u.searchParams.get('flow_id');
  const fromQuery = Number(queryId || 0);
  if (fromQuery > 0) return fromQuery;

  const m = window.location.pathname.match(/\/dashboard\/flows\/(\d+)/i);
  if (m && Number(m[1]) > 0) return Number(m[1]);
  return 0;
}

function stepNextFromLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return '';
  const first = links.find((x) => !x.trigger) || links[0];
  return first && first.to ? String(first.to) : '';
}

function formatNodeTypeLabel(type) {
  const found = RULE_TYPES.find((r) => r.value === type);
  return found ? found.label : (type || 'Mensagem');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
          <p class="h2" id="modalTitle" style="margin:0"></p>
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
  if (!modal) return;
  modal.classList.remove('open');
  const box = modal.querySelector('.box');
  if (box) box.classList.remove('builder-fullscreen');
}

async function render() {
  const content = document.querySelector('[data-shell-content]');
  content.innerHTML = `
    <div class="grid">
      <div class="card" style="grid-column: span 12;">
        <div class="card-h">
          <div>
            <p class="h2">Criar fluxo</p>
            <p class="p">Crie uma palavra-chave e uma resposta automática simples. O fluxo é salvo via API.</p>
          </div>
        </div>
        <div class="card-b">
          <div class="split">
            <div>
              <label class="p" style="display:block; margin:0 0 6px">Nome do fluxo</label>
              <input class="input" id="flowName" placeholder="Ex: Boas-vindas" />

              <div class="row" style="margin-top:10px">
                <div style="flex:1">
                  <label class="p" style="display:block; margin:0 0 6px">Tipo de Disparo</label>
                  <select class="input" id="triggerType">
                    <option value="single">Palavra única</option>
                    <option value="multiple">Múltiplas palavras</option>
                    <option value="any">Qualquer mensagem</option>
                  </select>
                </div>
              </div>

              <div class="row" style="margin-top:10px" id="triggerInputRow">
                <div style="flex:1">
                  <label class="p" style="display:block; margin:0 0 6px">Palavra-chave (trigger)</label>
                  <input class="input" id="trigger" placeholder="Ex: oi" />
                  <p class="p" style="font-size:11px; color:var(--muted); margin-top:4px" id="triggerHint">Digite uma palavra para disparar o fluxo</p>
                </div>
                <div style="flex:1">
                  <label class="p" style="display:block; margin:0 0 6px">Resposta</label>
                  <input class="input" id="response" placeholder="Ex: Olá! Como posso ajudar?" />
                </div>
              </div>

              <div class="row" style="margin-top:10px">
                <label class="row" style="gap:8px; align-items:center">
                  <input type="checkbox" id="isActive" />
                  <span class="p" style="margin:0">Ativar fluxo</span>
                </label>
                <div class="spacer"></div>
                <button class="btn" id="btnBuilder">Builder de blocos</button>
                <button class="btn" id="btnAdvanced">Editar JSON</button>
                <button class="btn primary" id="btnCreate">Salvar</button>
              </div>

              <p class="p" style="margin-top:10px">Dica: este painel cria um fluxo simples com "start" e uma opção de trigger.</p>
            </div>

            <div>
              <div class="card" style="box-shadow:none">
                <div class="card-h"><p class="h2">Preview do JSON</p></div>
                <div class="card-b">
                  <pre id="preview" style="margin:0; white-space:pre-wrap; color:var(--muted);"></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="grid-column: span 12;">
        <div class="card-h">
          <p class="h2">Fluxos cadastrados</p>
          <div class="row" style="gap:8px">
            <button class="btn small primary" id="btnNewFlow">Criar Novo Fluxo</button>
            <button class="btn small" id="btnReload">Atualizar</button>
          </div>
        </div>
        <div class="card-b">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Ativo</th>
                <th style="width:360px">Ações</th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btnReload').addEventListener('click', loadFlows);
  document.getElementById('btnNewFlow').addEventListener('click', () => {
    document.getElementById('flowName').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('btnCreate').addEventListener('click', createFlow);
  document.getElementById('btnBuilder').addEventListener('click', openBlockBuilder);
  document.getElementById('btnAdvanced').addEventListener('click', openAdvanced);

  ['flowName', 'trigger', 'response', 'isActive', 'triggerType'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    }
  });

  // Listener para tipo de disparo
  document.getElementById('triggerType').addEventListener('change', function() {
    const type = this.value;
    const triggerRow = document.getElementById('triggerInputRow');
    const triggerInput = document.getElementById('trigger');
    const triggerHint = document.getElementById('triggerHint');
    
    if (type === 'any') {
      triggerRow.style.display = 'none';
    } else {
      triggerRow.style.display = 'flex';
      if (type === 'multiple') {
        triggerInput.placeholder = 'Ex: oi, olá, menu, bom dia';
        triggerHint.textContent = 'Separe as palavras por vírgula';
      } else {
        triggerInput.placeholder = 'Ex: oi';
        triggerHint.textContent = 'Digite uma palavra para disparar o fluxo';
      }
    }
    updatePreview();
  });

  updatePreview();
  await loadFlows();

  const routeFlowId = getFlowIdFromRoute();
  if (routeFlowId > 0) {
    await openEditBuilder(routeFlowId);
  }
}

function buildFlowDataFromSimple() {
  const triggerType = document.getElementById('triggerType')?.value || 'single';
  const triggerRaw = (document.getElementById('trigger').value || '').trim();
  const response = (document.getElementById('response').value || '').trim();

  const data = JSON.parse(JSON.stringify(DEFAULT_FLOW_DATA));
  
  // Configuração de disparo no nível do fluxo
  data.trigger_config = {
    type: triggerType,
    keywords: []
  };

  if (triggerType === 'any') {
    // Qualquer mensagem dispara
    data.trigger_config.keywords = ['*'];
    data.steps.start.message = response || 'Olá! Como posso ajudar?';
    data.steps.start.options = [];
  } else if (triggerType === 'multiple') {
    // Múltiplas palavras
    const keywords = triggerRaw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    data.trigger_config.keywords = keywords;
    data.steps.start.message = response || 'Olá! Como posso ajudar?';
    data.steps.start.options = [];
    if (keywords.length > 0) {
      data.steps.start.message = `Envie uma das palavras: ${keywords.join(', ')}`;
    }
  } else {
    // Palavra única (modo atual)
    if (triggerRaw) {
      data.trigger_config.keywords = [triggerRaw.toLowerCase()];
      data.steps.start.options = [{ trigger: triggerRaw, next: 'end', response: response || 'OK' }];
      data.steps.start.message = `Envie "${triggerRaw}" para receber uma resposta automática.`;
    }
  }

  return data;
}

function updatePreview() {
  const preview = document.getElementById('preview');
  const data = flowDraftData || buildFlowDataFromSimple();
  preview.textContent = JSON.stringify(data, null, 2);
}

async function createFlow() {
  const name = (document.getElementById('flowName').value || '').trim();
  const isActive = document.getElementById('isActive').checked;

  if (!name) {
    toast({ title: 'Atenção', message: 'Informe o nome do fluxo', type: 'warning' });
    return;
  }

  const flow_data = flowDraftData || buildFlowDataFromSimple();

  try {
    await apiFetch('/api/flows', {
      method: 'POST',
      body: { name, is_active: isActive, flow_data, structure_json: flow_data }
    });
    toast({ title: 'OK', message: 'Fluxo salvo com sucesso', type: 'success' });
    document.getElementById('flowName').value = '';
    document.getElementById('trigger').value = '';
    document.getElementById('response').value = '';
    document.getElementById('isActive').checked = false;
    flowDraftData = null;
    updatePreview();
    await loadFlows();
  } catch (e) {
    toast({ title: 'Erro', message: e.message, type: 'danger' });
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBuilderBounds() {
  if (!builderState || !Array.isArray(builderState.nodes) || builderState.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;

  for (const node of builderState.nodes) {
    minX = Math.min(minX, Number(node.x || 0));
    minY = Math.min(minY, Number(node.y || 0));
    maxX = Math.max(maxX, Number(node.x || 0) + BUILDER_NODE_WIDTH + 120);
    maxY = Math.max(maxY, Number(node.y || 0) + BUILDER_NODE_HEIGHT + 120);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1200, maxX + 120),
    height: Math.max(800, maxY + 120)
  };
}

function setBuilderZoom(nextZoom, { keepCenter = true } = {}) {
  const area = document.getElementById('builderCanvasArea');
  if (!area || !builderState) return;

  const currentZoom = Number(builderState.zoom || 1);
  const zoom = clamp(Number(nextZoom || 1), 0.4, 2.5);
  if (Math.abs(currentZoom - zoom) < 0.001) return;

  let centerX = 0;
  let centerY = 0;
  if (keepCenter) {
    centerX = area.scrollLeft + area.clientWidth / 2;
    centerY = area.scrollTop + area.clientHeight / 2;
  }

  builderState.zoom = zoom;
  renderBuilderCanvas();

  if (keepCenter) {
    const ratio = zoom / currentZoom;
    area.scrollLeft = Math.max(0, centerX * ratio - area.clientWidth / 2);
    area.scrollTop = Math.max(0, centerY * ratio - area.clientHeight / 2);
  }

  const zoomLabel = document.getElementById('builderZoomLabel');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function fitBuilderToViewport() {
  const area = document.getElementById('builderCanvasArea');
  if (!area || !builderState) return;
  const bounds = getBuilderBounds();
  const zoomX = (area.clientWidth - 40) / bounds.width;
  const zoomY = (area.clientHeight - 40) / bounds.height;
  const nextZoom = clamp(Math.min(zoomX, zoomY), 0.4, 2.5);
  builderState.zoom = nextZoom;
  renderBuilderCanvas();
  area.scrollLeft = 0;
  area.scrollTop = 0;

  const zoomLabel = document.getElementById('builderZoomLabel');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(nextZoom * 100)}%`;
}

const BUILDER_BLOCK_CATALOG = [
  {
    title: 'Conteúdo',
    items: [
      { type: 'message', label: 'Mensagem' },
      { type: 'delay', label: '⏳ Delay' },
      { type: 'menu', label: 'Menu de opções' },
      { type: 'buttons', label: 'Botões' },
      { type: 'list', label: 'Lista' },
      { type: 'image', label: 'Imagem' },
      { type: 'audio', label: 'Áudio' },
      { type: 'video', label: 'Vídeo' }
    ]
  },
  {
    title: 'Governança',
    items: [
      { type: 'rule_limit_access', label: 'Limite de acesso' },
      { type: 'rule_inactivity', label: 'Inatividade' },
      { type: 'rule_block_user', label: 'Bloqueio temporário' },
      { type: 'rule_human_takeover', label: 'Atendimento humano' },
      { type: 'rule_business_hours', label: 'Janela de atendimento' },
      { type: 'rule_reset', label: 'Reset de fluxo' }
    ]
  }
];

function builderNodeOutputs(node) {
  if (!node) return [];
  if (['menu', 'buttons', 'list'].includes(node.type)) {
    const opts = Array.isArray(node.data?.options) ? node.data.options : [];
    return opts.map((opt, idx) => ({ id: `opt_${idx}`, label: String(opt?.label || `Opção ${idx + 1}`) }));
  }
  return [{ id: 'next', label: 'Próximo' }];
}

function ensureStartNode(state) {
  if (state.nodes.some((n) => n.id === 'start')) return;
  state.nodes.unshift({
    id: 'start',
    title: 'start',
    type: 'message',
    x: 80,
    y: 80,
    isStart: true,
    data: { text: 'Olá! Seja bem-vindo(a).' }
  });
}

function makeBuilderNode(type, x, y, idOverride = null) {
  const id = idOverride || `node_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
  const node = {
    id,
    title: id,
    type,
    x: Number(x || 100),
    y: Number(y || 100),
    isStart: id === 'start',
    data: { text: 'Nova mensagem' }
  };

  if (['menu', 'buttons', 'list'].includes(type)) {
    node.data = {
      title: 'Escolha uma opção:',
      options: [{ label: 'Opção 1' }, { label: 'Opção 2' }]
    };
  } else if (type === 'delay') {
    node.data = { seconds: 3, typing: true };
  } else if (['image', 'audio', 'video'].includes(type)) {
    node.data = { caption: `Mensagem de ${type}`, url: '' };
  } else if (String(type).startsWith('rule_')) {
    node.data = { config: {} };
  } else if (type === 'return_menu') {
    node.data = { text: 'Voltando ao menu principal...' };
  } else if (type === 'end_flow') {
    node.data = { text: 'Obrigado pelo contato! Atendimento finalizado.' };
  }

  return node;
}

function createDefaultBuilderState(existingFlowData, opts = {}) {
  const steps = (existingFlowData && existingFlowData.steps) ? existingFlowData.steps : DEFAULT_FLOW_DATA.steps;
  const nodes = [];
  const links = [];
  const keys = Object.keys(steps || {});

  keys.forEach((nodeId, idx) => {
    const step = steps[nodeId] || {};
    let type = String(step.type || '').trim();
    if (!type) {
      if (Array.isArray(step.options) && step.options.length > 1) type = 'menu';
      else type = 'message';
    }

    const posX = step._position?.x ?? (60 + (idx % 3) * 260);
    const posY = step._position?.y ?? (70 + Math.floor(idx / 3) * 180);
    const node = makeBuilderNode(type, posX, posY, nodeId);
    node.isStart = nodeId === 'start';

    if (['menu', 'buttons', 'list'].includes(type)) {
      node.data.title = step.message || 'Escolha uma opção:';
      node.data.options = (Array.isArray(step.options) ? step.options : []).map((opt) => ({
        label: String(opt?.trigger || opt?.label || 'Opção')
      }));
      if (node.data.options.length === 0) {
        node.data.options = [{ label: 'Opção 1' }, { label: 'Opção 2' }];
      }
    } else if (['image', 'audio', 'video'].includes(type)) {
      node.data.caption = step.message || '';
      node.data.url = step.media?.url || '';
    } else if (type === 'delay') {
      node.data.seconds = Number(step?.data?.seconds ?? step?.config?.seconds ?? step?.seconds ?? 3);
      node.data.typing = Boolean(step?.data?.typing ?? step?.config?.typing ?? step?.typing ?? false);
    } else if (String(type).startsWith('rule_')) {
      node.data.config = step.config && typeof step.config === 'object' ? step.config : {};
    } else if (type === 'return_menu' || type === 'end_flow') {
      node.data.text = step.message || '';
    } else {
      node.data.text = step.message || '';
    }

    nodes.push(node);

    if (Array.isArray(step.options) && step.options.length > 0) {
      step.options.forEach((opt, optIdx) => {
        if (!opt?.next) return;
        links.push({ from: nodeId, fromHandle: `opt_${optIdx}`, to: String(opt.next) });
      });
    } else if (step.next) {
      links.push({ from: nodeId, fromHandle: 'next', to: String(step.next) });
    }
  });

  const state = {
    flowId: Number(opts.flowId || 0),
    nodes,
    links,
    selectedNodeId: 'start',
    drag: null,
    zoom: 1,
    pan: null,
    connecting: null
  };

  ensureStartNode(state);
  return state;
}

function buildFlowDataFromBuilderState(state) {
  const steps = {};
  const linksBySource = new Map();
  (state.links || []).forEach((l) => {
    if (!l?.from || !l?.to) return;
    if (!linksBySource.has(l.from)) linksBySource.set(l.from, []);
    linksBySource.get(l.from).push(l);
  });

  (state.nodes || []).forEach((node) => {
    const outputLinks = linksBySource.get(node.id) || [];
    const step = {};

    if (['menu', 'buttons', 'list'].includes(node.type)) {
      step.type = node.type;
      step.message = String(node.data?.title || 'Escolha uma opção:');
      step.options = (Array.isArray(node.data?.options) ? node.data.options : []).map((opt, idx) => {
        const link = outputLinks.find((l) => l.fromHandle === `opt_${idx}`);
        return {
          trigger: String(opt?.label || `Opção ${idx + 1}`),
          label: String(opt?.label || `Opção ${idx + 1}`),
          next: link?.to || ''
        };
      });
    } else if (['image', 'audio', 'video'].includes(node.type)) {
      step.type = node.type;
      step.message = String(node.data?.caption || '');
      if (node.data?.url) {
        step.media = { type: node.type, url: String(node.data.url) };
      }
      const nextLink = outputLinks.find((l) => l.fromHandle === 'next');
      if (nextLink?.to) step.next = String(nextLink.to);
    } else if (node.type === 'delay') {
      step.type = 'delay';
      step.data = {
        seconds: Math.max(0, Number(node.data?.seconds || 0)),
        typing: Boolean(node.data?.typing)
      };
      const nextLink = outputLinks.find((l) => l.fromHandle === 'next');
      if (nextLink?.to) step.next = String(nextLink.to);
    } else if (String(node.type || '').startsWith('rule_')) {
      step.type = node.type;
      step.message = String(node.data?.text || '');
      step.config = node.data?.config && typeof node.data.config === 'object' ? node.data.config : {};
      const nextLink = outputLinks.find((l) => l.fromHandle === 'next');
      if (nextLink?.to) step.next = String(nextLink.to);
    } else if (node.type === 'return_menu') {
      step.type = 'return_menu';
      step.message = String(node.data?.text || '');
    } else if (node.type === 'end_flow') {
      step.type = 'end_flow';
      step.message = String(node.data?.text || '');
    } else {
      step.message = String(node.data?.text || '');
      const nextLink = outputLinks.find((l) => l.fromHandle === 'next');
      if (nextLink?.to) step.next = String(nextLink.to);
    }

    step._position = { x: node.x, y: node.y };

    steps[node.id] = step;
  });

  return { steps };
}

async function persistBuilderFlow(flowId) {
  if (!flowId || !builderState) return;
  const builtData = buildFlowDataFromBuilderState(builderState);
  await apiFetch(`/api/flows/${flowId}`, {
    method: 'PUT',
    body: { flow_data: builtData, structure_json: builtData }
  });
}

async function uploadFlowMediaWithFallback({ file, flowId, mediaType }) {
  const endpoints = ['/api/upload', '/api/flows/upload'];
  let last404 = null;

  for (const endpoint of endpoints) {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('flow_id', String(flowId));
      form.append('media_type', String(mediaType || ''));
      return await apiFetch(endpoint, { method: 'POST', body: form });
    } catch (e) {
      if (Number(e?.status || 0) !== 404) {
        throw e;
      }
      last404 = e;
    }
  }

  throw last404 || new Error('Endpoint de upload não encontrado');
}

function syncLinksWithNodeOutputs(node) {
  if (!builderState || !node) return;
  const validHandles = new Set(builderNodeOutputs(node).map((o) => o.id));
  builderState.links = builderState.links.filter((l) => {
    if (l.from !== node.id) return true;
    return validHandles.has(l.fromHandle);
  });
}

function connectNodeHandle(from, fromHandle, to) {
  const existing = builderState.links.find((l) => l.from === from && l.fromHandle === fromHandle);
  if (existing) existing.to = to;
  else builderState.links.push({ from, fromHandle, to });
}

function truncateText(text, maxWords = 5) {
  if (!text) return '';
  const words = String(text).trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

function getNodeColors(type, isStart) {
  if (isStart) {
    return { border: 'rgba(34,197,94,.8)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(15,60,30,.6) 100%)' };
  }
  const colors = {
    message: { border: 'rgba(99,179,237,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(30,64,100,.5) 100%)' },
    menu: { border: 'rgba(129,140,248,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(55,48,107,.5) 100%)' },
    buttons: { border: 'rgba(129,140,248,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(55,48,107,.5) 100%)' },
    list: { border: 'rgba(129,140,248,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(55,48,107,.5) 100%)' },
    delay: { border: 'rgba(251,191,36,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(92,72,15,.5) 100%)' },
    image: { border: 'rgba(52,211,153,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(20,83,60,.5) 100%)' },
    video: { border: 'rgba(52,211,153,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(20,83,60,.5) 100%)' },
    audio: { border: 'rgba(52,211,153,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(20,83,60,.5) 100%)' },
    rule_human_takeover: { border: 'rgba(244,114,182,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(100,30,60,.5) 100%)' },
    rule_block_user: { border: 'rgba(248,113,113,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(100,30,30,.5) 100%)' },
    rule_inactivity: { border: 'rgba(253,186,116,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(100,60,20,.5) 100%)' },
    rule_business_hours: { border: 'rgba(147,197,253,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(30,50,100,.5) 100%)' },
    rule_limit_access: { border: 'rgba(196,181,253,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(60,40,100,.5) 100%)' },
    rule_reset: { border: 'rgba(156,163,175,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(50,50,60,.5) 100%)' },
    end_flow: { border: 'rgba(74,222,128,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(20,70,40,.5) 100%)' },
    return_menu: { border: 'rgba(74,222,128,.7)', bg: 'linear-gradient(135deg, rgba(17,23,43,.95) 0%, rgba(20,70,40,.5) 100%)' }
  };
  return colors[type] || { border: 'rgba(255,255,255,.18)', bg: 'rgba(17,23,43,.95)' };
}

function builderNodeSubtitle(node) {
  if (['menu', 'buttons', 'list'].includes(node.type)) {
    return truncateText(node.data?.title || 'Menu', 4);
  }
  if (['image', 'audio', 'video'].includes(node.type)) {
    const caption = node.data?.caption || `(sem ${node.type})`;
    return truncateText(caption, 4);
  }
  if (node.type === 'delay') {
    const sec = Math.max(0, Number(node.data?.seconds || 0));
    return `${sec}s${node.data?.typing ? ' com digitação' : ''}`;
  }
  if (String(node.type).startsWith('rule_')) {
    const config = node.data?.config || {};
    if (node.type === 'rule_human_takeover') {
      return `${config.minutes || 30} min`;
    }
    if (node.type === 'rule_block_user') {
      return `${config.minutes || 60} min`;
    }
    if (node.type === 'rule_inactivity') {
      return `${config.minutes || 10} min`;
    }
    if (node.type === 'rule_business_hours') {
      return `${config.start || '08:00'} - ${config.end || '18:00'}`;
    }
    return truncateText(config.message || '(sem mensagem)', 4);
  }
  return truncateText(node.data?.text || '(sem mensagem)', 5);
}

function renderBuilderCatalog() {
  const panel = document.getElementById('builderCatalog');
  if (!panel) return;
  panel.innerHTML = BUILDER_BLOCK_CATALOG.map((group) => `
    <div class="builder-catalog-group">
      <p class="p" style="margin:0 0 6px; font-weight:700">${escapeHtml(group.title)}</p>
      <div class="builder-catalog-list">
        ${group.items.map((item) => `
          <button class="btn small builder-catalog-item" draggable="true" data-block-type="${item.type}">
            ${escapeHtml(item.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  panel.querySelectorAll('[data-block-type]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', el.getAttribute('data-block-type'));
    });
    el.addEventListener('click', () => {
      const type = el.getAttribute('data-block-type');
      const node = makeBuilderNode(type, 120, 120);
      builderState.nodes.push(node);
      builderState.selectedNodeId = node.id;
      renderBuilderInspector();
      renderBuilderCanvas();
    });
  });
}

function renderBuilderCanvas() {
  const area = document.getElementById('builderCanvasArea');
  const world = document.getElementById('builderWorld');
  const svg = document.getElementById('builderLinks');
  if (!area || !world || !svg || !builderState) return;

  world.querySelectorAll('[data-node-id]').forEach((el) => el.remove());
  svg.innerHTML = '';

  const zoom = Number(builderState.zoom || 1);
  const bounds = getBuilderBounds();
  world.style.width = `${Math.ceil(bounds.width * zoom)}px`;
  world.style.height = `${Math.ceil(bounds.height * zoom)}px`;
  svg.setAttribute('width', String(Math.ceil(bounds.width * zoom)));
  svg.setAttribute('height', String(Math.ceil(bounds.height * zoom)));

  const nodeById = new Map(builderState.nodes.map((n) => [n.id, n]));

  for (const link of builderState.links) {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    if (!from || !to) continue;
    const outputIndex = Number(String(link.fromHandle || 'next').replace('opt_', ''));
    const outputY = ['menu', 'buttons', 'list'].includes(from.type)
      ? from.y + 34 + outputIndex * 18
      : from.y + BUILDER_NODE_HEIGHT / 2;
    const x1 = (from.x + BUILDER_NODE_WIDTH) * zoom;
    const y1 = outputY * zoom;
    const x2 = to.x * zoom;
    const y2 = (to.y + BUILDER_NODE_HEIGHT / 2) * zoom;
    const cx = (x1 + x2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('stroke', 'rgba(93, 176, 255, .95)');
    path.setAttribute('stroke-width', '2.4');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
  }

  for (const node of builderState.nodes) {
    const box = document.createElement('div');
    const nodeColors = getNodeColors(node.type, node.isStart);
    box.className = `builder-node ${builderState.selectedNodeId === node.id ? 'selected' : ''} ${node.isStart ? 'start-node' : ''}`;
    box.setAttribute('data-node-id', node.id);
    box.setAttribute('data-type', node.type);
    box.style.left = `${node.x * zoom}px`;
    box.style.top = `${node.y * zoom}px`;
    box.style.width = `${BUILDER_NODE_WIDTH * zoom}px`;
    box.style.minHeight = `${BUILDER_NODE_HEIGHT * zoom}px`;
    box.style.borderColor = nodeColors.border;
    box.style.background = nodeColors.bg;
    box.style.borderWidth = '2px';
    box.style.borderStyle = 'solid';
    box.innerHTML = `
      <div class="builder-node-head">
        <strong style="word-break:break-word; white-space:normal; max-width:${(BUILDER_NODE_WIDTH - 40) * zoom}px; font-size:${12 * zoom}px; line-height:1.3">${escapeHtml(node.id)}</strong>
        ${node.isStart ? '<span class="badge">start</span>' : ''}
      </div>
      <p class="p" style="margin:4px 0 0; font-size:${11 * zoom}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(formatNodeTypeLabel(node.type))}</p>
      <p class="p" style="margin:4px 0 0; color:var(--muted); font-size:${10 * zoom}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escapeHtml(builderNodeSubtitle(node))}</p>
      <div class="builder-node-input" data-node-input="${node.id}"></div>
      <div class="builder-node-outputs"></div>
    `;

    const outputsWrap = box.querySelector('.builder-node-outputs');
    builderNodeOutputs(node).forEach((output) => {
      const handle = document.createElement('button');
      handle.className = 'builder-handle-out';
      handle.setAttribute('type', 'button');
      handle.setAttribute('data-out-node', node.id);
      handle.setAttribute('data-out-handle', output.id);
      handle.textContent = output.label;
      outputsWrap.appendChild(handle);
    });

    box.addEventListener('mousedown', (e) => {
      if (e.target.closest('.builder-handle-out') || e.target.closest('.builder-node-input')) return;
      e.stopPropagation();
      const rect = area.getBoundingClientRect();
      const worldX = (e.clientX - rect.left + area.scrollLeft) / zoom;
      const worldY = (e.clientY - rect.top + area.scrollTop) / zoom;
      builderState.drag = { nodeId: node.id, offsetX: worldX - node.x, offsetY: worldY - node.y };
      builderState.selectedNodeId = node.id;
      renderBuilderInspector();
      renderBuilderCanvas();
    });

    box.addEventListener('click', () => {
      builderState.selectedNodeId = node.id;
      renderBuilderInspector();
      renderBuilderCanvas();
    });

    world.appendChild(box);
  }

  world.querySelectorAll('.builder-handle-out').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      builderState.connecting = {
        from: btn.getAttribute('data-out-node'),
        fromHandle: btn.getAttribute('data-out-handle')
      };
      toast({ title: 'Conexão', message: 'Agora clique no alvo de outro bloco', type: 'warning', timeout: 1400 });
    });
  });

  world.querySelectorAll('[data-node-input]').forEach((input) => {
    input.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!builderState.connecting) return;
      const toId = input.getAttribute('data-node-input');
      if (toId === builderState.connecting.from) {
        builderState.connecting = null;
        return;
      }
      connectNodeHandle(builderState.connecting.from, builderState.connecting.fromHandle, toId);
      builderState.connecting = null;
      renderBuilderInspector();
      renderBuilderCanvas();
    });
  });
}

function renderBuilderInspector() {
  const panel = document.getElementById('builderInspector');
  if (!panel || !builderState) return;
  const node = builderState.nodes.find((n) => n.id === builderState.selectedNodeId) || builderState.nodes[0];
  if (!node) {
    panel.innerHTML = '<p class="p">Sem bloco selecionado.</p>';
    return;
  }

  const outputs = builderNodeOutputs(node);
  const targets = builderState.nodes.filter((n) => n.id !== node.id);

  const mediaUploadHtml = ['image', 'audio', 'video'].includes(node.type)
    ? `
      <div class="row" style="gap:8px; margin-top:8px">
        <input class="input" id="nodeMediaFile" type="file" ${node.type === 'image' ? 'accept="image/*"' : node.type === 'audio' ? 'accept="audio/*"' : 'accept="video/*"'} />
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn small" id="btnUploadNodeMedia" ${builderState.flowId ? '' : 'disabled'}>${builderState.flowId ? 'Upload de mídia' : 'Salve o fluxo para habilitar upload'}</button>
      </div>
    `
    : '';

  panel.innerHTML = `
    <label class="p" style="display:block; margin:0 0 6px">ID do bloco</label>
    <input class="input" id="nodeIdNew" value="${escapeHtml(node.id)}" ${node.isStart ? 'disabled' : ''} />

    <label class="p" style="display:block; margin:10px 0 6px">Tipo</label>
    <input class="input" value="${escapeHtml(formatNodeTypeLabel(node.type))}" disabled />

    ${['menu', 'buttons', 'list'].includes(node.type) ? `
      <label class="p" style="display:block; margin:10px 0 6px">Título</label>
      <textarea class="input" id="nodeMenuTitle" style="min-height:64px">${escapeHtml(node.data?.title || '')}</textarea>
      <p class="p" style="margin:8px 0 4px">Opções</p>
      <div id="nodeOptionsWrap" style="display:grid; gap:6px">
        ${(node.data.options || []).map((opt, idx) => `
          <div class="row" style="gap:6px">
            <input class="input" data-opt-idx="${idx}" value="${escapeHtml(opt.label || '')}" />
            <button class="btn small danger" type="button" data-remove-opt="${idx}">x</button>
          </div>
        `).join('')}
      </div>
      <button class="btn small" id="btnAddOption" style="margin-top:8px">+ opção</button>
    ` : ''}

    ${['image', 'audio', 'video'].includes(node.type) ? `
      <label class="p" style="display:block; margin:10px 0 6px">Legenda</label>
      <textarea class="input" id="nodeMediaCaption" style="min-height:64px">${escapeHtml(node.data?.caption || '')}</textarea>
      <label class="p" style="display:block; margin:10px 0 6px">URL da mídia</label>
      <input class="input" id="nodeMediaUrl" value="${escapeHtml(node.data?.url || '')}" placeholder="/uploads/flows/arquivo.ext" />
      ${mediaUploadHtml}
    ` : ''}

    ${node.type === 'rule_limit_access' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Limite de acessos</label>
      <input class="input" id="ruleLimitMax" type="number" min="1" max="1000" value="${Number(node.data?.config?.max || 5)}" />
      <label class="p" style="display:block; margin:10px 0 6px">Período (horas)</label>
      <input class="input" id="ruleLimitPeriod" type="number" min="1" max="720" value="${Number(node.data?.config?.period_hours || 24)}" />
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem ao atingir limite</label>
      <textarea class="input" id="ruleLimitMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Você atingiu o limite de acessos. Tente novamente mais tarde.')}</textarea>
    ` : ''}

    ${node.type === 'rule_inactivity' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Tempo de inatividade (minutos)</label>
      <input class="input" id="ruleInactivityMinutes" type="number" min="1" max="1440" value="${Number(node.data?.config?.minutes || 5)}" />
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem de inatividade</label>
      <textarea class="input" id="ruleInactivityMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Você ficou inativo. O atendimento será encerrado.')}</textarea>
      <label class="p" style="display:block; margin:10px 0 6px">Ação após inatividade</label>
      <select class="input" id="ruleInactivityAction">
        <option value="end_flow" ${node.data?.config?.action === 'end_flow' ? 'selected' : ''}>Finalizar atendimento</option>
        <option value="return_menu" ${node.data?.config?.action === 'return_menu' ? 'selected' : ''}>Voltar ao menu</option>
      </select>
    ` : ''}

    ${node.type === 'rule_block_user' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Duração do bloqueio</label>
      <select class="input" id="ruleBlockPreset" onchange="document.getElementById('ruleBlockMinutes').value = this.value">
        <option value="60" ${Number(node.data?.config?.minutes || 60) === 60 ? 'selected' : ''}>1 hora</option>
        <option value="360" ${Number(node.data?.config?.minutes || 60) === 360 ? 'selected' : ''}>6 horas</option>
        <option value="1440" ${Number(node.data?.config?.minutes || 60) === 1440 ? 'selected' : ''}>24 horas</option>
        <option value="10080" ${Number(node.data?.config?.minutes || 60) === 10080 ? 'selected' : ''}>7 dias</option>
        <option value="custom" ${![60, 360, 1440, 10080].includes(Number(node.data?.config?.minutes || 60)) ? 'selected' : ''}>Personalizado</option>
      </select>
      <input class="input" id="ruleBlockMinutes" type="number" min="1" max="43200" value="${Number(node.data?.config?.minutes || 60)}" style="margin-top:6px" placeholder="Minutos personalizados" />
      <label class="p" style="display:block; margin:10px 0 6px">Motivo do bloqueio</label>
      <input class="input" id="ruleBlockReason" value="${escapeHtml(node.data?.config?.reason || 'Comportamento inadequado')}" />
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem ao usuário</label>
      <textarea class="input" id="ruleBlockMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Você foi temporariamente bloqueado.')}</textarea>
    ` : ''}

    ${node.type === 'rule_human_takeover' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Tempo de pausa da automação</label>
      <select class="input" id="ruleHumanPreset" onchange="document.getElementById('ruleHumanMinutes').value = this.value">
        <option value="30" ${Number(node.data?.config?.minutes || 30) === 30 ? 'selected' : ''}>30 minutos</option>
        <option value="60" ${Number(node.data?.config?.minutes || 30) === 60 ? 'selected' : ''}>1 hora</option>
        <option value="120" ${Number(node.data?.config?.minutes || 30) === 120 ? 'selected' : ''}>2 horas</option>
        <option value="1440" ${Number(node.data?.config?.minutes || 30) === 1440 ? 'selected' : ''}>24 horas</option>
        <option value="custom" ${![30, 60, 120, 1440].includes(Number(node.data?.config?.minutes || 30)) ? 'selected' : ''}>Personalizado</option>
      </select>
      <input class="input" id="ruleHumanMinutes" type="number" min="1" max="2880" value="${Number(node.data?.config?.minutes || 30)}" style="margin-top:6px" placeholder="Minutos personalizados" />
      <p class="p" style="font-size:11px; color:var(--muted); margin-top:4px">Durante este período, nenhuma automação será disparada para este usuário.</p>
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem ao transferir</label>
      <textarea class="input" id="ruleHumanMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Estamos transferindo você para um atendente humano. Aguarde um momento.')}</textarea>
    ` : ''}

    ${node.type === 'rule_business_hours' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Hora de início (ex: 08:00)</label>
      <input class="input" id="ruleHoursStart" type="time" value="${escapeHtml(node.data?.config?.start || '08:00')}" />
      <label class="p" style="display:block; margin:10px 0 6px">Hora de fim (ex: 18:00)</label>
      <input class="input" id="ruleHoursEnd" type="time" value="${escapeHtml(node.data?.config?.end || '18:00')}" />
      <label class="p" style="display:block; margin:10px 0 6px">Dias da semana</label>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px">
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay0" ${(node.data?.config?.days || [1,2,3,4,5]).includes(0) ? 'checked' : ''} /> Dom</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay1" ${(node.data?.config?.days || [1,2,3,4,5]).includes(1) ? 'checked' : ''} /> Seg</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay2" ${(node.data?.config?.days || [1,2,3,4,5]).includes(2) ? 'checked' : ''} /> Ter</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay3" ${(node.data?.config?.days || [1,2,3,4,5]).includes(3) ? 'checked' : ''} /> Qua</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay4" ${(node.data?.config?.days || [1,2,3,4,5]).includes(4) ? 'checked' : ''} /> Qui</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay5" ${(node.data?.config?.days || [1,2,3,4,5]).includes(5) ? 'checked' : ''} /> Sex</label>
        <label class="row" style="gap:4px"><input type="checkbox" id="ruleDay6" ${(node.data?.config?.days || [1,2,3,4,5]).includes(6) ? 'checked' : ''} /> Sáb</label>
      </div>
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem fora do horário</label>
      <textarea class="input" id="ruleHoursMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Nosso horário de atendimento é de segunda a sexta, das 08h às 18h.')}</textarea>
    ` : ''}

    ${node.type === 'rule_reset' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem antes de resetar</label>
      <textarea class="input" id="ruleResetMessage" style="min-height:64px">${escapeHtml(node.data?.config?.message || 'Reiniciando o atendimento...')}</textarea>
    ` : ''}

    ${node.type === 'delay' ? `
      <label class="p" style="display:block; margin:10px 0 6px">Segundos</label>
      <input class="input" id="nodeDelaySeconds" type="number" min="0" max="120" value="${Number(node.data?.seconds || 3)}" />
      <label class="row" style="gap:8px; margin-top:8px">
        <input id="nodeDelayTyping" type="checkbox" ${node.data?.typing ? 'checked' : ''} />
        <span class="p" style="margin:0">Simular digitação</span>
      </label>
    ` : ''}

    ${(!['menu', 'buttons', 'list', 'image', 'audio', 'video', 'delay'].includes(node.type) && !String(node.type).startsWith('rule_')) ? `
      <label class="p" style="display:block; margin:10px 0 6px">Mensagem</label>
      <textarea class="input" id="nodeText" style="min-height:110px">${escapeHtml(node.data?.text || '')}</textarea>
    ` : ''}

    <div class="row" style="gap:8px; margin-top:10px">
      <button class="btn small" id="btnSaveNodeNew">Salvar bloco</button>
      ${node.isStart ? '' : '<button class="btn small danger" id="btnDeleteNodeNew">Excluir bloco</button>'}
    </div>

    <hr style="border:none; border-top:1px solid rgba(255,255,255,.1); margin:12px 0" />
    <p class="p" style="margin:0 0 6px">Conexões de saída</p>
    <div style="display:grid; gap:8px">
      ${outputs.map((out) => {
        const current = builderState.links.find((l) => l.from === node.id && l.fromHandle === out.id);
        return `
          <div style="border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:8px; background:rgba(12,18,36,.5)">
            <p class="p" style="margin:0 0 4px">${escapeHtml(out.label)}</p>
            <select class="input" data-link-handle="${out.id}">
              <option value="">(sem conexão)</option>
              ${targets.map((t) => `<option value="${t.id}" ${current?.to === t.id ? 'selected' : ''}>${escapeHtml(t.id)}</option>`).join('')}
            </select>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const saveBtn = document.getElementById('btnSaveNodeNew');
  saveBtn.addEventListener('click', () => {
    const nextId = (document.getElementById('nodeIdNew')?.value || '').trim();
    if (!nextId) {
      toast({ title: 'Atenção', message: 'Informe um ID válido', type: 'warning' });
      return;
    }

    if (!node.isStart && nextId !== node.id) {
      if (builderState.nodes.some((n) => n.id === nextId)) {
        toast({ title: 'Atenção', message: 'Já existe um bloco com este ID', type: 'warning' });
        return;
      }
      const oldId = node.id;
      node.id = nextId;
      node.title = nextId;
      builderState.links.forEach((l) => {
        if (l.from === oldId) l.from = nextId;
        if (l.to === oldId) l.to = nextId;
      });
      builderState.selectedNodeId = nextId;
    }

    if (['menu', 'buttons', 'list'].includes(node.type)) {
      node.data.title = (document.getElementById('nodeMenuTitle')?.value || '').trim();
      const options = Array.from(panel.querySelectorAll('[data-opt-idx]')).map((el) => ({ label: (el.value || '').trim() || 'Opção' }));
      node.data.options = options.length ? options : [{ label: 'Opção 1' }];
      syncLinksWithNodeOutputs(node);
    } else if (['image', 'audio', 'video'].includes(node.type)) {
      node.data.caption = (document.getElementById('nodeMediaCaption')?.value || '').trim();
      node.data.url = (document.getElementById('nodeMediaUrl')?.value || '').trim();
    } else if (node.type === 'delay') {
      const seconds = Number(document.getElementById('nodeDelaySeconds')?.value || 0);
      node.data.seconds = Math.max(0, Math.min(120, seconds));
      node.data.typing = Boolean(document.getElementById('nodeDelayTyping')?.checked);
    } else if (node.type === 'rule_limit_access') {
      node.data.config = {
        max: Number(document.getElementById('ruleLimitMax')?.value || 5),
        period_hours: Number(document.getElementById('ruleLimitPeriod')?.value || 24),
        message: (document.getElementById('ruleLimitMessage')?.value || '').trim()
      };
    } else if (node.type === 'rule_inactivity') {
      node.data.config = {
        minutes: Number(document.getElementById('ruleInactivityMinutes')?.value || 5),
        message: (document.getElementById('ruleInactivityMessage')?.value || '').trim(),
        action: document.getElementById('ruleInactivityAction')?.value || 'end_flow'
      };
    } else if (node.type === 'rule_block_user') {
      node.data.config = {
        minutes: Number(document.getElementById('ruleBlockMinutes')?.value || 60),
        reason: (document.getElementById('ruleBlockReason')?.value || '').trim(),
        message: (document.getElementById('ruleBlockMessage')?.value || '').trim()
      };
    } else if (node.type === 'rule_human_takeover') {
      node.data.config = {
        minutes: Number(document.getElementById('ruleHumanMinutes')?.value || 30),
        message: (document.getElementById('ruleHumanMessage')?.value || '').trim()
      };
    } else if (node.type === 'rule_business_hours') {
      const days = [];
      for (let i = 0; i <= 6; i++) {
        if (document.getElementById(`ruleDay${i}`)?.checked) days.push(i);
      }
      node.data.config = {
        start: document.getElementById('ruleHoursStart')?.value || '08:00',
        end: document.getElementById('ruleHoursEnd')?.value || '18:00',
        days: days.length ? days : [1, 2, 3, 4, 5],
        message: (document.getElementById('ruleHoursMessage')?.value || '').trim()
      };
    } else if (node.type === 'rule_reset') {
      node.data.config = {
        message: (document.getElementById('ruleResetMessage')?.value || '').trim()
      };
    } else {
      node.data.text = (document.getElementById('nodeText')?.value || '').trim();
    }

    renderBuilderCanvas();
    renderBuilderInspector();
  });

  const deleteBtn = document.getElementById('btnDeleteNodeNew');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      builderState.nodes = builderState.nodes.filter((n) => n.id !== node.id);
      builderState.links = builderState.links.filter((l) => l.from !== node.id && l.to !== node.id);
      builderState.selectedNodeId = 'start';
      renderBuilderCanvas();
      renderBuilderInspector();
    });
  }

  const addOptionBtn = document.getElementById('btnAddOption');
  if (addOptionBtn) {
    addOptionBtn.addEventListener('click', () => {
      node.data.options = Array.isArray(node.data.options) ? node.data.options : [];
      node.data.options.push({ label: `Opção ${node.data.options.length + 1}` });
      syncLinksWithNodeOutputs(node);
      renderBuilderInspector();
      renderBuilderCanvas();
    });
    panel.querySelectorAll('[data-remove-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-opt'));
        node.data.options.splice(idx, 1);
        syncLinksWithNodeOutputs(node);
        renderBuilderInspector();
        renderBuilderCanvas();
      });
    });
  }

  panel.querySelectorAll('[data-link-handle]').forEach((select) => {
    select.addEventListener('change', () => {
      const handle = select.getAttribute('data-link-handle');
      const to = select.value;
      builderState.links = builderState.links.filter((l) => !(l.from === node.id && l.fromHandle === handle));
      if (to) builderState.links.push({ from: node.id, fromHandle: handle, to });
      renderBuilderCanvas();
    });
  });

  const uploadBtn = document.getElementById('btnUploadNodeMedia');
  if (uploadBtn && builderState.flowId) {
    uploadBtn.addEventListener('click', async () => {
      const input = document.getElementById('nodeMediaFile');
      const file = input?.files?.[0];
      if (!file) {
        toast({ title: 'Atenção', message: 'Selecione um arquivo', type: 'warning' });
        return;
      }
      try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Enviando...';

        const data = await uploadFlowMediaWithFallback({
          file,
          flowId: builderState.flowId,
          mediaType: node.type
        });

        node.data.url = data?.file?.url || '';
        const urlInput = document.getElementById('nodeMediaUrl');
        if (urlInput) urlInput.value = node.data.url;

        await persistBuilderFlow(builderState.flowId);
        toast({ title: 'OK', message: 'Mídia enviada e salva no fluxo', type: 'success' });
        renderBuilderCanvas();
        renderBuilderInspector();
      } catch (e) {
        toast({ title: 'Erro no upload', message: e.message || 'Falha no envio', type: 'danger' });
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload de mídia';
      }
    });
  }
}

function openBlockBuilderWithData(baseData, onApply, title = 'Flow Builder (blocos)', opts = {}) {
  builderState = createDefaultBuilderState(baseData, opts);

  openModal(title, `
    <div class="builder-layout three-cols">
      <aside class="builder-catalog">
        <div class="row" style="gap:8px; margin-bottom:8px">
          <button class="btn small" id="btnZoomOut">-</button>
          <button class="btn small" id="btnZoomIn">+</button>
          <button class="btn small" id="btnZoomFit">Ajustar</button>
          <span class="badge" id="builderZoomLabel">100%</span>
        </div>
        <div id="builderCatalog" class="builder-catalog-body"></div>
      </aside>

      <div class="builder-canvas-wrap">
        <div id="builderCanvasArea" class="builder-canvas-area">
          <div id="builderWorld" class="builder-world">
            <svg id="builderLinks" class="builder-links"></svg>
          </div>
        </div>
      </div>

      <aside id="builderInspector" class="builder-inspector"></aside>
    </div>

    <div class="row" style="gap:8px; margin-top:8px">
      <button class="btn" id="btnBuilderClose">Fechar</button>
      <button class="btn small" id="btnAutoArrange">Organizar</button>
      <div class="spacer"></div>
      <button class="btn primary" id="btnBuilderApply">Atualizar Fluxo</button>
    </div>
  `);

  const modal = document.getElementById('modal');
  const modalBox = modal ? modal.querySelector('.box') : null;
  if (modalBox) modalBox.classList.add('builder-fullscreen');

  const area = document.getElementById('builderCanvasArea');
  renderBuilderCatalog();

  area.addEventListener('dragover', (e) => e.preventDefault());
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;
    const rect = area.getBoundingClientRect();
    const zoom = Number(builderState.zoom || 1);
    const x = (e.clientX - rect.left + area.scrollLeft) / zoom;
    const y = (e.clientY - rect.top + area.scrollTop) / zoom;
    const node = makeBuilderNode(type, x, y);
    builderState.nodes.push(node);
    builderState.selectedNodeId = node.id;
    renderBuilderCanvas();
    renderBuilderInspector();
  });

  area.addEventListener('mousedown', (e) => {
    if (!builderState) return;
    if (e.target.closest('[data-node-id]')) return;
    if (e.button !== 0) return;
    builderState.pan = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: area.scrollLeft,
      scrollTop: area.scrollTop
    };
    area.classList.add('is-panning');
  });

  area.addEventListener('mousemove', (e) => {
    if (!builderState) return;
    const rect = area.getBoundingClientRect();
    const zoom = Number(builderState.zoom || 1);
    if (builderState.drag) {
      const node = builderState.nodes.find((n) => n.id === builderState.drag.nodeId);
      if (!node) return;
      const worldX = (e.clientX - rect.left + area.scrollLeft) / zoom;
      const worldY = (e.clientY - rect.top + area.scrollTop) / zoom;
      node.x = Math.max(10, worldX - builderState.drag.offsetX);
      node.y = Math.max(10, worldY - builderState.drag.offsetY);
      renderBuilderCanvas();
      return;
    }
    if (builderState.pan) {
      const dx = e.clientX - builderState.pan.startX;
      const dy = e.clientY - builderState.pan.startY;
      area.scrollLeft = builderState.pan.scrollLeft - dx;
      area.scrollTop = builderState.pan.scrollTop - dy;
    }
  });

  const stopDrag = () => {
    if (!builderState) return;
    builderState.drag = null;
    builderState.pan = null;
    area.classList.remove('is-panning');
  };
  area.addEventListener('mouseup', stopDrag);
  area.addEventListener('mouseleave', stopDrag);

  area.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setBuilderZoom((builderState?.zoom || 1) * (e.deltaY < 0 ? 1.1 : 0.9));
  }, { passive: false });

  document.getElementById('btnZoomIn').addEventListener('click', () => setBuilderZoom((builderState?.zoom || 1) * 1.1));
  document.getElementById('btnZoomOut').addEventListener('click', () => setBuilderZoom((builderState?.zoom || 1) * 0.9));
  document.getElementById('btnZoomFit').addEventListener('click', () => fitBuilderToViewport());

  document.getElementById('btnAutoArrange').addEventListener('click', () => {
    builderState.nodes.forEach((n, idx) => {
      n.x = 60 + (idx % 3) * 250;
      n.y = 70 + Math.floor(idx / 3) * 180;
    });
    renderBuilderCanvas();
  });

  document.getElementById('btnBuilderClose').addEventListener('click', closeModal);
  document.getElementById('btnBuilderApply').addEventListener('click', async () => {
    ensureStartNode(builderState);
    const builtData = buildFlowDataFromBuilderState(builderState);
    if (typeof onApply === 'function') {
      try {
        await Promise.resolve(onApply(builtData));
      } catch (e) {
        toast({ title: 'Erro', message: e.message || 'Falha ao atualizar fluxo', type: 'danger' });
        return;
      }
    }
    closeModal();
    toast({ title: 'Fluxo atualizado', message: 'Alterações persistidas com sucesso', type: 'success' });
  });

  renderBuilderInspector();
  renderBuilderCanvas();
  setTimeout(() => fitBuilderToViewport(), 0);
}

function openBlockBuilder() {
  const baseData = flowDraftData || buildFlowDataFromSimple();
  openBlockBuilderWithData(baseData, (builtData) => {
    flowDraftData = builtData;
    updatePreview();
  });
}

async function loadFlows() {
  const tbody = document.getElementById('rows');
  tbody.innerHTML = `<tr><td colspan="4" style="background:transparent; border:none; color:var(--muted)">Carregando...</td></tr>`;

  try {
    const data = await apiFetch('/api/flows');
    const flows = data.flows || [];

    if (flows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="background:transparent; border:none; color:var(--muted)">Nenhum fluxo cadastrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = flows.map(f => {
      const active = f.is_active ? 'Sim' : 'Não';
      return `
        <tr>
          <td>${f.id}</td>
          <td>${escapeHtml(f.name)}</td>
          <td>${active}</td>
          <td>
            <div class="row" style="gap:8px">
              <button class="btn small" data-act="duplicate" data-id="${f.id}">Duplicar</button>
              <button class="btn small ${f.is_active ? 'warning' : 'success'}" data-act="toggle-active" data-id="${f.id}" data-active="${f.is_active ? 1 : 0}">${f.is_active ? 'Desativar' : 'Ativar'}</button>
              <button class="btn small" data-act="builder" data-id="${f.id}">Builder</button>
              <button class="btn small" data-act="edit" data-id="${f.id}">Editar</button>
              <button class="btn small danger" data-act="delete" data-id="${f.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.getAttribute('data-act'), btn.getAttribute('data-id')));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="background:transparent; border:none; color:var(--muted)">Erro: ${escapeHtml(e.message || 'falha')}</td></tr>`;
    toast({ title: 'Erro', message: e.message, type: 'danger' });
  }
}

async function handleAction(action, id) {
  const flowId = parseInt(id);

  if (action === 'duplicate') {
    try {
      await apiFetch(`/api/flows/${flowId}/duplicate`, { method: 'POST' });
      toast({ title: 'OK', message: 'Fluxo duplicado', type: 'success' });
      await loadFlows();
    } catch (e) {
      toast({ title: 'Erro', message: e.message, type: 'danger' });
    }
    return;
  }

  if (action === 'toggle-active') {
    const btn = document.querySelector(`[data-act="toggle-active"][data-id="${flowId}"]`);
    const current = btn ? Number(btn.getAttribute('data-active') || 0) : 0;
    try {
      await apiFetch(`/api/flows/${flowId}/activate`, {
        method: 'POST',
        body: { is_active: current ? 0 : 1 }
      });
      toast({ title: 'OK', message: current ? 'Fluxo desativado' : 'Fluxo ativado', type: 'success' });
      await loadFlows();
    } catch (e) {
      toast({ title: 'Erro', message: e.message, type: 'danger' });
    }
    return;
  }

  if (action === 'delete') {
    if (!confirm('Deseja excluir este fluxo?')) return;
    try {
      await apiFetch(`/api/flows/${flowId}`, { method: 'DELETE' });
      toast({ title: 'OK', message: 'Fluxo removido', type: 'success' });
      await loadFlows();
    } catch (e) {
      toast({ title: 'Erro', message: e.message, type: 'danger' });
    }
    return;
  }

  if (action === 'edit') {
    await openEdit(flowId);
    return;
  }

  if (action === 'builder') {
    await openEditBuilder(flowId);
    return;
  }
}

async function openEditBuilder(flowId) {
  try {
    const data = await apiFetch(`/api/flows/${flowId}`);
    const flow = data.flow;
    const baseData = flow && flow.flow_data ? flow.flow_data : { steps: { start: { message: '' } } };

    openBlockBuilderWithData(baseData, async (builtData) => {
      try {
        await apiFetch(`/api/flows/${flowId}`, {
          method: 'PUT',
          body: { flow_data: builtData, structure_json: builtData }
        });
        toast({ title: 'OK', message: `Fluxo #${flowId} atualizado via builder`, type: 'success' });
        await loadFlows();
      } catch (e) {
        toast({ title: 'Erro', message: e.message, type: 'danger' });
        throw e;
      }
    }, `Builder do fluxo #${flowId}`, { flowId });
  } catch (e) {
    toast({ title: 'Erro', message: e.message, type: 'danger' });
  }
}

async function openEdit(flowId) {
  try {
    const data = await apiFetch(`/api/flows/${flowId}`);
    const flow = data.flow;

    const flowDataStr = JSON.stringify(flow.flow_data, null, 2);

    openModal(`Editar fluxo #${flowId}`, `
      <div class="row" style="gap:10px">
        <div style="flex:1">
          <label class="p" style="display:block; margin:0 0 6px">Nome</label>
          <input class="input" id="editName" value="${escapeHtml(flow.name)}" />
        </div>
        <div style="width:200px">
          <label class="p" style="display:block; margin:0 0 6px">Ativo</label>
          <select id="editActive" class="input">
            <option value="1" ${flow.is_active ? 'selected' : ''}>Sim</option>
            <option value="0" ${!flow.is_active ? 'selected' : ''}>Não</option>
          </select>
        </div>
      </div>

      <label class="p" style="display:block; margin:10px 0 6px">JSON do fluxo</label>
      <textarea id="editJson" class="input" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(flowDataStr)}</textarea>

      <div class="row" style="gap:8px; margin-top:10px">
        <button class="btn" id="btnClose">Fechar</button>
        <div class="spacer"></div>
        <button class="btn primary" id="btnSave">Salvar alterações</button>
      </div>
    `);

    document.getElementById('btnClose').addEventListener('click', closeModal);
    document.getElementById('btnSave').addEventListener('click', async () => {
      const name = (document.getElementById('editName').value || '').trim();
      const is_active = document.getElementById('editActive').value === '1';
      const jsonText = document.getElementById('editJson').value;

      let flow_data;
      try {
        flow_data = JSON.parse(jsonText);
      } catch (e) {
        toast({ title: 'JSON inválido', message: 'Corrija o JSON antes de salvar', type: 'danger' });
        return;
      }

      try {
        await apiFetch(`/api/flows/${flowId}`, {
          method: 'PUT',
          body: { name, is_active, flow_data, structure_json: flow_data }
        });
        toast({ title: 'OK', message: 'Fluxo atualizado', type: 'success' });
        closeModal();
        await loadFlows();
      } catch (e) {
        toast({ title: 'Erro', message: e.message, type: 'danger' });
      }
    });
  } catch (e) {
    toast({ title: 'Erro', message: e.message, type: 'danger' });
  }
}

function openAdvanced() {
  const json = JSON.stringify(flowDraftData || buildFlowDataFromSimple(), null, 2);

  openModal('Editar JSON (Avançado)', `
    <p class="p" style="margin-top:0">Edite o JSON e depois copie/cole no campo de edição quando salvar. (Opção rápida)</p>
    <textarea id="advJson" class="input" style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(json)}</textarea>
    <div class="row" style="gap:8px; margin-top:10px">
      <button class="btn" id="btnClose">Fechar</button>
      <div class="spacer"></div>
      <button class="btn primary" id="btnApply">Aplicar no preview</button>
    </div>
  `);

  document.getElementById('btnClose').addEventListener('click', closeModal);
  document.getElementById('btnApply').addEventListener('click', () => {
    try {
      const parsed = JSON.parse(document.getElementById('advJson').value);
      flowDraftData = parsed;
      updatePreview();
      toast({ title: 'OK', message: 'Preview atualizado (salvamento usa o formulário simples ou edição na lista)', type: 'success' });
    } catch (e) {
      toast({ title: 'JSON inválido', message: 'Corrija o JSON', type: 'danger' });
    }
  });
}
