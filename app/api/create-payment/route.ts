import { NextResponse } from 'next/server';
import { addTicket, updateTicket } from '../../../lib/db';
import { createPixPayment, createCardPayment } from '../../../lib/mercadopago';

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
      const [couponRows] = await require('../../../lib/mysql').query('SELECT discount FROM coupons WHERE code = ?', [couponCode.toUpperCase()]) as any[];
      if (couponRows) {
        amount = Math.max(0, 57 - parseFloat(couponRows.discount.toString()));
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
    const qrCode = mpPayment.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpPayment.point_of_interaction?.transaction_data?.qr_code_base64;

    // 3. Atualiza o ticket com o ID do pagamento do Mercado Pago
    await updateTicket(ticket.id, { paymentIdMP: paymentId });

    return NextResponse.json({
      success: true,
      id: ticket.id,
      payment_id: paymentId,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      status: 'pending'
    });

  } catch (error: any) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({ 
      error: 'Erro técnico: ' + (error.message || 'Erro desconhecido'),
      details: error.code // Ex: ETIMEDOUT ou ECONNREFUSED
    }, { status: 500 });
  }
}
