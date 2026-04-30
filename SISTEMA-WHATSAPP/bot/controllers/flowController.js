const pool = require('../config/database');
const planService = require('../services/planService');

function parseAnyJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') return JSON.parse(value);
  return null;
}

function validateFlowStructure(structure) {
  const data = parseAnyJson(structure);
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Estrutura de fluxo inválida (JSON obrigatório)' };
  }

  const start = data.start || data?.steps?.start;
  if (!start || typeof start !== 'object') {
    return { ok: false, error: 'Fluxo precisa conter nó start' };
  }

  return { ok: true, data };
}

const listFlows = async (req, res) => {
  try {
    const clientId = req.clientId;

    const [flows] = await pool.query(
      'SELECT id, name, is_active, version, created_at FROM flows WHERE client_id = ?',
      [clientId]
    );

    return res.json({ flows });
  } catch (error) {
    console.error('Erro ao listar fluxos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getFlowStructure = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id);

    const [flows] = await pool.query(
      'SELECT id, name, version, structure_json, flow_data, is_active, created_at FROM flows WHERE id = ? AND client_id = ?',
      [flowId, clientId]
    );

    if (flows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const flow = flows[0];
    const structure = parseAnyJson(flow.structure_json) || parseAnyJson(flow.flow_data) || {};
    return res.json({
      flow: {
        id: flow.id,
        name: flow.name,
        version: flow.version || 1,
        is_active: flow.is_active,
        created_at: flow.created_at
      },
      structure
    });
  } catch (error) {
    console.error('Erro ao obter estrutura do fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id);

    const [flows] = await pool.query(
      'SELECT * FROM flows WHERE id = ? AND client_id = ?',
      [flowId, clientId]
    );

    if (flows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const flow = flows[0];
    flow.flow_data = typeof flow.flow_data === 'string' 
      ? JSON.parse(flow.flow_data) 
      : flow.flow_data;

    return res.json({ flow });
  } catch (error) {
    console.error('Erro ao obter fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const tenantId = req.user?.tenant_id || null;
    const { name, flow_data, structure_json, is_active } = req.body;

    if (!name || (!flow_data && !structure_json)) {
      return res.status(400).json({ error: 'Nome e dados do fluxo são obrigatórios' });
    }

    const limitCheck = await planService.checkFlowLimit(clientId);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.message,
        limit: { current: limitCheck.current, max: limitCheck.max, plan: limitCheck.plan }
      });
    }

    const chosenStructure = structure_json !== undefined ? structure_json : flow_data;
    const validation = validateFlowStructure(chosenStructure);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const flowDataObj = flow_data !== undefined ? parseAnyJson(flow_data) : validation.data;
    const structureObj = validation.data;
    const flowDataStr = JSON.stringify(flowDataObj || structureObj);
    const structureStr = JSON.stringify(structureObj);

    const [result] = await pool.query(
      'INSERT INTO flows (client_id, tenant_id, name, flow_data, structure_json, version, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [clientId, tenantId, name, flowDataStr, structureStr, 1, is_active ? 1 : 0]
    );

    return res.status(201).json({
      message: 'Fluxo criado com sucesso',
      flow: {
        id: result.insertId,
        name,
        version: 1,
        is_active: is_active ? 1 : 0
      }
    });
  } catch (error) {
    console.error('Erro ao criar fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id);
    const { name, flow_data, structure_json, is_active } = req.body;

    const [existing] = await pool.query(
      'SELECT id FROM flows WHERE id = ? AND client_id = ?',
      [flowId, clientId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (flow_data !== undefined) {
      const validation = validateFlowStructure(flow_data);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      updates.push('flow_data = ?');
      const flowDataStr = JSON.stringify(validation.data);
      values.push(flowDataStr);

      updates.push('version = version + 1');
    }

    if (structure_json !== undefined) {
      const validation = validateFlowStructure(structure_json);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      updates.push('structure_json = ?');
      values.push(JSON.stringify(validation.data));

      updates.push('version = version + 1');
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(flowId);

    await pool.query(
      `UPDATE flows SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return res.json({ message: 'Fluxo atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id);

    const [existing] = await pool.query(
      'SELECT id FROM flows WHERE id = ? AND client_id = ?',
      [flowId, clientId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    await pool.query('DELETE FROM flows WHERE id = ?', [flowId]);

    return res.json({ message: 'Fluxo removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const duplicateFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id, 10);

    const [rows] = await pool.query(
      'SELECT id, name, flow_data, structure_json, is_active FROM flows WHERE id = ? AND client_id = ? LIMIT 1',
      [flowId, clientId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const original = rows[0];
    const clonedName = `${original.name} (cópia)`;

    const [result] = await pool.query(
      'INSERT INTO flows (client_id, name, flow_data, structure_json, version, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [clientId, clonedName, original.flow_data, original.structure_json || original.flow_data, 1, 0]
    );

    return res.status(201).json({
      message: 'Fluxo duplicado com sucesso',
      flow: {
        id: result.insertId,
        name: clonedName,
        is_active: 0,
        version: 1
      }
    });
  } catch (error) {
    console.error('Erro ao duplicar fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const activateFlow = async (req, res) => {
  try {
    const clientId = req.clientId;
    const flowId = parseInt(req.params.id, 10);
    const { is_active } = req.body;

    const [rows] = await pool.query(
      'SELECT id FROM flows WHERE id = ? AND client_id = ? LIMIT 1',
      [flowId, clientId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    const active = is_active === undefined ? 1 : (is_active ? 1 : 0);

    await pool.query(
      'UPDATE flows SET is_active = ? WHERE id = ? AND client_id = ?',
      [active, flowId, clientId]
    );

    return res.json({
      message: active ? 'Fluxo ativado com sucesso' : 'Fluxo desativado com sucesso',
      flow_id: flowId,
      is_active: active
    });
  } catch (error) {
    console.error('Erro ao ativar fluxo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  listFlows,
  getFlow,
  getFlowStructure,
  createFlow,
  updateFlow,
  deleteFlow,
  duplicateFlow,
  activateFlow
};
