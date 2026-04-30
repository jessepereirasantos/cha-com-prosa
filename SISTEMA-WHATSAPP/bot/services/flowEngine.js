const pool = require('../config/database');
const { getInstanceContext } = require('./instanceManager');
const governance = require('./governanceService');
const { emitInstanceEvent } = require('./realtimeGateway');

let outboundSender = null;
let inactivityTimer = null;

function registerOutboundSender(fn) {
  outboundSender = typeof fn === 'function' ? fn : null;
}

function normalizeFlowSteps(structure) {
  if (!structure || typeof structure !== 'object') return null;
  if (structure.steps && typeof structure.steps === 'object') return structure.steps;
  return structure;
}

function stepNextFromAny(step) {
  if (!step || typeof step !== 'object') return null;
  if (step.next) return String(step.next);
  if (Array.isArray(step.options) && step.options[0] && step.options[0].next) return String(step.options[0].next);
  return null;
}

function wait(ms) {
  const safe = Math.max(0, Number(ms || 0));
  return new Promise((resolve) => setTimeout(resolve, safe));
}

function hasInteractiveOptions(step) {
  if (!step || typeof step !== 'object') return false;
  const stepType = String(step.type || '').trim().toLowerCase();
  if (stepType === 'menu' || stepType === 'buttons' || stepType === 'list') return true;
  if (Array.isArray(step.options) && step.options.length > 0) return true;
  if (step.options && typeof step.options === 'object' && !Array.isArray(step.options)) return true;
  if (Array.isArray(step.keywords) && step.keywords.length > 0) return true;
  return false;
}

function readDelayConfig(step) {
  const data = step?.data && typeof step.data === 'object' ? step.data : {};
  const config = step?.config && typeof step.config === 'object' ? step.config : {};
  const rawSeconds = data.seconds ?? config.seconds ?? step?.seconds ?? 1;
  const seconds = Math.max(0, Math.min(120, Number(rawSeconds || 0)));
  const typing = Boolean(data.typing ?? config.typing ?? step?.typing ?? false);
  return { seconds, typing };
}

async function processDueInactivity() {
  if (!outboundSender) return;

  const [rows] = await pool.query(
    `SELECT id, instance_id, user_phone, inactivity_payload_json
     FROM conversations
     WHERE inactivity_due_at IS NOT NULL AND inactivity_due_at <= NOW()
     LIMIT 50`
  );

  for (const row of rows) {
    try {
      const payload = row.inactivity_payload_json
        ? (typeof row.inactivity_payload_json === 'string' ? JSON.parse(row.inactivity_payload_json) : row.inactivity_payload_json)
        : {};

      if (payload?.message) {
        await outboundSender(row.instance_id, row.user_phone, String(payload.message));
      }

      const action = String(payload?.action || 'end').toLowerCase();
      if (action === 'restart' || action === 'return_menu') {
        await pool.query(
          `UPDATE conversations
           SET current_node = 'start',
               variables_json = ?,
               inactivity_due_at = NULL,
               inactivity_payload_json = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [JSON.stringify({}), row.id]
        );
      } else if (action === 'human') {
        await governance.setHumanTakeover(row.instance_id, row.user_phone, 24);
        await pool.query(
          'UPDATE conversations SET inactivity_due_at = NULL, inactivity_payload_json = NULL WHERE id = ?',
          [row.id]
        );
      } else {
        await pool.query(
          `UPDATE conversations
           SET inactivity_due_at = NULL,
               inactivity_payload_json = NULL,
               status = 'abandoned',
               finished_at = NOW(),
               finished_by = 'inactivity',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [row.id]
        );
      }
    } catch (e) {
      console.error('[FlowEngine] Falha ao processar inatividade:', e);
    }
  }
}

function ensureInactivityScheduler() {
  if (inactivityTimer) return;
  inactivityTimer = setInterval(() => {
    processDueInactivity().catch((e) => {
      console.error('[FlowEngine] Scheduler de inatividade falhou:', e);
    });
  }, 15000);
}

ensureInactivityScheduler();

function normalizePhoneFromJid(jid) {
  return String(jid || '').replace(/@.*/, '').replace(/\D/g, '');
}

