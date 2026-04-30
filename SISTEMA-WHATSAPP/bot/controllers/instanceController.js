const pool = require('../config/database');
const baileysManager = require('../services/baileysManager');
const { upsertInstanceFlow } = require('../services/instanceManager');
const planService = require('../services/planService');

const listInstances = async (req, res) => {
  try {
    const clientId = req.clientId;

    const [instances] = await pool.query(
      `SELECT i.id, i.instance_name, i.status, i.created_at, i.flow_id,
              f.name AS flow_name,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.current_node <> 'start'
              ) AS flow_active,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.is_human_active = 1
                  AND (c.human_until IS NULL OR c.human_until > NOW())
              ) AS human_active,
              EXISTS(
                SELECT 1 FROM blocked_users b
                WHERE b.instance_id = i.id
                  AND b.blocked_until > NOW()
              ) AS blocked_active,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.inactivity_due_at IS NOT NULL
                  AND c.inactivity_due_at > NOW()
              ) AS inactivity_active
       FROM instances i
       LEFT JOIN flows f ON f.id = i.flow_id AND f.client_id = i.client_id
       WHERE i.client_id = ?`,
      [clientId]
    );

    return res.json({ instances });
  } catch (error) {
    console.error('Erro ao listar instâncias:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const setInstanceFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);
    const { flow_id } = req.body;

    const [instances] = await pool.query(
      'SELECT id FROM instances WHERE id = ? AND client_id = ? LIMIT 1',
      [instanceId, clientId]
    );
    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    if (flow_id === null || flow_id === undefined || flow_id === '') {
      await upsertInstanceFlow(instanceId, null);
      return res.json({ message: 'Fluxo desvinculado com sucesso', instance_id: instanceId, flow_id: null });
    }

    const numericFlowId = parseInt(flow_id);
    if (!numericFlowId) {
      return res.status(400).json({ error: 'flow_id inválido' });
    }

    const [flows] = await pool.query(
      'SELECT id FROM flows WHERE id = ? AND client_id = ? LIMIT 1',
      [numericFlowId, clientId]
    );
    if (flows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    await upsertInstanceFlow(instanceId, numericFlowId);

    return res.json({
      message: 'Fluxo vinculado com sucesso',
      instance_id: instanceId,
      flow_id: numericFlowId
    });
  } catch (error) {
    console.error('Erro ao vincular fluxo na instância:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createInstance = async (req, res) => {
  try {
    const clientId = req.clientId;
    const tenantId = req.user?.tenant_id || null;
    const { instance_name } = req.body;

    if (!instance_name) {
      return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    const limitCheck = await planService.checkInstanceLimit(clientId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.message,
        limit: { current: limitCheck.current, max: limitCheck.max, plan: limitCheck.plan }
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM instances WHERE instance_name = ?',
      [instance_name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Nome de instância já existe' });
    }

    const [result] = await pool.query(
      'INSERT INTO instances (client_id, tenant_id, instance_name, status) VALUES (?, ?, ?, ?)',
      [clientId, tenantId, instance_name, 'disconnected']
    );

    return res.status(201).json({
      message: 'Instância criada com sucesso',
      instance: {
        id: result.insertId,
        instance_name,
        status: 'disconnected'
      }
    });
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const connectInstance = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);

    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const instance = instances[0];

    await baileysManager.startSession(instanceId, instance.instance_name);

    return res.json({
      message: 'Conexão iniciada. Aguarde o QR Code.',
      instance_id: instanceId,
      status: 'connecting'
    });
  } catch (error) {
    console.error('Erro ao conectar instância:', error);
    return res.status(500).json({
      error: 'Erro ao iniciar conexão da instância',
      details: error && error.message ? error.message : String(error)
    });
  }
};

const getQRCode = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);

    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const instance = instances[0];

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (!baileysManager.getSession(instanceId)) {
      try {
        await baileysManager.startSession(instanceId, instance.instance_name);
      } catch (e) {
        return res.status(500).json({
          error: 'Falha ao iniciar sessão para gerar QR Code',
          details: e && e.message ? e.message : String(e),
          status: instance.status
        });
      }
    }

    let qrCode = baileysManager.getQRCode(instanceId);

    if (!qrCode) {
      for (let i = 0; i < 12; i++) {
        await sleep(1000);
        qrCode = baileysManager.getQRCode(instanceId);
        if (qrCode) break;
      }
    }

    if (!qrCode) {
      const lastError = baileysManager.getLastError(instanceId);
      return res.status(404).json({ 
        error: 'QR Code não disponível. Inicie a conexão primeiro ou aguarde.',
        status: instance.status,
        details: lastError || null
      });
    }

    return res.json({
      qrcode: qrCode,
      instance_id: instanceId
    });
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    return res.status(500).json({
      error: 'Erro ao obter QR Code',
      details: error && error.message ? error.message : String(error)
    });
  }
};

const disconnectInstance = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);

    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    await baileysManager.disconnectSession(instanceId);
    await baileysManager.wipeSessionFiles(instanceId);

    await pool.query(
      'UPDATE instances SET status = ? WHERE id = ?',
      ['disconnected', instanceId]
    );

    return res.json({
      message: 'Instância desconectada com sucesso',
      instance_id: instanceId,
      status: 'disconnected'
    });
  } catch (error) {
    console.error('Erro ao desconectar instância:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getInstanceStatus = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);

    const [instances] = await pool.query(
      `SELECT i.id, i.instance_name, i.status, i.created_at, i.flow_id,
              f.name AS flow_name,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.current_node <> 'start'
              ) AS flow_active,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.is_human_active = 1
                  AND (c.human_until IS NULL OR c.human_until > NOW())
              ) AS human_active,
              EXISTS(
                SELECT 1 FROM blocked_users b
                WHERE b.instance_id = i.id
                  AND b.blocked_until > NOW()
              ) AS blocked_active,
              EXISTS(
                SELECT 1 FROM conversations c
                WHERE c.instance_id = i.id
                  AND c.inactivity_due_at IS NOT NULL
                  AND c.inactivity_due_at > NOW()
              ) AS inactivity_active
       FROM instances i
       LEFT JOIN flows f ON f.id = i.flow_id AND f.client_id = i.client_id
       WHERE i.id = ? AND i.client_id = ?`,
      [instanceId, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    return res.json({ instance: instances[0] });
  } catch (error) {
    console.error('Erro ao obter status da instância:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteInstance = async (req, res) => {
  try {
    const clientId = req.clientId;
    const instanceId = parseInt(req.params.id);

    const [instances] = await pool.query(
      'SELECT * FROM instances WHERE id = ? AND client_id = ?',
      [instanceId, clientId]
    );

    if (instances.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    await baileysManager.disconnectSession(instanceId);

    await pool.query('DELETE FROM instances WHERE id = ?', [instanceId]);

    return res.json({
      message: 'Instância removida com sucesso',
      instance_id: instanceId
    });
  } catch (error) {
    console.error('Erro ao remover instância:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  listInstances,
  createInstance,
  connectInstance,
  getQRCode,
  getInstanceStatus,
  setInstanceFlow,
  disconnectInstance,
  deleteInstance
};
