const pool = require('../config/database');
const planService = require('../services/planService');
const baileysManager = require('../services/baileysManager');

async function triggerPurchaseEvent(req, res) {
  try {
    const clientId = req.clientId;

    const apiCheck = await planService.checkApiEventsEnabled(clientId);
    if (!apiCheck.enabled) {
      return res.status(403).json({
        error: apiCheck.message,
        code: 'API_EVENTS_NOT_ENABLED'
      });
    }

    const { name, phone, product, value, data, instance_id, flow_id } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return res.status(400).json({ error: 'Telefone inválido' });
    }

    let instanceId = instance_id;
    let flowId = flow_id;

    if (!instanceId) {
      const [instances] = await pool.query(
        'SELECT id, flow_id FROM instances WHERE client_id = ? AND status = ? LIMIT 1',
        [clientId, 'connected']
      );

      if (instances.length === 0) {
        return res.status(400).json({ error: 'Nenhuma instância conectada encontrada' });
      }

      instanceId = instances[0].id;
      if (!flowId) {
        flowId = instances[0].flow_id;
      }
    }

    const [instanceCheck] = await pool.query(
      'SELECT id, flow_id, tenant_id FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instanceCheck.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const instance = instanceCheck[0];
    const tenantId = instance.tenant_id || null;

    if (!flowId) {
      flowId = instance.flow_id;
    }

    if (!flowId) {
      return res.status(400).json({ error: 'Nenhum fluxo vinculado à instância' });
    }

    const [flowCheck] = await pool.query(
      'SELECT id, structure_json FROM flows WHERE id = ? AND client_id = ?',
      [flowId, clientId]
    );

    if (flowCheck.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const eventData = {
      name: name || '',
      phone: normalizedPhone,
      product: product || '',
      value: value || 0,
      custom: data || {},
      triggered_at: new Date().toISOString()
    };

    const [existingConv] = await pool.query(
      'SELECT id FROM conversations WHERE instance_id = ? AND user_phone = ? LIMIT 1',
      [instanceId, normalizedPhone]
    );

    if (existingConv.length > 0) {
      await pool.query(
        `UPDATE conversations 
         SET current_node = 'start', 
             status = 'active', 
             source = 'api_event',
             started_at = NOW(),
             finished_at = NULL,
             finished_by = NULL,
             variables_json = ?
         WHERE id = ?`,
        [JSON.stringify(eventData), existingConv[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO conversations 
         (instance_id, tenant_id, user_phone, current_node, variables_json, status, started_at, source) 
         VALUES (?, ?, ?, 'start', ?, 'active', NOW(), 'api_event')`,
        [instanceId, tenantId, normalizedPhone, JSON.stringify(eventData)]
      );
    }

    const jid = `${normalizedPhone}@s.whatsapp.net`;

    const sock = baileysManager.getSession(instanceId);
    if (!sock) {
      return res.status(503).json({ 
        error: 'Instância não está conectada no momento',
        queued: true,
        message: 'O evento foi registrado e será processado quando a instância reconectar'
      });
    }

    const flowEngine = require('../services/flowEngine');
    
    const sendText = async (to, text) => {
      await sock.sendMessage(to, { text });
    };

    const sendMedia = async (to, mediaType, url, caption) => {
      const mediaMsg = {};
      if (mediaType === 'image') {
        mediaMsg.image = { url };
        if (caption) mediaMsg.caption = caption;
      } else if (mediaType === 'audio') {
        mediaMsg.audio = { url };
        mediaMsg.mimetype = 'audio/mp4';
      } else if (mediaType === 'video') {
        mediaMsg.video = { url };
        if (caption) mediaMsg.caption = caption;
      } else if (mediaType === 'document') {
        mediaMsg.document = { url };
        if (caption) mediaMsg.fileName = caption;
      }
      await sock.sendMessage(to, mediaMsg);
    };

    const sendPresence = async (to, presence) => {
      try {
        await sock.presenceSubscribe(to);
        await sock.sendPresenceUpdate(presence, to);
      } catch (e) {}
    };

    setImmediate(async () => {
      try {
        await flowEngine.processIncomingMessage({
          instanceId,
          fromJid: jid,
          text: '__API_EVENT_TRIGGER__',
          sendText,
          sendMedia,
          sendPresence
        });
      } catch (e) {
        console.error('[EventController] Erro ao processar evento:', e);
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Evento de compra recebido e fluxo iniciado',
      event: {
        phone: normalizedPhone,
        instance_id: instanceId,
        flow_id: flowId,
        source: 'api_event'
      }
    });

  } catch (error) {
    console.error('[EventController] Erro ao processar evento de compra:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function triggerCustomEvent(req, res) {
  try {
    const clientId = req.clientId;

    const apiCheck = await planService.checkApiEventsEnabled(clientId);
    if (!apiCheck.enabled) {
      return res.status(403).json({
        error: apiCheck.message,
        code: 'API_EVENTS_NOT_ENABLED'
      });
    }

    const { phone, event_type, data, instance_id, start_node } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    if (!event_type) {
      return res.status(400).json({ error: 'Tipo de evento é obrigatório' });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');

    let instanceId = instance_id;

    if (!instanceId) {
      const [instances] = await pool.query(
        'SELECT id FROM instances WHERE client_id = ? AND status = ? LIMIT 1',
        [clientId, 'connected']
      );

      if (instances.length === 0) {
        return res.status(400).json({ error: 'Nenhuma instância conectada encontrada' });
      }

      instanceId = instances[0].id;
    }

    const [instanceCheck] = await pool.query(
      'SELECT id, flow_id, tenant_id FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instanceCheck.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const instance = instanceCheck[0];
    const tenantId = instance.tenant_id || null;
    const targetNode = start_node || 'start';

    const eventData = {
      event_type,
      phone: normalizedPhone,
      custom: data || {},
      triggered_at: new Date().toISOString()
    };

    const [existingConv] = await pool.query(
      'SELECT id FROM conversations WHERE instance_id = ? AND user_phone = ? LIMIT 1',
      [instanceId, normalizedPhone]
    );

    if (existingConv.length > 0) {
      await pool.query(
        `UPDATE conversations 
         SET current_node = ?, 
             status = 'active', 
             source = 'api_event',
             started_at = NOW(),
             finished_at = NULL,
             finished_by = NULL,
             variables_json = ?
         WHERE id = ?`,
        [targetNode, JSON.stringify(eventData), existingConv[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO conversations 
         (instance_id, tenant_id, user_phone, current_node, variables_json, status, started_at, source) 
         VALUES (?, ?, ?, ?, ?, 'active', NOW(), 'api_event')`,
        [instanceId, tenantId, normalizedPhone, targetNode, JSON.stringify(eventData)]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Evento customizado registrado',
      event: {
        phone: normalizedPhone,
        event_type,
        instance_id: instanceId,
        start_node: targetNode,
        source: 'api_event'
      }
    });

  } catch (error) {
    console.error('[EventController] Erro ao processar evento customizado:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = {
  triggerPurchaseEvent,
  triggerCustomEvent
};
