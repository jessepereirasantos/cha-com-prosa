import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { updateTicketStatus } from '../../../lib/db';
import { query } from '../../../lib/mysql';
import { TicketStatus } from '../../../lib/types';
import { sendTicketEmail } from '../../../lib/email';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    let dataId = searchParams.get('data.id');

    // Tenta ler o corpo se não houver data.id nos params (notificações v2)
    if (!dataId) {
      try {
        const body = await req.json();
        console.log('Webhook Body Received:', JSON.stringify(body));
        if (body.data?.id) dataId = body.data.id;
        if (body.resource) {
          // Extrai o ID da URL do recurso (ex: /v1/payments/123)
          const parts = body.resource.split('/');
          dataId = parts[parts.length - 1];
        }
      } catch (e) {
        console.warn('Could not parse webhook body');
      }
    }

    console.log(`[WEBHOOK] Recebido evento: type=${type}, dataId=${dataId}`);

    if (dataId) {
      // SEMPRE consulta a API oficial do Mercado Pago para evitar fraudes ou payloads incompletos
      console.log(`[WEBHOOK] Consultando status oficial para pagamento: ${dataId}`);
      const mpPayment = await getPaymentStatus(dataId);
      const status = mpPayment.status;
      
      console.log(`[WEBHOOK] Status oficial retornado: ${status}`);

      if (status === 'approved') {
        // Localiza o ticket vinculado a este pagamento
        const rows = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [dataId]) as any[];
        const ticket = rows[0];

        if (ticket) {
          if (ticket.status === 'pending') {
            // Atualiza status para pago
            await updateTicketStatus(ticket.id, TicketStatus.PAID);
            console.log(`[WEBHOOK] Ticket ${ticket.id} ATUALIZADO para PAID.`);
            
            // Dispara comunicações
            try {
              await sendTicketEmail(ticket.email, ticket);
              if (ticket.phone) {
                await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`);
              }
            } catch (commError) {
              console.error('[WEBHOOK] Notification error:', commError);
            }
          } else {
            console.log(`[WEBHOOK] Ticket ${ticket.id} já estava com status: ${ticket.status}`);
          }
        } else {
          console.warn(`[WEBHOOK] Nenhum ticket encontrado para o paymentIdMP: ${dataId}`);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Error:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
