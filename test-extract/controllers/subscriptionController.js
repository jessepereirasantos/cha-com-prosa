const pool = require('../config/database');
const mercadoPagoService = require('../services/mercadoPagoService');
const couponService = require('../services/couponService');

async function createSubscription(req, res) {
  try {
    const clientId = req.clientId;
    const { plan_id, payer_email, coupon_code } = req.body;

    if (!plan_id) {
      return res.status(400).json({ error: 'ID do plano é obrigatório' });
    }

    const [plans] = await pool.query('SELECT * FROM plans WHERE id = ?', [plan_id]);
    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    const plan = plans[0];

    let couponData = null;
    let finalPrice = parseFloat(plan.price_monthly);
    let discountApplied = 0;

    if (coupon_code) {
      const couponResult = await couponService.validateCoupon(coupon_code, plan_id);
      if (!couponResult.valid) {
        return res.status(400).json({ error: couponResult.error });
      }
      couponData = couponResult.coupon;
      const calc = couponService.calculateDiscount(finalPrice, couponData);
      finalPrice = calc.finalPrice;
      discountApplied = calc.discount;
    }

    const [clients] = await pool.query(
      'SELECT tenant_id, email FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clients[0];
    let tenantId = client.tenant_id;

    if (!tenantId) {
      const [tenantResult] = await pool.query(
        `INSERT INTO tenants (name, slug, email) VALUES (?, ?, ?)`,
        [`Tenant ${clientId}`, `tenant-${clientId}`, client.email]
      );
      tenantId = tenantResult.insertId;

      await pool.query(
        'UPDATE clients SET tenant_id = ? WHERE id = ?',
        [tenantId, clientId]
      );
    }

    const [existingSub] = await pool.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ("active", "trial", "pending")',
      [tenantId]
    );

    if (existingSub.length > 0) {
      return res.status(400).json({
        error: 'Já existe uma assinatura ativa',
        subscription: existingSub[0]
      });
    }

    if (couponData && (couponData.discount_type === 'free_period' || finalPrice === 0)) {
      const freeDays = couponData.free_days || 30;
      
      const [result] = await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, coupon_id, discount_applied, started_at, expires_at)
         VALUES (?, ?, 'active', ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [tenantId, plan_id, couponData.id, discountApplied, freeDays]
      );

      await couponService.useCoupon(couponData.id);

      return res.status(201).json({
        success: true,
        message: `Assinatura gratuita ativada por ${freeDays} dias!`,
        subscription_id: result.insertId,
        status: 'active',
        plan: plan.name,
        free_days: freeDays,
        coupon_applied: couponData.code
      });
    }

    const email = payer_email || client.email;
    const result = await mercadoPagoService.createSubscription(tenantId, plan_id, email);

    if (couponData) {
      await pool.query(
        'UPDATE subscriptions SET coupon_id = ?, discount_applied = ? WHERE id = ?',
        [couponData.id, discountApplied, result.subscription_id]
      );
      await couponService.useCoupon(couponData.id);
    }

    return res.status(201).json({
      success: true,
      message: 'Assinatura criada com sucesso',
      checkout_url: result.init_point || null,
      ...result
    });

  } catch (error) {
    console.error('[Subscription] Erro ao criar assinatura:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

async function getMySubscription(req, res) {
  try {
    const clientId = req.clientId;

    const [clients] = await pool.query(
      'SELECT tenant_id FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0 || !clients[0].tenant_id) {
      return res.json({ subscription: null });
    }

    const subscription = await mercadoPagoService.getSubscriptionStatus(clients[0].tenant_id);

    return res.json({ subscription });

  } catch (error) {
    console.error('[Subscription] Erro ao buscar assinatura:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function cancelSubscription(req, res) {
  try {
    const clientId = req.clientId;
    const subscriptionId = parseInt(req.params.id);

    const [clients] = await pool.query(
      'SELECT tenant_id FROM clients WHERE id = ?',
      [clientId]
    );

    if (clients.length === 0 || !clients[0].tenant_id) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const [subscriptions] = await pool.query(
      'SELECT * FROM subscriptions WHERE id = ? AND tenant_id = ?',
      [subscriptionId, clients[0].tenant_id]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const result = await mercadoPagoService.cancelSubscription(subscriptionId);

    return res.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      ...result
    });

  } catch (error) {
    console.error('[Subscription] Erro ao cancelar assinatura:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
}

module.exports = {
  createSubscription,
  getMySubscription,
  cancelSubscription
};