async function runPreExecutionGuards({ instanceId, userPhone, conversation, sendText, fromJid }) {
  const activeBlock = await governance.getActiveBlock(instanceId, userPhone);
  if (activeBlock) {
    if (activeBlock.block_message) {
      await sendText(fromJid, String(activeBlock.block_message));
    }
    return { blocked: true };
  }

  await governance.clearExpiredHumanTakeover(instanceId, userPhone);
  if (Number(conversation?.is_human_active || 0) === 1) {
    if (!conversation.human_until || new Date(conversation.human_until).getTime() > Date.now()) {
      return { human: true };
    }
  }

  return { blocked: false, human: false };
}

function findFirstRuleByType(steps, type) {
  const keys = Object.keys(steps || {});
  for (const key of keys) {
    const step = steps[key];
    if (!step) continue;
    if (String(step.type || '').trim().toLowerCase() === type) {
      return { id: key, step };
    }
  }
  return null;
}

async function applyGlobalRules({ structure, conversation, instanceId, userPhone, fromJid, sendText }) {
  const businessRule = findFirstRuleByType(structure, 'rule_business_hours');
  if (businessRule) {
    const allowed = governance.isWithinBusinessHours(businessRule.step.config || {}, new Date());
    if (!allowed) {
      const msg = businessRule.step?.config?.message || 'Atendimento fora do horário permitido.';
      await sendText(fromJid, String(msg));
      return { stop: true };
    }
  }

  if ((conversation.current_node || 'start') === 'start') {
    const limitRule = findFirstRuleByType(structure, 'rule_limit_access');
    if (limitRule) {
      const cfg = limitRule.step.config || {};
      const result = await governance.checkAndConsumeLimit({
        instanceId,
        phone: userPhone,
        ruleId: String(cfg.rule_id || limitRule.id || 'limit_access_global'),
        max: cfg.max,
        periodHours: cfg.period_hours || cfg.periodHours
      });
      if (!result.allowed) {
        const msg = cfg.message || 'Você atingiu o limite de interações para este período.';
        await sendText(fromJid, String(msg));
        return { stop: true };
      }
    }
  }

  return { stop: false };
}

async function executeRuleNode({ step, instanceId, userPhone, fromJid, sendText, conversation }) {
  const type = String(step?.type || '').trim().toLowerCase();
  const config = step?.config || {};

  if (type === 'rule_limit_access') {
    const ruleId = String(config.rule_id || step.id || 'limit_access');
    const result = await governance.checkAndConsumeLimit({
      instanceId,
      phone: userPhone,
      ruleId,
      max: config.max,
      periodHours: config.period_hours || config.periodHours
    });
    if (!result.allowed) {
      const msg = config.message || 'Você atingiu o limite de interações para este período.';
      await sendText(fromJid, String(msg));
      return { stop: true, nextNode: conversation.current_node || 'start' };
    }
  }

  if (type === 'rule_business_hours') {
    const allowed = governance.isWithinBusinessHours(config, new Date());
    if (!allowed) {
      const msg = config.message || 'Atendimento fora do horário permitido.';
      await sendText(fromJid, String(msg));
      return { stop: true, nextNode: conversation.current_node || 'start' };
    }
  }

  if (type === 'rule_human_takeover') {
    if (config.message) {
      await sendText(fromJid, String(config.message));
    }
    const hours = Number(config.hours || config.pause_hours || 24);
    await governance.setHumanTakeover(instanceId, userPhone, hours);
    return { stop: true, nextNode: conversation.current_node || 'start' };
  }

  if (type === 'rule_block_user') {
    const hours = Number(config.hours || config.block_hours || 1);
    await governance.upsertUserBlock(
      instanceId,
      userPhone,
      hours,
      String(config.reason || 'rule_block_user'),
      String(config.block_message || config.message || 'Usuário temporariamente bloqueado.')
    );
    if (config.message) {
      await sendText(fromJid, String(config.message));
    }
    return { stop: true, nextNode: conversation.current_node || 'start' };
  }

  if (type === 'rule_inactivity') {
    await governance.setConversationInactivity(instanceId, userPhone, {
      minutes: config.minutes || config.inactivity_minutes || 10,
      message: config.message || 'Conversa encerrada por inatividade.',
      action: config.action || 'end'
    });
  }

  if (type === 'rule_reset') {
    await governance.applyResetConversation(instanceId, userPhone);
    return { stop: false, nextNode: 'start' };
  }

  return { stop: false, nextNode: stepNextFromAny(step) };
}

