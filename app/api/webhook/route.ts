import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { updateTicketStatus, updateTicket } from '../../../lib/db';
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
        // Tenta localizar e atualizar o ticket vinculado a este pagamento
        // Priorizamos a external_reference (ID do ticket) pois é o vínculo mais forte
        console.log(`[WEBHOOK] Tentando atualizar ticket vinculado ao pagamento ${dataId}...`);
        
        let updateResult: any = null;
        
        if (externalReference) {
           console.log(`[WEBHOOK] Buscando por external_reference: ${externalReference}`);
           updateResult = await query(
             'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE LOWER(id) = LOWER(?) AND status = "pending"',
             [dataId, externalReference]
           );
        }

        // Se não atualizou por referência (ou não tinha referência), tenta por paymentIdMP
        if (!updateResult || updateResult.affectedRows === 0) {
           console.log(`[WEBHOOK] Buscando por paymentIdMP: ${dataId}`);
           updateResult = await query(
             'UPDATE tickets SET status = "paid" WHERE paymentIdMP = ? AND status = "pending"',
             [dataId]
           );
        }

        console.log(`[WEBHOOK] Resultado final da atualização:`, JSON.stringify(updateResult));

        if (updateResult && updateResult.affectedRows > 0) {
          // Busca o ticket atualizado para enviar as comunicações
          const rows = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [dataId]) as any[];
          const ticket = rows[0];
          
          if (ticket) {
            console.log(`[WEBHOOK] Ticket ${ticket.id} ATUALIZADO com sucesso. Enviando notificações...`);
            try {
              await sendTicketEmail(ticket.email, ticket);
              if (ticket.phone) {
                await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`);
              }
            } catch (commError) {
              console.error('[WEBHOOK] Notification error:', commError);
            }
          }
        } else {
          console.warn(`[WEBHOOK] Nenhum ticket pendente encontrado para o pagamento: ${dataId}`);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Error:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
