const pool = require('../config/database');

async function isAdmin(clientId) {
  const [clients] = await pool.query(
    'SELECT role FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );
  return clients.length > 0 && clients[0].role === 'admin';
}

async function getClientPlan(clientId) {
  const adminCheck = await isAdmin(clientId);
  if (adminCheck) {
    return {
      plan: { id: 0, name: 'Administrador', slug: 'admin', price_monthly: 0 },
      subscription: { id: 0, status: 'active', started_at: null, expires_at: null },
      limits: { max_instances: 9999, max_flows: 9999, api_events_enabled: true },
      isAdmin: true
    };
  }

  const [clients] = await pool.query(
    'SELECT tenant_id FROM clients WHERE id = ? LIMIT 1',
    [clientId]
  );

  if (clients.length === 0 || !clients[0].tenant_id) {
    return {
      plan: null,
      subscription: null,
      limits: { max_instances: 1, max_flows: 1, api_events_enabled: false }
    };
  }

  const tenantId = clients[0].tenant_id;

  const [subscriptions] = await pool.query(
    `SELECT s.*, p.name as plan_name, p.slug as plan_slug, 
            p.max_instances, p.max_flows, p.api_events_enabled, p.price_monthly
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = ? AND s.status = 'active'
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId]
  );

  if (subscriptions.length === 0) {
    return {
      plan: null,
      subscription: null,
      limits: { max_instances: 1, max_flows: 1, api_events_enabled: false }
    };
  }

  const sub = subscriptions[0];
  return {
    plan: {
      id: sub.plan_id,
      name: sub.plan_name,
      slug: sub.plan_slug,
      price_monthly: sub.price_monthly
    },
    subscription: {
      id: sub.id,
      status: sub.status,
      started_at: sub.started_at,
      expires_at: sub.expires_at
    },
    limits: {
      max_instances: sub.max_instances,
      max_flows: sub.max_flows,
      api_events_enabled: Boolean(sub.api_events_enabled)
    }
  };
}

async function checkInstanceLimit(clientId) {
  const planData = await getClientPlan(clientId);
  const maxInstances = planData.limits.max_instances;

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as count FROM instances WHERE client_id = ?',
    [clientId]
  );

  const currentCount = countResult[0]?.count || 0;

  if (currentCount >= maxInstances) {
    return {
      allowed: false,
      current: currentCount,
      max: maxInstances,
      plan: planData.plan?.name || 'Básico',
      message: `Limite de instâncias atingido (${currentCount}/${maxInstances}). Faça upgrade do seu plano para criar mais instâncias.`
    };
  }

  return {
    allowed: true,
    current: currentCount,
    max: maxInstances,
    plan: planData.plan?.name || 'Básico'
  };
}

async function checkFlowLimit(clientId) {
  const planData = await getClientPlan(clientId);
  const maxFlows = planData.limits.max_flows;

  const [countResult] = await pool.query(
    'SELECT COUNT(*) as count FROM flows WHERE client_id = ?',
    [clientId]
  );

  const currentCount = countResult[0]?.count || 0;

  if (currentCount >= maxFlows) {
    return {
      allowed: false,
      current: currentCount,
      max: maxFlows,
      plan: planData.plan?.name || 'Básico',
      message: `Limite de fluxos atingido (${currentCount}/${maxFlows}). Faça upgrade do seu plano para criar mais fluxos.`
    };
  }

  return {
    allowed: true,
    current: currentCount,
    max: maxFlows,
    plan: planData.plan?.name || 'Básico'
  };
}

async function checkApiEventsEnabled(clientId) {
  const planData = await getClientPlan(clientId);
  return {
    enabled: planData.limits.api_events_enabled,
    plan: planData.plan?.name || 'Básico',
    message: planData.limits.api_events_enabled
      ? null
      : 'API de eventos não disponível no seu plano. Faça upgrade para o plano Platinum.'
  };
}

async function listPlans() {
  const [plans] = await pool.query(
    'SELECT id, name, slug, max_instances, max_flows, api_events_enabled, price_monthly FROM plans WHERE is_active = 1 ORDER BY price_monthly ASC'
  );
  return plans;
}

module.exports = {
  getClientPlan,
  checkInstanceLimit,
  checkFlowLimit,
  checkApiEventsEnabled,
  listPlans
};