function parseFlowData(flowRow) {
  try {
    if (flowRow?.structure_json) {
      const parsed = typeof flowRow.structure_json === 'string'
        ? JSON.parse(flowRow.structure_json)
        : flowRow.structure_json;
      return parsed;
    }

    const raw = flowRow?.flow_data;
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed;
  } catch (e) {
    return null;
  }
}

function parseFlowStructure(flowRow) {
  try {
    const parsed = parseFlowData(flowRow);
    if (!parsed) return null;

    if (parsed && parsed.steps) {
      return parsed.steps;
    }

    return parsed;
  } catch (e) {
    return null;
  }
}

async function ensureConversation(instanceId, userPhone, source = 'flow', tenantId = null) {
  const [rows] = await pool.query(
    'SELECT * FROM conversations WHERE instance_id = ? AND user_phone = ? LIMIT 1',
    [instanceId, userPhone]
  );

  if (rows.length > 0) {
    const conv = rows[0];
    if (conv.status === 'finished' || conv.status === 'abandoned') {
      await pool.query(
        'UPDATE conversations SET current_node = ?, status = ?, started_at = NOW(), finished_at = NULL, finished_by = NULL, source = ? WHERE id = ?',
        ['start', 'active', source, conv.id]
      );
      conv.current_node = 'start';
      conv.status = 'active';
      conv.source = source;
    }
    return conv;
  }

  await pool.query(
    'INSERT INTO conversations (instance_id, tenant_id, user_phone, current_node, variables_json, status, started_at, source) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
    [instanceId, tenantId, userPhone, 'start', JSON.stringify({}), 'active', source]
  );

  const [created] = await pool.query(
    'SELECT * FROM conversations WHERE instance_id = ? AND user_phone = ? LIMIT 1',
    [instanceId, userPhone]
  );

  return created[0];
}

function pickNextNode(step, userInput) {
  const input = String(userInput || '').trim().toLowerCase();
  const stepType = String(step?.type || '').trim().toLowerCase();

  if (Array.isArray(step.options) && step.options.length > 0) {
    let selectedOption = null;

    const numericInput = parseInt(input, 10);
    if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= step.options.length) {
      selectedOption = step.options[numericInput - 1];
    }

    if (!selectedOption) {
      selectedOption = step.options.find((opt) => {
        if (!opt) return false;
        const trigger = String(opt.trigger || '').trim().toLowerCase();
        const label = String(opt.label || '').trim().toLowerCase();
        if (trigger && (input === trigger || input.includes(trigger))) return true;
        if (label && (input === label || input.includes(label))) return true;
        return false;
      });
    }

    if (selectedOption && selectedOption.next) {
      return {
        next: selectedOption.next,
        response: selectedOption.response || null
      };
    }
  }

  if (step.options && typeof step.options === 'object' && !Array.isArray(step.options)) {
    const key = Object.keys(step.options).find((k) => k.toLowerCase() === input);
    if (key) {
      return {
        next: step.options[key],
        response: null
      };
    }
  }

  if (Array.isArray(step.keywords)) {
    const match = step.keywords.find((k) => {
      if (!k || !k.trigger || !k.next) return false;
      return input.includes(String(k.trigger).toLowerCase());
    });
    if (match) {
      return {
        next: match.next,
        response: match.response || null
      };
    }
  }

  if (stepType === 'menu' || stepType === 'buttons' || stepType === 'list') {
    return {
      next: null,
      response: null
    };
  }

  if (step.next) {
    return {
      next: step.next,
      response: null
    };
  }

  if (step.fallback_next) {
    return {
      next: step.fallback_next,
      response: null
    };
  }

  return {
    next: null,
    response: null
  };
}

