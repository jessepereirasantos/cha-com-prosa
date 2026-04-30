const pool = require('../config/database');

async function listClients(req, res) {
  try {
    const [clients] = await pool.query(`
      SELECT 
        c.id, c.email, c.name, c.role, c.tenant_id, c.created_at,
        t.name as tenant_name,
        s.id as subscription_id, s.status as subscription_status, s.started_at as subscription_started,
        p.name as plan_name, p.slug as plan_slug, p.price_monthly,
        (SELECT COUNT(*) FROM instances WHERE client_id = c.id) as instances_count,
        (SELECT COUNT(*) FROM flows WHERE client_id = c.id) as flows_count
      FROM clients c
      LEFT JOIN tenants t ON t.id = c.tenant_id
      LEFT JOIN subscriptions s ON s.tenant_id = c.tenant_id AND s.status IN ('active', 'trial')
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE c.role = 'client'
      ORDER BY c.created_at DESC
    `);

    return res.json({ clients });

  } catch (error) {
    console.error('[Admin] Erro ao listar clientes:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getClientDetails(req, res) {
  try {
    const clientId = parseInt(req.params.id);

    const [clients] = await pool.query(`
      SELECT 
        c.id, c.email, c.name, c.role, c.tenant_id, c.created_at,
        t.name as tenant_name
      FROM clients c
      LEFT JOIN tenants t ON t.id = c.tenant_id
      WHERE c.id = ?
    `, [clientId]);

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clients[0];

    const [subscriptions] = await pool.query(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price_monthly
      FROM subscriptions s
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ?
      ORDER BY s.created_at DESC
    `, [client.tenant_id]);

    const [instances] = await pool.query(
      'SELECT id, instance_name, status, created_at FROM instances WHERE client_id = ?',
      [clientId]
    );

    const [flows] = await pool.query(
      'SELECT id, name, is_active, created_at FROM flows WHERE client_id = ?',
      [clientId]
    );

    return res.json({
      client,
      subscriptions,
      instances,
      flows
    });

  } catch (error) {
    console.error('[Admin] Erro ao obter detalhes do cliente:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function listPlans(req, res) {
  try {
    const [plans] = await pool.query(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'active') as active_subscriptions
      FROM plans p
      ORDER BY p.price_monthly ASC
    `);

    return res.json({ plans });

  } catch (error) {
    console.error('[Admin] Erro ao listar planos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createPlan(req, res) {
  try {
    const { name, slug, max_instances, max_flows, api_events_enabled, price_monthly, is_active } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
    }

    const [existing] = await pool.query('SELECT id FROM plans WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Já existe um plano com este slug' });
    }

    const [result] = await pool.query(
      `INSERT INTO plans (name, slug, max_instances, max_flows, api_events_enabled, price_monthly, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug.toLowerCase().replace(/\s/g, '-'),
        max_instances || 1,
        max_flows || 1,
        api_events_enabled ? 1 : 0,
        price_monthly || 0,
        is_active !== false ? 1 : 0
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Plano criado com sucesso',
      plan: { id: result.insertId, name, slug }
    });

  } catch (error) {
    console.error('[Admin] Erro ao criar plano:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function updatePlan(req, res) {
  try {
    const planId = parseInt(req.params.id);
    const { name, max_instances, max_flows, api_events_enabled, price_monthly, is_active } = req.body;

    const [existing] = await pool.query('SELECT id FROM plans WHERE id = ?', [planId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (max_instances !== undefined) { updates.push('max_instances = ?'); values.push(max_instances); }
    if (max_flows !== undefined) { updates.push('max_flows = ?'); values.push(max_flows); }
    if (api_events_enabled !== undefined) { updates.push('api_events_enabled = ?'); values.push(api_events_enabled ? 1 : 0); }
    if (price_monthly !== undefined) { updates.push('price_monthly = ?'); values.push(price_monthly); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(planId);
    await pool.query(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ success: true, message: 'Plano atualizado com sucesso' });

  } catch (error) {
    console.error('[Admin] Erro ao atualizar plano:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deletePlan(req, res) {
  try {
    const planId = parseInt(req.params.id);

    const [subscriptions] = await pool.query(
      'SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ? AND status = "active"',
      [planId]
    );

    if (subscriptions[0].count > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir um plano com assinaturas ativas',
        active_subscriptions: subscriptions[0].count
      });
    }

    await pool.query('DELETE FROM plans WHERE id = ?', [planId]);

    return res.json({ success: true, message: 'Plano excluído com sucesso' });

  } catch (error) {
    console.error('[Admin] Erro ao excluir plano:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function grantSubscription(req, res) {
  try {
    const { client_id, plan_id, days, status } = req.body;

    if (!client_id || !plan_id) {
      return res.status(400).json({ error: 'client_id e plan_id são obrigatórios' });
    }

    const [clients] = await pool.query('SELECT id, tenant_id FROM clients WHERE id = ?', [client_id]);
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    let tenantId = clients[0].tenant_id;

    if (!tenantId) {
      const [tenantResult] = await pool.query(
        `INSERT INTO tenants (name, slug, email) VALUES (?, ?, ?)`,
        [`Tenant ${client_id}`, `tenant-${client_id}`, '']
      );
      tenantId = tenantResult.insertId;

      await pool.query('UPDATE clients SET tenant_id = ? WHERE id = ?', [tenantId, client_id]);
    }

    await pool.query(
      'UPDATE subscriptions SET status = "cancelled", cancelled_at = NOW() WHERE tenant_id = ? AND status IN ("active", "trial")',
      [tenantId]
    );

    const expiresAt = days ? `DATE_ADD(NOW(), INTERVAL ${parseInt(days)} DAY)` : 'NULL';

    const [result] = await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at)
       VALUES (?, ?, ?, NOW(), ${expiresAt})`,
      [tenantId, plan_id, status || 'active']
    );

    return res.status(201).json({
      success: true,
      message: 'Assinatura concedida com sucesso',
      subscription_id: result.insertId
    });

  } catch (error) {
    console.error('[Admin] Erro ao conceder assinatura:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getDashboardStats(req, res) {
  try {
    const [totalClients] = await pool.query('SELECT COUNT(*) as count FROM clients WHERE role = "client"');
    const [activeSubscriptions] = await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE status = "active"');
    const [totalInstances] = await pool.query('SELECT COUNT(*) as count FROM instances');
    const [connectedInstances] = await pool.query('SELECT COUNT(*) as count FROM instances WHERE status = "connected"');
    const [totalFlows] = await pool.query('SELECT COUNT(*) as count FROM flows');
    const [totalConversations] = await pool.query('SELECT COUNT(*) as count FROM conversations');

    const [revenueByPlan] = await pool.query(`
      SELECT p.name, p.price_monthly, COUNT(s.id) as subscribers
      FROM plans p
      LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
      GROUP BY p.id
      ORDER BY p.price_monthly ASC
    `);

    const [recentClients] = await pool.query(`
      SELECT c.id, c.email, c.name, c.created_at, p.name as plan_name
      FROM clients c
      LEFT JOIN tenants t ON t.id = c.tenant_id
      LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      WHERE c.role = 'client'
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    return res.json({
      stats: {
        total_clients: totalClients[0].count,
        active_subscriptions: activeSubscriptions[0].count,
        total_instances: totalInstances[0].count,
        connected_instances: connectedInstances[0].count,
        total_flows: totalFlows[0].count,
        total_conversations: totalConversations[0].count
      },
      revenue_by_plan: revenueByPlan,
      recent_clients: recentClients
    });

  } catch (error) {
    console.error('[Admin] Erro ao obter estatísticas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function getUserInfo(req, res) {
  try {
    const clientId = req.clientId;

    const [clients] = await pool.query(
      'SELECT id, email, name, role FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json({ user: clients[0] });

  } catch (error) {
    console.error('[Admin] Erro ao obter info do usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function createClient(req, res) {
  try {
    const { email, password, name } = req.body;

    console.log('[Admin] Criando cliente:', { email, name });

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const [existing] = await pool.query('SELECT id FROM clients WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    const slug = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const [tenantResult] = await pool.query(
      `INSERT INTO tenants (name, slug, email) VALUES (?, ?, ?)`,
      [name || email.split('@')[0], slug, email]
    );
    const tenantId = tenantResult.insertId;
    console.log('[Admin] Tenant criado:', tenantId);

    const [result] = await pool.query(
      `INSERT INTO clients (email, password_hash, name, role, tenant_id) VALUES (?, ?, ?, 'client', ?)`,
      [email, hashedPassword, name || null, tenantId]
    );
    console.log('[Admin] Cliente criado:', result.insertId);

    return res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      client: { id: result.insertId, email, name, tenant_id: tenantId }
    });

  } catch (error) {
    console.error('[Admin] Erro ao criar cliente:', error.message, error.stack);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

async function updateClient(req, res) {
  try {
    const clientId = parseInt(req.params.id);
    const { name, password } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (password) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(clientId);
    await pool.query(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, values);

    return res.json({ success: true, message: 'Cliente atualizado com sucesso' });

  } catch (error) {
    console.error('[Admin] Erro ao atualizar cliente:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deleteClient(req, res) {
  try {
    const clientId = parseInt(req.params.id);

    const [client] = await pool.query('SELECT tenant_id FROM clients WHERE id = ?', [clientId]);
    if (client.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const tenantId = client[0].tenant_id;

    await pool.query('DELETE FROM conversations WHERE tenant_id = ?', [tenantId]);
    await pool.query('DELETE FROM flows WHERE client_id = ?', [clientId]);
    await pool.query('DELETE FROM instances WHERE client_id = ?', [clientId]);
    await pool.query('DELETE FROM subscriptions WHERE tenant_id = ?', [tenantId]);
    await pool.query('DELETE FROM clients WHERE id = ?', [clientId]);
    await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);

    return res.json({ success: true, message: 'Cliente excluído com sucesso' });

  } catch (error) {
    console.error('[Admin] Erro ao excluir cliente:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function listAllInstances(req, res) {
  try {
    const [instances] = await pool.query(`
      SELECT i.*, c.email as client_email, f.name as flow_name
      FROM instances i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN flows f ON f.id = i.flow_id
      ORDER BY i.created_at DESC
    `);

    return res.json({ instances });

  } catch (error) {
    console.error('[Admin] Erro ao listar instâncias:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function listAllFlows(req, res) {
  try {
    const [flows] = await pool.query(`
      SELECT f.id, f.name, f.is_active, f.created_at, c.email as client_email
      FROM flows f
      LEFT JOIN clients c ON c.id = f.client_id
      ORDER BY f.created_at DESC
    `);

    return res.json({ flows });

  } catch (error) {
    console.error('[Admin] Erro ao listar fluxos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function listAllSubscriptions(req, res) {
  try {
    const [subscriptions] = await pool.query(`
      SELECT s.*, p.name as plan_name, p.price_monthly, c.email as client_email
      FROM subscriptions s
      LEFT JOIN plans p ON p.id = s.plan_id
      LEFT JOIN tenants t ON t.id = s.tenant_id
      LEFT JOIN clients c ON c.tenant_id = t.id
      ORDER BY s.created_at DESC
    `);

    return res.json({ subscriptions });

  } catch (error) {
    console.error('[Admin] Erro ao listar assinaturas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Criar instância para cliente via suporte
async function createSupportInstance(req, res) {
  try {
    const { tenant_id, client_id, instance_name } = req.body;

    if (!tenant_id || !instance_name) {
      return res.status(400).json({ error: 'tenant_id e instance_name são obrigatórios' });
    }

    const [result] = await pool.query(
      `INSERT INTO instances (instance_name, client_id, tenant_id, status) VALUES (?, ?, ?, 'pending')`,
      [instance_name, client_id, tenant_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Instância criada com sucesso',
      instance: { id: result.insertId, instance_name, tenant_id }
    });

  } catch (error) {
    console.error('[Admin] Erro ao criar instância via suporte:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

// Criar fluxo para cliente via suporte
async function createSupportFlow(req, res) {
  try {
    const { tenant_id, client_id, name } = req.body;

    if (!tenant_id || !name) {
      return res.status(400).json({ error: 'tenant_id e name são obrigatórios' });
    }

    const defaultStructure = JSON.stringify({
      nodes: [{ id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Início' } }],
      edges: []
    });

    const defaultFlowData = JSON.stringify({
      steps: {
        start: {
          message: 'Olá! Bem-vindo ao atendimento.',
          options: []
        }
      }
    });

    const [result] = await pool.query(
      `INSERT INTO flows (name, client_id, tenant_id, flow_data, structure_json, version, is_active) VALUES (?, ?, ?, ?, ?, 1, 1)`,
      [name, client_id, tenant_id, defaultFlowData, defaultStructure]
    );

    return res.status(201).json({
      success: true,
      message: 'Fluxo criado com sucesso',
      flow: { id: result.insertId, name, tenant_id }
    });

  } catch (error) {
    console.error('[Admin] Erro ao criar fluxo via suporte:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

module.exports = {
  listClients,
  getClientDetails,
  createClient,
  updateClient,
  deleteClient,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  grantSubscription,
  getDashboardStats,
  getUserInfo,
  listAllInstances,
  listAllFlows,
  listAllSubscriptions,
  createSupportInstance,
  createSupportFlow
};
