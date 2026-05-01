import { NextResponse } from 'next/server';
import { addTicket, updateTicket } from '../../../lib/db';
import { createPixPayment, createCardPayment } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, document, paymentMethod, couponCode } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // 1. Calcula o valor com base no cupom
    let amount = 57;
    if (couponCode) {
      const couponRows = await query('SELECT discount FROM coupons WHERE code = ?', [couponCode.toUpperCase()]) as any[];
      if (couponRows && couponRows.length > 0) {
        amount = Math.max(0, 57 - parseFloat(couponRows[0].discount.toString()));
      }
    }

    // 1. Salva o ingresso no banco com status 'pending'
    const ticket = await addTicket({
      name,
      email,
      phone,
      document,
      paymentMethod
    });

    // 2. Cria pagamento no Mercado Pago
    let mpPayment;
    try {
      if (paymentMethod === 'card') {
        const { cardToken, paymentMethodId, installments } = body;
        if (!cardToken) return NextResponse.json({ error: 'Token do cartão ausente' }, { status: 400 });

        mpPayment = await createCardPayment({
          id: ticket.id,
          name,
          email,
          document,
          cardToken,
          paymentMethodId,
          installments: parseInt(installments) || 1,
          amount
        });
      } else {
        mpPayment = await createPixPayment({
          id: ticket.id,
          name,
          email,
          document,
          amount
        });
      }
    } catch (mpError: any) {
      console.error('--- MERCADO PAGO ERROR START ---');
      console.error('Message:', mpError?.message);
      console.error('Cause:', JSON.stringify(mpError?.cause, null, 2));
      console.error('--- MERCADO PAGO ERROR END ---');

      const errorMessage = mpError?.cause?.[0]?.description || mpError?.message || 'Erro ao processar pagamento no Mercado Pago';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const paymentId = mpPayment.id?.toString();
    const paymentStatus = mpPayment.status;
    const qrCode = mpPayment.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpPayment.point_of_interaction?.transaction_data?.qr_code_base64;

    // ====== DEBUG CRÍTICO: Dados do pagamento criado ======
    console.log(`[DEBUG CREATE] ===== DADOS DO PAGAMENTO CRIADO =====`);
    console.log(`[DEBUG CREATE] payment.id: ${paymentId}`);
    console.log(`[DEBUG CREATE] payment.status: ${paymentStatus}`);
    console.log(`[DEBUG CREATE] payment.payment_type_id: ${mpPayment.payment_type_id}`);
    console.log(`[DEBUG CREATE] payment.external_reference: ${mpPayment.external_reference}`);
    console.log(`[DEBUG CREATE] ticket.id: ${ticket.id}`);
    console.log(`[DEBUG CREATE] ticket.code: ${ticket.code}`);
    console.log(`[DEBUG CREATE] paymentMethod: ${paymentMethod}`);

    // ====== DEBUG CRÍTICO: Verificar ticket no banco ANTES do UPDATE ======
    const ticketBeforeUpdate = await query('SELECT id, status, paymentIdMP, code FROM tickets WHERE LOWER(id) = LOWER(?)', [ticket.id]) as any[];
    console.log(`[DEBUG CREATE] Ticket no banco ANTES do update: id=${ticketBeforeUpdate[0]?.id}, status=${ticketBeforeUpdate[0]?.status}, paymentIdMP=${ticketBeforeUpdate[0]?.paymentIdMP}`);

    // 3. Consulta direta e imediata à API do Mercado Pago para determinismo (PASSO CIRÚRGICO)
    const { getPaymentStatus } = await import('../../../lib/mercadopago');
    const mpStatusCheck = await getPaymentStatus(paymentId);
    const finalStatus = mpStatusCheck.status;

    const isApproved = finalStatus === 'approved' || finalStatus === 'authorized';
    
    if (isApproved) {
      console.log(`[DETERMINÍSTICO] Pagamento ${paymentId} confirmado via consulta direta! Atualizando banco...`);
      const updateResult = await query(
        'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE LOWER(id) = LOWER(?)',
        [paymentId, ticket.id]
      ) as any;
      
      // Disparo de WhatsApp sincronizado com a confirmação real
      sendWhatsAppNotification({ ...ticket, amount })
        .then(() => query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]))
        .catch(err => console.error('[WHATSAPP] Erro no fluxo determinístico:', err));
    } else {
      console.log(`[DETERMINÍSTICO] Pagamento ${paymentId} criado com status: ${finalStatus}. Salvando vínculo.`);
      await query(
        'UPDATE tickets SET paymentIdMP = ? WHERE LOWER(id) = LOWER(?)',
        [paymentId, ticket.id]
      );
    }

    return NextResponse.json({
      success: true,
      id: ticket.id,
      payment_id: paymentId,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      status: isApproved ? 'approved' : 'pending'
    });

  } catch (error: any) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({
      error: 'Erro técnico: ' + (error.message || 'Erro desconhecido'),
      details: error.code // Ex: ETIMEDOUT ou ECONNREFUSED
    }, { status: 500 });
  }
}