async function sendStepContent({ step, fromJid, sendText, sendMedia }) {
  if (!step) return;

  const delayMs = Number(step.delay || 0);
  if (delayMs > 0) {
    await wait(delayMs);
  }

  const stepType = String(step.type || '').trim().toLowerCase();
  const mediaUrl = String(step?.media?.url || step?.url || '').trim();
  // Suporta tanto "message" quanto "content" como campo de texto
  const stepMessage = String(step?.message || step?.content || '').trim();

  if ((stepType === 'image' || stepType === 'audio' || stepType === 'video' || stepType === 'document') && mediaUrl && typeof sendMedia === 'function') {
    try {
      await sendMedia(fromJid, {
        type: stepType,
        url: mediaUrl,
        caption: stepMessage || (stepType === 'document' ? 'ingresso.pdf' : '')
      });
      return; // enviado com sucesso
    } catch (e) {
      console.error('[FlowEngine] Falha ao enviar mídia no nó:', e?.message || e);
      // Fallback: se o documento falhar, envia o link como texto
      if (stepType === 'document' && mediaUrl) {
        try {
          await sendText(fromJid, `📄 *Seu ingresso está disponível aqui:*\n${mediaUrl}`);
        } catch (e2) {
          console.error('[FlowEngine] Falha no fallback de texto do documento:', e2?.message || e2);
        }
      }
      return;
    }
  }

  if (stepType === 'menu' || stepType === 'buttons' || stepType === 'list') {
    let menuText = stepMessage || 'Escolha uma opção:';
    if (Array.isArray(step.options) && step.options.length > 0) {
      const optionLines = step.options.map((opt, idx) => {
        const label = String(opt?.label || opt?.trigger || `Opção ${idx + 1}`);
        return `*${idx + 1}* - ${label}`;
      });
      menuText = `${menuText}\n\n${optionLines.join('\n')}`;
    }
    await sendText(fromJid, menuText);
    return;
  }

  if (stepMessage) {
    await sendText(fromJid, stepMessage);
  }
}

async function executeDelayNode({ step, fromJid, sendPresence }) {
  const cfg = readDelayConfig(step);
  const ms = cfg.seconds * 1000;

  if (cfg.typing && typeof sendPresence === 'function') {
    const pulseMs = 1800;
    const until = Date.now() + ms;

    try {
      await sendPresence(fromJid, 'composing');

      while (Date.now() + pulseMs < until) {
        await wait(pulseMs);
        await sendPresence(fromJid, 'composing');
      }

      const tailMs = Math.max(0, until - Date.now());
      if (tailMs > 0) {
        await wait(tailMs);
      }
    } finally {
      try {
        await sendPresence(fromJid, 'paused');
      } catch (e) {
      }
    }
    return;
  }

  await wait(ms);
}

async function executeNodeChain({
  startNodeId,
  structure,
  instanceId,
  userPhone,
  fromJid,
  sendText,
  sendMedia,
  sendPresence,
  conversationNode
}) {
  let nodeId = startNodeId;
  let hops = 0;
  const visited = new Set();


  while (nodeId && structure[nodeId] && hops < 30) {
    const step = structure[nodeId];
    const stepType = String(step?.type || '').trim().toLowerCase();

    if (visited.has(nodeId) && stepType !== 'delay') {
      return { finalNodeId: nodeId };
    }
    if (stepType !== 'delay') {
      visited.add(nodeId);
    }


    if (stepType.startsWith('rule_')) {
      const ruleResult = await executeRuleNode({
        step,
        instanceId,
        userPhone,
        fromJid,
        sendText,
        conversation: { current_node: conversationNode || nodeId }
      });

      if (ruleResult.stop) {
        return { finalNodeId: ruleResult.nextNode || nodeId };
      }

      const nextRuleNode = ruleResult.nextNode || stepNextFromAny(step);
      if (!nextRuleNode) {
        return { finalNodeId: nodeId };
      }
      nodeId = nextRuleNode;
      hops += 1;
      continue;
    }

    if (stepType === 'return_menu') {
      if (step.message) {
        await sendText(fromJid, String(step.message));
      }
      await pool.query(
        'UPDATE conversations SET current_node = ? WHERE instance_id = ? AND user_phone = ?',
        ['start', instanceId, userPhone]
      );
      return { finalNodeId: 'start' };
    }

    if (stepType === 'end_flow') {
      if (step.message) {
        await sendText(fromJid, String(step.message));
      }
      await pool.query(
        'UPDATE conversations SET current_node = ?, status = ?, finished_at = NOW(), finished_by = ? WHERE instance_id = ? AND user_phone = ?',
        ['end', 'finished', 'flow', instanceId, userPhone]
      );
      return { finalNodeId: 'end' };
    }

    if (stepType === 'delay') {
      await executeDelayNode({ step, fromJid, sendPresence });
    } else {
      await sendStepContent({ step, fromJid, sendText, sendMedia });
    }

    if (hasInteractiveOptions(step)) {
      return { finalNodeId: nodeId };
    }

    const nextNode = stepNextFromAny(step);
    if (!nextNode || !structure[nextNode]) {
      return { finalNodeId: nodeId };
    }

    nodeId = nextNode;
    hops += 1;
  }

  return { finalNodeId: nodeId || conversationNode || 'start' };
}

