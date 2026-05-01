import { NextResponse } from 'next/server';
import { addTicket } from '../../../lib/db';
import { createPixPayment, createCardPayment } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';

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

    // 2. Salva o ingresso no banco com status 'pending' inicial
    const ticket = await addTicket({
      name,
      email,
      phone,
      document,
      paymentMethod
    });

    // 3. Cria pagamento no Mercado Pago (Criador Único)
    let mpPayment;
    try {
      if (paymentMethod === 'card') {
        const { cardToken, paymentMethodId, installments } = body;
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
      const errorMessage = mpError?.cause?.[0]?.description || mpError?.message || 'Erro ao processar pagamento no Mercado Pago';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const paymentId = mpPayment.id?.toString();
    const paymentStatus = mpPayment.status;

    // Apenas vincula o ID do pagamento ao ticket no banco. 
    // NÃO altera status para 'paid' e NÃO envia WhatsApp aqui.
    if (paymentId) {
      await query('UPDATE tickets SET paymentIdMP = ? WHERE id = ?', [paymentId, ticket.id]);
    }

    return NextResponse.json({
      success: true,
      paymentId: paymentId,
      ticketId: ticket.id,
      qr_code: mpPayment.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
      status: paymentStatus // Repassa o status inicial para o frontend decidir o fluxo
    });

  } catch (error: any) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({ error: 'Erro técnico ao criar pagamento' }, { status: 500 });
  }
}
