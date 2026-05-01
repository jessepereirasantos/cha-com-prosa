import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // [WEBHOOK] recebido
    const paymentId = searchParams.get('data.id') || searchParams.get('id') || body.data?.id || body.id;
    
    if (!paymentId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    console.log(`[WEBHOOK] recebido: ${paymentId}`);

    // Consulta API oficial
    const mpPayment = await getPaymentStatus(paymentId.toString());
    const status = mpPayment.status;
    const ticketId = mpPayment.external_reference;
    
    // [WEBHOOK] status retornado
    console.log(`[WEBHOOK] status retornado: ${status}`);

    if (status === 'approved' || status === 'authorized') {
      // [DB] atualização executada (Único ponto de escrita de status)
      const updateResult = await query(
        'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE id = ? OR paymentIdMP = ?',
        [paymentId.toString(), ticketId, paymentId.toString()]
      ) as any;

      if (updateResult.affectedRows > 0) {
        console.log('[DB] atualização executada');

        const rows = await query('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any[];
        const ticket = rows[0];

        if (ticket && ticket.whatsapp_sent === 0) {
          // [WHATSAPP] envio realizado
          await sendWhatsAppNotification(ticket);
          await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
          console.log('[WHATSAPP] envio realizado');
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error: any) {
    console.error('[WEBHOOK] Erro:', error.message);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Webhook active" }, { status: 200 });
}