function checkTriggerMatch(flowData, inputText) {
  const triggerConfig = flowData?.trigger_config;
  const inputLower = String(inputText || '').trim().toLowerCase();
  
  if (inputText === '__API_EVENT_TRIGGER__') {
    return true; // Bypass trigger check para disparos via API externa
  }
  
  if (!triggerConfig || !triggerConfig.type) {
    // Modo legado: qualquer mensagem dispara se não há config
    return true;
  }

  const type = triggerConfig.type;
  const keywords = Array.isArray(triggerConfig.keywords) ? triggerConfig.keywords : [];

  if (type === 'any' || keywords.includes('*')) {
    // Qualquer mensagem dispara
    return true;
  }

  if (type === 'multiple' || type === 'single') {
    // Verifica se alguma keyword corresponde
    for (const keyword of keywords) {
      const kw = String(keyword || '').trim().toLowerCase();
      if (kw && (inputLower === kw || inputLower.includes(kw))) {
        return true;
      }
    }
    return false;
  }

  // Fallback: permite disparo
  return true;
}

async function processIncomingMessage({ instanceId, fromJid, text, sendText, sendMedia, sendPresence }) {
  const isApiEvent = text === '__API_EVENT_TRIGGER__';
  console.log(`[FlowEngine] processIncomingMessage | instance=${instanceId} | phone=${fromJid} | isApiEvent=${isApiEvent}`);

  const instance = await getInstanceContext(instanceId);
  if (!instance || !instance.client_id) {
    console.error(`[FlowEngine] ❌ Instância ${instanceId} não encontrada ou sem client_id`);
    return;
  }
  if (!instance.flow_id) {
    console.error(`[FlowEngine] ❌ Instância ${instanceId} não tem flow_id vinculado`);
    return;
  }
  if (!instance.linked_flow_id) {
    console.error(`[FlowEngine] ❌ Fluxo ${instance.flow_id} não encontrado na tabela flows para client_id=${instance.client_id}`);
    return;
  }
  // Para eventos de API (compras), ignora is_active para garantir entrega
  if (!isApiEvent && !instance.is_active) {
    console.warn(`[FlowEngine] ⚠️ Fluxo ${instance.flow_id} inativo - bloqueando msg normal`);
    return;
  }
  console.log(`[FlowEngine] ✅ Instância OK | flow_id=${instance.flow_id} | is_active=${instance.is_active}`);

  // Parse flow data completo para verificar trigger_config
  const flowData = parseFlowData(instance);
  const structure = normalizeFlowSteps(flowData);
  if (!structure || typeof structure !== 'object') {
    console.error(`[FlowEngine] ❌ Estrutura do fluxo ${instance.flow_id} inválida ou vazia`);
    return;
  }
  console.log(`[FlowEngine] ✅ Estrutura OK | nós: ${Object.keys(structure).join(', ')}`);

  const userPhone = normalizePhoneFromJid(fromJid);
  if (!userPhone) return;

  const tenantId = instance.tenant_id || null;
  const conversation = await ensureConversation(instanceId, userPhone, 'flow', tenantId);

  const guards = await runPreExecutionGuards({
    instanceId,
    userPhone,
    conversation,
    sendText,
    fromJid
  });
  if (guards.blocked || guards.human) return;

  const globalRules = await applyGlobalRules({
    structure,
    conversation,
    instanceId,
    userPhone,
    fromJid,
    sendText
  });
  if (globalRules.stop) {
    emitInstanceEvent(instanceId, 'INSTANCE_GOVERNANCE_UPDATED', { status: instance.status || 'connected' });
    return;
  }

  await governance.clearConversationInactivity(instanceId, userPhone);

  let currentNode = conversation.current_node || 'start';
  const inputLower = String(text || '').trim().toLowerCase();

  // Verificar se a mensagem corresponde ao trigger configurado (apenas no início)
  if (currentNode === 'start') {
    const triggerMatches = checkTriggerMatch(flowData, text);
    if (!triggerMatches) {
      // Mensagem não corresponde ao trigger, não dispara o fluxo
      return;
    }
  }

  const startStep = structure.start || structure['start'];
  if (startStep && currentNode !== 'start') {
    // Verificar se deve reiniciar o fluxo com base no trigger_config
    const triggerConfig = flowData?.trigger_config;
    let shouldRestart = false;

    if (triggerConfig && triggerConfig.type === 'any') {
      // Modo "qualquer mensagem": sempre permite reiniciar
      shouldRestart = true;
    } else if (triggerConfig && triggerConfig.keywords && triggerConfig.keywords.length > 0) {
      // Verifica se a mensagem corresponde a alguma keyword
      shouldRestart = checkTriggerMatch(flowData, text);
    } else {
      // Modo legado: usa lista fixa de triggers
      const startTriggers = ['oi', 'olá', 'ola', 'hi', 'hello', 'inicio', 'início', 'começar', 'comecar'];
      shouldRestart = startTriggers.some(t => inputLower === t || inputLower.includes(t));
    }

    if (shouldRestart) {
      currentNode = 'start';
      await pool.query(
        'UPDATE conversations SET current_node = ?, updated_at = CURRENT_TIMESTAMP WHERE instance_id = ? AND user_phone = ?',
        ['start', instanceId, userPhone]
      );
    }
  }

  let currentStep = structure[currentNode] || structure.start;
  if (!currentStep) return;

  let workingNode = currentNode;
  let hops = 0;

  while (currentStep && String(currentStep.type || '').startsWith('rule_') && hops < 8) {
    const ruleResult = await executeRuleNode({
      step: currentStep,
      instanceId,
      userPhone,
      fromJid,
      sendText,
      conversation: { ...conversation, current_node: workingNode }
    });

    if (ruleResult.stop) {
      await pool.query(
        'UPDATE conversations SET current_node = ?, updated_at = CURRENT_TIMESTAMP WHERE instance_id = ? AND user_phone = ?',
        [ruleResult.nextNode || workingNode, instanceId, userPhone]
      );
      return;
    }

    const nextRuleNode = ruleResult.nextNode || stepNextFromAny(currentStep) || 'start';
    if (!structure[nextRuleNode]) {
      break;
    }
    workingNode = nextRuleNode;
    currentStep = structure[workingNode];
    hops += 1;
  }

  if (!currentStep) return;

  // Para eventos de API (compras), executa o fluxo COMPLETO a partir do nó atual
  // Isso garante que a mensagem do nó 'start' E o ingresso sejam enviados
  if (isApiEvent) {
    console.log(`[FlowEngine] API Event: executando cadeia completa a partir do nó '${workingNode}'`);
    const chainResult = await executeNodeChain({
      startNodeId: workingNode,
      structure,
      instanceId,
      userPhone,
      fromJid,
      sendText,
      sendMedia,
      sendPresence,
      conversationNode: workingNode
    });
    await pool.query(
      'UPDATE conversations SET current_node = ?, updated_at = CURRENT_TIMESTAMP WHERE instance_id = ? AND user_phone = ?',
      [chainResult.finalNodeId || workingNode, instanceId, userPhone]
    );
    emitInstanceEvent(instanceId, 'INSTANCE_GOVERNANCE_UPDATED', { status: instance.status || 'connected' });
    return;
  }

  const transition = pickNextNode(currentStep, text);

  let nextNode = transition?.next || null;
  let targetStep = null;

  if (nextNode && structure[nextNode]) {
    targetStep = structure[nextNode];
  } else if (!nextNode && currentStep.next && structure[currentStep.next]) {
    nextNode = currentStep.next;
    targetStep = structure[nextNode];
  } else if (!nextNode && currentStep.fallback && structure[currentStep.fallback]) {
    nextNode = currentStep.fallback;
    targetStep = structure[nextNode];
  }

  if (!targetStep) {
    if (transition?.response) {
      await sendText(fromJid, String(transition.response));
    } else {
      await sendStepContent({ step: currentStep, fromJid, sendText, sendMedia });
    }
    return;
  }

  if (transition?.response) {
    await sendText(fromJid, String(transition.response));
  }

  const chainResult = await executeNodeChain({
    startNodeId: nextNode,
    structure,
    instanceId,
    userPhone,
    fromJid,
    sendText,
    sendMedia,
    sendPresence,
    conversationNode: workingNode
  });

  await pool.query(
    'UPDATE conversations SET current_node = ?, updated_at = CURRENT_TIMESTAMP WHERE instance_id = ? AND user_phone = ?',
    [chainResult.finalNodeId || nextNode || workingNode, instanceId, userPhone]
  );

  emitInstanceEvent(instanceId, 'INSTANCE_GOVERNANCE_UPDATED', { status: instance.status || 'connected' });
}

