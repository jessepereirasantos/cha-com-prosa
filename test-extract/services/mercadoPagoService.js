const pool = require('../config/database');

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const MP_WEBHOOK_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || '';

async function createSubscription(tenantId, planId, payerEmail) {
  const [plans] = await pool.query(
    'SELECT * FROM plans WHERE id = ? AND is_active = 1',
    [planId]
  );

  if (plans.length === 0) {
    throw new Error('Plano não encontrado');
  }

  const plan = plans[0];

  if (!MP_ACCESS_TOKEN) {
    console.warn('[MercadoPago] Access token não configurado, criando assinatura local');
    
    const [result] = await pool.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, started_at, expires_at)
       VALUES (?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [tenantId, planId]
    );

    return {
      subscription_id: result.insertId,
      status: 'active',
      plan: plan.name,
      local_only: true
    };
  }

  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: `Assinatura ${plan.name} - Eloha Bots`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: parseFloat(plan.price_monthly),
        currency_id: 'BRL'
      },
      payer_email: payerEmail,
      back_url: 'https://escolateologicaeloha.com.br/painel/sucesso.html',
      status: 'pending'
    })
  });

  const mpData = await response.json();

  if (!response.ok) {
    console.error('[MercadoPago] Erro ao criar assinatura:', mpData);
    throw new Error(mpData.message || 'Erro ao criar assinatura no Mercado Pago');
  }

  const [result] = await pool.query(
    `INSERT INTO subscriptions (tenant_id, plan_id, status, mp_subscription_id, mp_init_point, started_at)
     VALUES (?, ?, 'pending', ?, ?, NOW())`,
    [tenantId, planId, mpData.id, mpData.init_point]
  );

  return {
    subscription_id: result.insertId,
    mp_subscription_id: mpData.id,
    init_point: mpData.init_point,
    status: 'pending',
    plan: plan.name
  };
}

async function processWebhook(type, data) {
  if (type === 'subscription_preapproval') {
    return await processSubscriptionUpdate(data.id);
  }

  if (type === 'payment') {
    return await processPaymentUpdate(data.id);
  }

  return { processed: false, reason: 'Tipo de evento não tratado' };
}

