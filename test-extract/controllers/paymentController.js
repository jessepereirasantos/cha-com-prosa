const pool = require('../config/database');
const couponService = require('../services/couponService');
const mercadoPagoService = require('../services/mercadoPagoService');

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';

async function processPayment(req, res) {
  try {
    const clientId = req.clientId;
    const { plan_id, payment_method, amount, card_token, installments, payer_cpf, coupon_code } = req.body;

    if (!plan_id || !payment_method) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Buscar plano
    const [plans] = await pool.query('SELECT * FROM plans WHERE id = ? AND is_active = 1', [plan_id]);
    if (plans.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    const plan = plans[0];

    // Buscar cliente
    const [clients] = await pool.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    const client = clients[0];

    // Calcular preço final com cupom
    let finalPrice = parseFloat(plan.price_monthly);
    let couponData = null;
    let discountApplied = 0;

    if (coupon_code) {
      const couponResult = await couponService.validateCoupon(coupon_code, plan_id);
      if (couponResult.valid) {
        couponData = couponResult.coupon;
        const calc = couponService.calculateDiscount(finalPrice, couponData);
        finalPrice = calc.finalPrice;
        discountApplied = calc.discount;
      }
    }

    // Garantir tenant_id
    let tenantId = client.tenant_id;
    if (!tenantId) {
      const [tenantResult] = await pool.query(
        `INSERT INTO tenants (name, slug, email) VALUES (?, ?, ?)`,
        [`Tenant ${clientId}`, `tenant-${clientId}`, client.email]
      );
      tenantId = tenantResult.insertId;
      await pool.query('UPDATE clients SET tenant_id = ? WHERE id = ?', [tenantId, clientId]);
    }

    // Verificar assinatura existente
    const [existingSub] = await pool.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ("active", "trial", "pending")',
      [tenantId]
    );

    if (existingSub.length > 0) {
      return res.status(400).json({ error: 'Já existe uma assinatura ativa' });
    }

    // Se cupom dá período grátis ou preço zerado
    if (couponData && (couponData.discount_type === 'free_period' || finalPrice === 0)) {
      const freeDays = couponData.free_days || 30;
      
      const [result] = await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, coupon_id, discount_applied, started_at, expires_at)
         VALUES (?, ?, 'active', ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [tenantId, plan_id, couponData.id, discountApplied, freeDays]
      );

      await couponService.useCoupon(couponData.id);

      return res.json({
        success: true,
        message: `Assinatura gratuita ativada por ${freeDays} dias!`,
        subscription_id: result.insertId
      });
    }

    if (!MP_ACCESS_TOKEN) {
      // Modo local sem Mercado Pago
      const [result] = await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, coupon_id, discount_applied, started_at, expires_at)
         VALUES (?, ?, 'active', ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [tenantId, plan_id, couponData?.id || null, discountApplied]
      );

      if (couponData) await couponService.useCoupon(couponData.id);

      return res.json({
        success: true,
        message: 'Assinatura ativada (modo local)',
        subscription_id: result.insertId
      });
    }

    // Processar pagamento via Mercado Pago
    let paymentBody = {
      transaction_amount: finalPrice,
      description: `Assinatura ${plan.name} - Eloha Bots`,
      payment_method_id: payment_method === 'pix' ? 'pix' : (payment_method === 'boleto' ? 'bolbradesco' : null),
      payer: {
        email: client.email,
        identification: payer_cpf ? { type: 'CPF', number: payer_cpf } : undefined
      },
      metadata: {
        client_id: clientId,
        tenant_id: tenantId,
        plan_id: plan_id,
        coupon_id: couponData?.id || null
      }
    };

    if (payment_method === 'credit_card') {
      if (!card_token) {
        return res.status(400).json({ error: 'Token do cartão é obrigatório' });
      }

      paymentBody.token = card_token;
      paymentBody.installments = installments || 1;
      paymentBody.payment_method_id = undefined; // Será detectado automaticamente
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${clientId}-${plan_id}-${Date.now()}`
      },
      body: JSON.stringify(paymentBody)
    });

    const mpData = await response.json();

    if (!response.ok) {
      console.error('[Payment] Erro MP:', mpData);
      return res.status(400).json({ 
        error: mpData.message || 'Erro ao processar pagamento',
        details: mpData.cause?.[0]?.description
      });
    }

    // Criar assinatura no banco
    const status = mpData.status === 'approved' ? 'active' : 'pending';
    const expiresAt = status === 'active' ? 'DATE_ADD(NOW(), INTERVAL 30 DAY)' : 'NULL';
    
    let subResult;
    try {
      // Tentar com mp_payment_id
      [subResult] = await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, mp_payment_id, coupon_id, discount_applied, started_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ${expiresAt})`,
        [tenantId, plan_id, status, mpData.id, couponData?.id || null, discountApplied]
      );
    } catch (colError) {
      // Fallback sem mp_payment_id se a coluna não existir
      console.log('[Payment] Coluna mp_payment_id não existe, usando fallback');
      [subResult] = await pool.query(
        `INSERT INTO subscriptions (tenant_id, plan_id, status, coupon_id, discount_applied, started_at, expires_at)
         VALUES (?, ?, ?, ?, ?, NOW(), ${expiresAt})`,
        [tenantId, plan_id, status, couponData?.id || null, discountApplied]
      );
    }

    if (couponData) await couponService.useCoupon(couponData.id);

    console.log('[Payment] Assinatura criada:', subResult.insertId, 'MP Payment ID:', mpData.id);

    // Resposta baseada no método de pagamento
    if (payment_method === 'pix') {
      return res.json({
        success: true,
        status: 'pending',
        subscription_id: subResult.insertId,
        payment_id: mpData.id,
        pix_qr_code: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        pix_code: mpData.point_of_interaction?.transaction_data?.qr_code
      });
    }

    if (payment_method === 'boleto') {
      return res.json({
        success: true,
        status: 'pending',
        subscription_id: subResult.insertId,
        boleto_url: mpData.transaction_details?.external_resource_url,
        boleto_barcode: mpData.barcode?.content
      });
    }

    // Cartão de crédito
    if (mpData.status === 'approved') {
      return res.json({
        success: true,
        status: 'approved',
        subscription_id: subResult.insertId,
        message: 'Pagamento aprovado!'
      });
    } else if (mpData.status === 'in_process') {
      return res.json({
        success: true,
        status: 'pending',
        subscription_id: subResult.insertId,
        message: 'Pagamento em análise'
      });
    } else {
      return res.json({
        success: false,
        status: mpData.status,
        error: 'Pagamento não aprovado: ' + (mpData.status_detail || mpData.status)
      });
    }

  } catch (error) {
    console.error('[Payment] Erro:', error);
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}