const processMessage = async (instanceId, clientId, from, messageBody) => {
  try {
    const phone = from.replace('@c.us', '');

    let [contacts] = await pool.query(
      'SELECT * FROM contacts WHERE client_id = ? AND phone = ?',
      [clientId, phone]
    );

    let contact;
    if (contacts.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO contacts (client_id, phone) VALUES (?, ?)',
        [clientId, phone]
      );
      contact = { id: result.insertId, client_id: clientId, phone };
    } else {
      contact = contacts[0];
    }

    await pool.query(
      'INSERT INTO messages (client_id, contact_id, direction, content) VALUES (?, ?, ?, ?)',
      [clientId, contact.id, 'inbound', messageBody]
    );

    if (!contact.current_flow_id) {
      const [flows] = await pool.query(
        'SELECT * FROM flows WHERE client_id = ? AND is_active = 1 LIMIT 1',
        [clientId]
      );

      if (flows.length > 0) {
        const flow = flows[0];
        await pool.query(
          'UPDATE contacts SET current_flow_id = ?, current_step = ? WHERE id = ?',
          [flow.id, 'start', contact.id]
        );
        contact.current_flow_id = flow.id;
        contact.current_step = 'start';
      }
    }

    if (contact.current_flow_id) {
      const response = await executeFlowStep(contact, messageBody);
      return response;
    }

    return null;
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return null;
  }
};