async function processSubscriptionUpdate(mpSubscriptionId) {
  if (!MP_ACCESS_TOKEN) {
    return { processed: false, reason: 'Access token não configurado' };
  }

  const response = await fetch(`https://api.mercadopago.com/preapproval/${mpSubscriptionId}`, {
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    console.error('[MercadoPago] Erro ao buscar assinatura:', mpSubscriptionId);
    return { processed: false, reason: 'Erro ao buscar assinatura' };
  }

  const mpData = await response.json();
  const status = mapMpStatus(mpData.status);

  const [subscriptions] = await pool.query(
    'SELECT * FROM subscriptions WHERE mp_subscription_id = ?',
    [mpSubscriptionId]
  );

  if (subscriptions.length === 0) {
    return { processed: false, reason: 'Assinatura não encontrada no sistema' };
  }

  const subscription = subscriptions[0];

  await pool.query(
    `UPDATE subscriptions 
     SET status = ?, 
         expires_at = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [status, mpData.next_payment_date || null, subscription.id]
  );

  if (status === 'cancelled' || status === 'suspended') {
    await pool.query(
      'UPDATE subscriptions SET cancelled_at = NOW() WHERE id = ?',
      [subscription.id]
    );
  }

  return {
    processed: true,
    subscription_id: subscription.id,
    tenant_id: subscription.tenant_id,
    old_status: subscription.status,
    new_status: status
  };
}

async function processPaymentUpdate(paymentId) {
  if (!MP_ACCESS_TOKEN) {
    return { processed: false, reason: 'Access token não configurado' };
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
    }
  });

  if (!response.ok) {
    console.error('[MercadoPago] Erro ao buscar pagamento:', paymentId);
    return { processed: false, reason: 'Erro ao buscar pagamento' };
  }

  const mpData = await response.json();
  console.log('[MercadoPago] Dados do pagamento:', JSON.stringify({
    id: mpData.id,
    status: mpData.status,
    metadata: mpData.metadata
  }));

  if (mpData.status === 'approved') {
    let subscription = null;

    // Tentar encontrar assinatura pelo mp_payment_id
    try {
      const [subs1] = await pool.query(
        'SELECT * FROM subscriptions WHERE mp_payment_id = ?',
        [paymentId.toString()]
      );
      if (subs1.length > 0) subscription = subs1[0];
    } catch (e) {
      console.log('[MercadoPago] Coluna mp_payment_id não existe');
    }

    // Se não encontrou, tentar pelo tenant_id nos metadados
    if (!subscription && mpData.metadata?.tenant_id) {
      const [subs2] = await pool.query(
        'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1',
        [mpData.metadata.tenant_id]
      );
      if (subs2.length > 0) subscription = subs2[0];
    }

    // Se não encontrou, tentar pelo client_id nos metadados
    if (!subscription && mpData.metadata?.client_id) {
      const [clients] = await pool.query('SELECT tenant_id FROM clients WHERE id = ?', [mpData.metadata.client_id]);
      if (clients.length > 0 && clients[0].tenant_id) {
        const [subs3] = await pool.query(
          'SELECT * FROM subscriptions WHERE tenant_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1',
          [clients[0].tenant_id]
        );
        if (subs3.length > 0) subscription = subs3[0];
      }
    }

    // Se ainda não encontrou, buscar por mp_subscription_id (assinaturas recorrentes)
    if (!subscription && mpData.metadata?.subscription_id) {
      const [subs4] = await pool.query(
        'SELECT * FROM subscriptions WHERE mp_subscription_id = ?',
        [mpData.metadata.subscription_id]
      );
      if (subs4.length > 0) subscription = subs4[0];
    }

    if (subscription) {
      await pool.query(
        `UPDATE subscriptions 
         SET status = 'active', 
             expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
             updated_at = NOW()
         WHERE id = ?`,
        [subscription.id]
      );

      console.log('[MercadoPago] Assinatura ativada:', subscription.id);

      return {
        processed: true,
        subscription_id: subscription.id,
        tenant_id: subscription.tenant_id,
        payment_status: 'approved'
      };
    } else {
      console.log('[MercadoPago] Assinatura não encontrada para pagamento:', paymentId);
    }
  }

  return { processed: true, payment_id: paymentId, status: mpData.status };
}

function mapMpStatus(mpStatus) {
  const statusMap = {
    'authorized': 'active',
    'pending': 'trial',
    'paused': 'suspended',
    'cancelled': 'cancelled'
  };
  return statusMap[mpStatus] || 'suspended';
}

async function cancelSubscription(subscriptionId) {
  const [subscriptions] = await pool.query(
    'SELECT * FROM subscriptions WHERE id = ?',
    [subscriptionId]
  );

  if (subscriptions.length === 0) {
    throw new Error('Assinatura não encontrada');
  }

  const subscription = subscriptions[0];

  if (subscription.mp_subscription_id && MP_ACCESS_TOKEN) {
    try {
      await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      });
    } catch (e) {
      console.error('[MercadoPago] Erro ao cancelar no MP:', e);
    }
  }

  await pool.query(
    `UPDATE subscriptions 
     SET status = 'cancelled', 
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [subscriptionId]
  );

  return { cancelled: true, subscription_id: subscriptionId };
}

async function getSubscriptionStatus(tenantId) {
  const [subscriptions] = await pool.query(
    `SELECT s.*, p.name as plan_name, p.slug as plan_slug, 
            p.max_instances, p.max_flows, p.api_events_enabled
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = ? AND s.status IN ('active', 'trial')
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId]
  );

  if (subscriptions.length === 0) {
    return null;
  }

  return subscriptions[0];
}

function verifyWebhookSignature(xSignature, xRequestId, dataId) {
  if (!MP_WEBHOOK_SECRET) {
    return true;
  }

  const crypto = require('crypto');
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(',')[0].split('=')[1]};`;
  const hmac = crypto.createHmac('sha256', MP_WEBHOOK_SECRET);
  hmac.update(manifest);
  const calculatedSignature = hmac.digest('hex');

  const receivedSignature = xSignature.split(',')[1]?.split('=')[1];
  return calculatedSignature === receivedSignature;
}

module.exports = {
  createSubscription,
  processWebhook,
  cancelSubscription,
  getSubscriptionStatus,
  verifyWebhookSignature
};
