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

      // ====== DEBUG CRÍTICO: Dados completos do Mercado Pago ======
      console.log(`[DEBUG BEFORE UPDATE] ===== DADOS DO MP =====`);
      console.log(`[DEBUG BEFORE UPDATE] payment.id: ${dataId}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.status: ${status}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.status_detail: ${mpPayment.status_detail}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.payment_type_id: ${type}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.external_reference: ${externalReference}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.external_reference tipo: ${typeof externalReference}`);
      console.log(`[DEBUG BEFORE UPDATE] payment.external_reference vazio? ${!externalReference}`);

      // ====== DEBUG CRÍTICO: Verificar se o ticket EXISTE no banco ANTES do UPDATE ======
      if (externalReference) {
        const ticketCheck = await query('SELECT id, status, paymentIdMP, code FROM tickets WHERE LOWER(id) = LOWER(?)', [externalReference]) as any[];
        console.log(`[DEBUG BEFORE UPDATE] Busca por id=${externalReference}: encontrou ${ticketCheck.length} ticket(s)`);
        if (ticketCheck.length > 0) {
          console.log(`[DEBUG BEFORE UPDATE] Ticket encontrado: id=${ticketCheck[0].id}, status=${ticketCheck[0].status}, paymentIdMP=${ticketCheck[0].paymentIdMP}, code=${ticketCheck[0].code}`);
        }
      } else {
        console.warn(`[DEBUG BEFORE UPDATE] ⚠️ external_reference está VAZIA! Buscando por paymentIdMP=${dataId}`);
        const ticketCheck = await query('SELECT id, status, paymentIdMP, code FROM tickets WHERE paymentIdMP = ?', [dataId]) as any[];
        console.log(`[DEBUG BEFORE UPDATE] Busca por paymentIdMP=${dataId}: encontrou ${ticketCheck.length} ticket(s)`);
        if (ticketCheck.length > 0) {
          console.log(`[DEBUG BEFORE UPDATE] Ticket encontrado: id=${ticketCheck[0].id}, status=${ticketCheck[0].status}, paymentIdMP=${ticketCheck[0].paymentIdMP}, code=${ticketCheck[0].code}`);
        }
      }

      if (status === 'approved' || status === 'authorized') {
        // UPDATE CORRETO NO BANCO COM FALLBACK DUPLO
        // 1) Tenta pelo paymentIdMP (salvo na criação)
        // 2) Tenta pelo id do ticket (que é o external_reference)
        // 3) Tenta pelo code do ticket
        console.log(`[DB UPDATE] Executando UPDATE com: paymentIdMP=${dataId}, external_reference=${externalReference || 'VAZIA'}`);
        
        const updateResult = await query(
          'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?) OR LOWER(code) = LOWER(?)',
          [dataId, dataId, externalReference || '', externalReference || '']
        ) as any;

        console.log(`[DEBUG UPDATE RESULT] affectedRows: ${updateResult.affectedRows}`);
        console.log(`[DEBUG UPDATE RESULT] changedRows: ${updateResult.changedRows}`);
        console.log(`[DEBUG UPDATE RESULT] insertId: ${updateResult.insertId}`);
        console.log(`[DEBUG UPDATE RESULT] warningStatus: ${updateResult.warningStatus}`);

        if (updateResult.affectedRows > 0) {
          // Busca o ticket atualizado para enviar as comunicações
          const rows = await query(
            'SELECT * FROM tickets WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?) OR LOWER(code) = LOWER(?)', 
            [dataId, externalReference || '', externalReference || '']
          ) as any[];
          const ticket = rows[0];

          if (ticket) {
            console.log(`[WEBHOOK] ✅ Sucesso! Ticket ${ticket.id} (${ticket.name}) marcado como PAGO.`);
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
            console.warn(`[WEBHOOK] ⚠️ affectedRows > 0 mas ticket não encontrado na SELECT`);
          }
        } else {
          console.error(`[WEBHOOK] ❌ NENHUM ticket atualizado! affectedRows=0 | dataId=${dataId} | external_reference=${externalReference || 'VAZIA'}`);
          console.error(`[WEBHOOK] Possíveis causas: external_reference vazia, paymentIdMP não salvo, ou ticket não existe`);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Error:', error.message);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
