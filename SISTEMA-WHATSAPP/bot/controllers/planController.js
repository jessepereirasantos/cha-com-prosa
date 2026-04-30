const planService = require('../services/planService');

const listPlans = async (req, res) => {
  try {
    const plans = await planService.listPlans();
    return res.json({ plans });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getMyPlan = async (req, res) => {
  try {
    const clientId = req.clientId;
    const planData = await planService.getClientPlan(clientId);
    
    return res.json({
      plan: planData.plan,
      subscription: planData.subscription,
      limits: planData.limits
    });
  } catch (error) {
    console.error('Erro ao obter plano:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const checkLimits = async (req, res) => {
  try {
    const clientId = req.clientId;
    
    const instanceLimit = await planService.checkInstanceLimit(clientId);
    const flowLimit = await planService.checkFlowLimit(clientId);
    const apiEvents = await planService.checkApiEventsEnabled(clientId);
    
    return res.json({
      instances: {
        current: instanceLimit.current,
        max: instanceLimit.max,
        available: instanceLimit.max - instanceLimit.current
      },
      flows: {
        current: flowLimit.current,
        max: flowLimit.max,
        available: flowLimit.max - flowLimit.current
      },
      apiEvents: {
        enabled: apiEvents.enabled
      },
      plan: instanceLimit.plan
    });
  } catch (error) {
    console.error('Erro ao verificar limites:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  listPlans,
  getMyPlan,
  checkLimits
};
