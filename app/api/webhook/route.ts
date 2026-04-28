import { NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { updateTicketStatus } from '@/lib/db';
import { query } from '@/lib/mysql';
import { TicketStatus } from '@/lib/types';
import { sendTicketEmail } from '@/lib/email';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const dataId = searchParams.get('data.id');

    // O Mercado Pago envia notificações de vários tipos. Focamos no 'payment'.
    if (type === 'payment' && dataId) {
      const mpPayment = await getPaymentStatus(dataId);
      
      if (mpPayment.status === 'approved') {
        // Localiza o ticket vinculado a este pagamento
        const rows = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [dataId]) as any[];
        const ticket = rows[0];

        if (ticket && ticket.status === 'pending') {
          // Atualiza status para pago
          await updateTicketStatus(ticket.id, TicketStatus.PAID);
          
          // Dispara comunicações
          console.log(`Pagamento ${dataId} aprovado para ticket ${ticket.id}. Enviando notificações...`);
          try {
            await sendTicketEmail(ticket.email, ticket);
            if (ticket.phone) {
              await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`);
            }
          } catch (commError) {
            console.error('Webhook notification error:', commError);
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
