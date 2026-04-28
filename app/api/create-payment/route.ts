import { NextResponse } from 'next/server';
import { addTicket, updateTicket } from '@/lib/db';
import { createPixPayment } from '@/lib/mercadopago';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, document, paymentMethod } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // 1. Salva o ingresso no banco com status 'pending'
    const ticket = await addTicket({ 
      name, 
      email, 
      phone, 
      document, 
      paymentMethod: 'pix' 
    });

    // 2. Cria pagamento no Mercado Pago
    let mpPayment;
    try {
      mpPayment = await createPixPayment({
        id: ticket.id,
        name,
        email,
        document,
      });
    } catch (mpError: any) {
      console.error('Mercado Pago API Error:', mpError);
      return NextResponse.json({ error: 'Erro ao gerar pagamento no Mercado Pago' }, { status: 500 });
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
    return NextResponse.json({ error: 'Erro interno ao processar pagamento' }, { status: 500 });
  }
}
