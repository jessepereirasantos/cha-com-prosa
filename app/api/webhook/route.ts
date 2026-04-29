import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { syncTicketStatus, updateTicket } from '../../../lib/db';
import { query } from '../../../lib/mysql';
import { TicketStatus } from '../../../lib/types';
import { sendTicketEmail } from '../../../lib/email';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || searchParams.get('topic');
    let dataId = searchParams.get('data.id') || searchParams.get('id');

    // Tenta ler o corpo se não houver data.id/id nos params (notificações v2)
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

      if (status === 'approved' || status === 'authorized') {
        console.log(`[DEBUG CARTAO] Iniciando processamento de aprovação...`);
        console.log(`[DEBUG CARTAO] payment_id: ${dataId}`);
        console.log(`[DEBUG CARTAO] status: ${status}`);
        console.log(`[DEBUG CARTAO] external_reference: ${externalReference}`);

        // UPDATE CORRETO NO BANCO COM FALLBACK
        // Tentamos atualizar pelo paymentIdMP OU pela external_reference (que é o nosso id do ticket)
        console.log(`[DB UPDATE] Buscando ticket por payment_id (${dataId}) ou id/reference (${externalReference})`);
        
        const updateResult = await query(
          'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?) OR LOWER(code) = LOWER(?)',
          [dataId, dataId, externalReference || '', externalReference || '']
        ) as any;

        console.log(`[DB UPDATE] Resultado: ${updateResult.affectedRows} linhas afetadas.`);

        if (updateResult.affectedRows > 0) {
          // Busca o ticket atualizado para enviar as comunicações
          const rows = await query(
            'SELECT * FROM tickets WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?) OR LOWER(code) = LOWER(?)', 
            [dataId, externalReference || '', externalReference || '']
          ) as any[];
          const ticket = rows[0];

          if (ticket) {
            console.log(`[WEBHOOK] Sucesso! Ticket ${ticket.id} (${ticket.name}) marcado como PAGO.`);
            // Envia comunicações (e-mail e whatsapp)
            try {
              await Promise.all([
                sendTicketEmail(ticket.email, ticket),
                sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`)
              ]);
            } catch (err) {
              console.error('[WEBHOOK] Erro ao enviar comunicações:', err);
            }
          } else {
            console.warn(`[WEBHOOK] Nenhum ticket pendente encontrado para o pagamento: ${dataId}`);
          }
        } else {
          console.warn(`[WEBHOOK] Nenhum ticket atualizado para o pagamento: ${dataId} (external_reference: ${externalReference || 'N/A'})`);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Error:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
