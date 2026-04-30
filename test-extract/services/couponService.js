const pool = require('../config/database');

async function validateCoupon(code, planId = null) {
  const [coupons] = await pool.query(
    `SELECT * FROM coupons 
     WHERE code = ? 
     AND is_active = 1 
     AND (valid_from IS NULL OR valid_from <= NOW())
     AND (valid_until IS NULL OR valid_until >= NOW())
     AND (max_uses IS NULL OR uses_count < max_uses)
     LIMIT 1`,
    [code.toUpperCase()]
  );

  if (coupons.length === 0) {
    return { valid: false, error: 'Cupom inválido ou expirado' };
  }

  const coupon = coupons[0];

  if (coupon.plan_id && planId && coupon.plan_id !== planId) {
    return { valid: false, error: 'Cupom não válido para este plano' };
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: parseFloat(coupon.discount_value),
      free_days: coupon.free_days
    }
  };
}

function calculateDiscount(originalPrice, coupon) {
  if (!coupon) return { finalPrice: originalPrice, discount: 0 };

  let discount = 0;
  let finalPrice = originalPrice;

  switch (coupon.discount_type) {
    case 'percentage':
      discount = (originalPrice * coupon.discount_value) / 100;
      finalPrice = originalPrice - discount;
      break;
    case 'fixed':
      discount = coupon.discount_value;
      finalPrice = Math.max(0, originalPrice - discount);
      break;
    case 'free_period':
      discount = originalPrice;
      finalPrice = 0;
      break;
  }

  return {
    finalPrice: Math.round(finalPrice * 100) / 100,
    discount: Math.round(discount * 100) / 100
  };
}

async function useCoupon(couponId) {
  await pool.query(
    'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = ?',
    [couponId]
  );
}

async function createCoupon({
  code,
  description,
  discount_type = 'percentage',
  discount_value = 0,
  free_days = null,
  max_uses = null,
  valid_from = null,
  valid_until = null,
  plan_id = null
}) {
  console.log('[Coupon] Criando cupom:', { code, discount_type, discount_value });

  if (!code) {
    throw new Error('Código do cupom é obrigatório');
  }

  const upperCode = code.toUpperCase().replace(/\s/g, '');

  const [existing] = await pool.query(
    'SELECT id FROM coupons WHERE code = ?',
    [upperCode]
  );

  if (existing.length > 0) {
    throw new Error('Código de cupom já existe');
  }

  const validDiscountTypes = ['percentage', 'fixed', 'free_period'];
  const finalDiscountType = validDiscountTypes.includes(discount_type) ? discount_type : 'percentage';

  const [result] = await pool.query(
    `INSERT INTO coupons (code, description, discount_type, discount_value, free_days, max_uses, valid_from, valid_until, plan_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      upperCode, 
      description || null, 
      finalDiscountType, 
      parseFloat(discount_value) || 0, 
      free_days ? parseInt(free_days) : null, 
      max_uses ? parseInt(max_uses) : null, 
      valid_from || null, 
      valid_until || null, 
      plan_id ? parseInt(plan_id) : null
    ]
  );

  console.log('[Coupon] Cupom criado:', result.insertId);

  return {
    id: result.insertId,
    code: upperCode,
    discount_type: finalDiscountType,
    discount_value,
    free_days
  };
}

async function listCoupons(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT * FROM coupons WHERE is_active = 1 ORDER BY created_at DESC'
    : 'SELECT * FROM coupons ORDER BY created_at DESC';

  const [coupons] = await pool.query(query);
  return coupons;
}

async function deactivateCoupon(couponId) {
  await pool.query(
    'UPDATE coupons SET is_active = 0 WHERE id = ?',
    [couponId]
  );
}

async function deleteCoupon(couponId) {
  await pool.query('DELETE FROM coupons WHERE id = ?', [couponId]);
}

module.exports = {
  validateCoupon,
  calculateDiscount,
  useCoupon,
  createCoupon,
  listCoupons,
  deactivateCoupon,
  deleteCoupon
};
