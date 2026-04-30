const couponService = require('../services/couponService');

async function createCoupon(req, res) {
  try {
    const { code, description, discount_type, discount_value, free_days, max_uses, valid_from, valid_until, plan_id } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código do cupom é obrigatório' });
    }

    const coupon = await couponService.createCoupon({
      code,
      description,
      discount_type,
      discount_value,
      free_days,
      max_uses,
      valid_from,
      valid_until,
      plan_id
    });

    return res.status(201).json({
      success: true,
      message: 'Cupom criado com sucesso',
      coupon
    });

  } catch (error) {
    console.error('[Coupon] Erro ao criar cupom:', error);
    return res.status(400).json({ error: error.message || 'Erro ao criar cupom' });
  }
}

async function listCoupons(req, res) {
  try {
    const activeOnly = req.query.active !== 'false';
    const coupons = await couponService.listCoupons(activeOnly);

    return res.json({ coupons });

  } catch (error) {
    console.error('[Coupon] Erro ao listar cupons:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function validateCoupon(req, res) {
  try {
    const { code, plan_id } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código do cupom é obrigatório' });
    }

    const result = await couponService.validateCoupon(code, plan_id);

    return res.json(result);

  } catch (error) {
    console.error('[Coupon] Erro ao validar cupom:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deactivateCoupon(req, res) {
  try {
    const couponId = parseInt(req.params.id);

    await couponService.deactivateCoupon(couponId);

    return res.json({ success: true, message: 'Cupom desativado' });

  } catch (error) {
    console.error('[Coupon] Erro ao desativar cupom:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function deleteCoupon(req, res) {
  try {
    const couponId = parseInt(req.params.id);

    await couponService.deleteCoupon(couponId);

    return res.json({ success: true, message: 'Cupom excluído' });

  } catch (error) {
    console.error('[Coupon] Erro ao excluir cupom:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

async function validateCouponPublic(req, res) {
  try {
    const code = req.params.code;

    if (!code) {
      return res.status(400).json({ valid: false, message: 'Código do cupom é obrigatório' });
    }

    const result = await couponService.validateCoupon(code, null);

    return res.json(result);

  } catch (error) {
    console.error('[Coupon] Erro ao validar cupom público:', error);
    return res.status(500).json({ valid: false, message: 'Erro ao validar cupom' });
  }
}

module.exports = {
  createCoupon,
  listCoupons,
  validateCoupon,
  validateCouponPublic,
  deactivateCoupon,
  deleteCoupon
};