const executeFlowStep = async (contact, userInput) => {
  try {
    const [flows] = await pool.query(
      'SELECT * FROM flows WHERE id = ?',
      [contact.current_flow_id]
    );

    if (flows.length === 0) {
      return null;
    }

    const flow = flows[0];
    const flowData = typeof flow.flow_data === 'string' 
      ? JSON.parse(flow.flow_data) 
      : flow.flow_data;

    const currentStep = contact.current_step || 'start';
    const step = flowData.steps ? flowData.steps[currentStep] : null;

    if (!step) {
      return null;
    }

    let response = step.message || null;
    let nextStep = step.next || null;

    if (step.options && userInput) {
      const option = step.options.find(
        opt => opt.trigger && opt.trigger.toLowerCase() === userInput.toLowerCase()
      );
      if (option) {
        nextStep = option.next;
        response = option.response || response;
      }
    }

    if (nextStep) {
      await pool.query(
        'UPDATE contacts SET current_step = ? WHERE id = ?',
        [nextStep, contact.id]
      );
    }

    if (nextStep === 'end' || !nextStep) {
      await pool.query(
        'UPDATE contacts SET current_flow_id = NULL, current_step = NULL WHERE id = ?',
        [contact.id]
      );
    }

    return response;
  } catch (error) {
    console.error('Erro ao executar step do fluxo:', error);
    return null;
  }
};

const saveOutboundMessage = async (clientId, contactId, content) => {
  try {
    await pool.query(
      'INSERT INTO messages (client_id, contact_id, direction, content) VALUES (?, ?, ?, ?)',
      [clientId, contactId, 'outbound', content]
    );
  } catch (error) {
    console.error('Erro ao salvar mensagem de saída:', error);
  }
};

module.exports = {
  registerOutboundSender,
  processIncomingMessage,
  processMessage,
  executeFlowStep,
  saveOutboundMessage
};
