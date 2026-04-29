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
      const type = mpPayment.payment_type_id;
      const externalReference = mpPayment.external_reference;
      
      console.log(`[WEBHOOK] Status oficial retornado: ${status} | Tipo: ${type}`);

      if (type === 'credit_card') {
        console.log(`[WEBHOOK CARTAO] ID: ${dataId} | Status: ${status} | Ref: ${externalReference}`);
      }

      if (status === 'approved') {
        // Tenta localizar o ticket vinculado a este pagamento (pelo ID do pagamento ou pela referência externa)
        let ticket = null;
        const rowsById = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [dataId]) as any[];
        
        if (rowsById.length > 0) {
          ticket = rowsById[0];
        } else if (externalReference) {
          console.log(`[WEBHOOK] Ticket não encontrado por paymentIdMP. Buscando por external_reference: ${externalReference}`);
          const rowsByRef = await query('SELECT * FROM tickets WHERE id = ?', [externalReference]) as any[];
          if (rowsByRef.length > 0) {
            ticket = rowsByRef[0];
            // Aproveita para vincular o ID do pagamento se estava faltando
            await updateTicket(ticket.id, { paymentIdMP: dataId });
          }
        }

        if (ticket) {
          if (ticket.status === 'pending') {
            // Atualiza status para pago usando SQL DIRETO para máxima precisão
            console.log(`[WEBHOOK] Aprovando ticket ${ticket.id} via SQL Direto...`);
            const updateResult = await query(
              'UPDATE tickets SET status = "paid" WHERE id = ?',
              [ticket.id]
            );
            console.log(`[WEBHOOK] Resultado do UPDATE:`, JSON.stringify(updateResult));
            
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
          console.warn(`[WEBHOOK] Nenhum ticket encontrado para o pagamento: ${dataId}`);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Error:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
