const mercadoPagoService = require('../services/mercadoPagoService');

async function handleMercadoPagoWebhook(req, res) {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];

    if (xSignature && xRequestId) {
      const isValid = mercadoPagoService.verifyWebhookSignature(
        xSignature,
        xRequestId,
        data.id
      );

      if (!isValid) {
        console.warn('[Webhook] Assinatura inválida');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
    }

    console.log(`[Webhook] Recebido: ${type} - ID: ${data.id}`);

    const result = await mercadoPagoService.processWebhook(type, data);

    if (result.processed) {
      console.log(`[Webhook] Processado com sucesso:`, result);
    } else {
      console.log(`[Webhook] Não processado:`, result.reason);
    }

    return res.status(200).json({ received: true, ...result });

  } catch (error) {
    console.error('[Webhook] Erro ao processar:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

module.exports = {
  handleMercadoPagoWebhook
};
