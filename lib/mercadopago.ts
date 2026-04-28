import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' 
});

const getWebhookUrl = () =>
  process.env.MERCADO_PAGO_WEBHOOK_URL ||
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`;

/**
 * Cria pagamento PIX transparente (sem redirecionamento).
 * Retorna o QR Code para exibir na página de confirmação.
 */
export async function createPixPayment(ticketData: {
  id: string;
  name: string;
  email: string;
  document?: string;
}) {
  const payment = new Payment(client);

  const response = await payment.create({
    body: {
      transaction_amount: 57,
      description: 'Ingresso Chá com Prosa - Mulheres com Propósito',
      payment_method_id: 'pix',
      external_reference: ticketData.id,
      payer: {
        email: ticketData.email,
        first_name: ticketData.name.split(' ')[0],
        last_name: ticketData.name.split(' ').slice(1).join(' ') || 'Participante',
        identification: {
          type: 'CPF',
          number: (ticketData.document || '').replace(/\D/g, ''),
        },
      },
      notification_url: getWebhookUrl(),
    },
  });

  return response;
}

/**
 * Cria pagamento com cartão transparente.
 * Requer cardToken gerado pelo MercadoPago.js no frontend.
 */
export async function createCardPayment(ticketData: {
  id: string;
  name: string;
  email: string;
  document?: string;
  cardToken: string;
  paymentMethodId: string;
  installments?: number;
}) {
  const payment = new Payment(client);

  const response = await payment.create({
    body: {
      transaction_amount: 57,
      token: ticketData.cardToken,
      description: 'Ingresso Chá com Prosa - Mulheres com Propósito',
      installments: ticketData.installments || 1,
      payment_method_id: ticketData.paymentMethodId,
      external_reference: ticketData.id,
      payer: {
        email: ticketData.email,
        identification: {
          type: 'CPF',
          number: (ticketData.document || '').replace(/\D/g, ''),
        },
      },
      notification_url: getWebhookUrl(),
    },
  });

  return response;
}

export async function getPaymentStatus(paymentId: string) {
  const payment = new Payment(client);
  try {
    const response = await payment.get({ id: paymentId });
    return response;
  } catch (error) {
    console.error('Mercado Pago Status Error:', error);
    throw error;
  }
}
