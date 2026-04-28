import { NextResponse } from 'next/server';
import { addTicket } from '@/lib/db';
import { createPixPayment } from '@/lib/mercadopago';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, document, paymentMethod } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    // 1. Salva o ingresso no banco com status 'pending'
    let ticket;
    try {
      ticket = await addTicket({ name, email, phone, document, paymentMethod });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Erro ao registrar ingresso. Verifique a conexão com o banco.' },
        { status: 500 }
      );
    }

    // 2. Para PIX: cria pagamento transparente e retorna QR Code
    let pixData = null;
    if (paymentMethod === 'pix') {
      try {
        const mpPayment = await createPixPayment({
          id: ticket.id,
          name,
          email,
          document,
        });
        pixData = {
          qrCode: mpPayment.point_of_interaction?.transaction_data?.qr_code ?? null,
          qrCodeBase64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
          paymentId: mpPayment.id ?? null,
          expiresAt: mpPayment.date_of_expiration ?? null,
        };
      } catch (mpError) {
        console.error('Mercado Pago PIX error:', mpError);
        // Ingresso foi criado — pagamento poderá ser confirmado via webhook depois
      }
    }

    // Para cartão: o token deve vir do MercadoPago.js no frontend (campo cardToken no body)
    // O processamento de cartão é feito pela rota /api/tickets/[id]/pay
    
    return NextResponse.json({
      success: true,
      id: ticket.id,
      ticket,
      pixData, // null para cartão
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Erro ao processar ingresso' }, { status: 500 });
  }
}