async function checkPaymentStatus(req, res) {
  try {
    const clientId = req.clientId;

    // Buscar cliente e tenant
    const [clients] = await pool.query('SELECT tenant_id FROM clients WHERE id = ?', [clientId]);
    if (clients.length === 0 || !clients[0].tenant_id) {
      return res.json({ status: 'no_subscription' });
    }

    const tenantId = clients[0].tenant_id;

    // Buscar assinatura pendente mais recente
    const [subscriptions] = await pool.query(
      'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
      [tenantId]
    );

    if (subscriptions.length === 0) {
      return res.json({ status: 'no_subscription' });
    }

    const subscription = subscriptions[0];

    // Se já está ativa, retornar
    if (subscription.status === 'active') {
      return res.json({ 
        status: 'active',
        subscription_id: subscription.id,
        message: 'Assinatura ativa'
      });
    }

    // Se está pendente e tem mp_payment_id, verificar no Mercado Pago
    let paymentId = null;
    try {
      paymentId = subscription.mp_payment_id;
    } catch (e) {}

    if (paymentId && MP_ACCESS_TOKEN) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });

      if (response.ok) {
        const mpData = await response.json();
        
        if (mpData.status === 'approved') {
          // Ativar assinatura
          await pool.query(
            `UPDATE subscriptions SET status = 'active', expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY), updated_at = NOW() WHERE id = ?`,
            [subscription.id]
          );

          return res.json({
            status: 'active',
            subscription_id: subscription.id,
            message: 'Pagamento confirmado! Assinatura ativada.'
          });
        }
      }
    }

    return res.json({
      status: subscription.status,
      subscription_id: subscription.id
    });

  } catch (error) {
    console.error('[Payment] Erro ao verificar status:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  processPayment,
  checkPaymentStatus
};
