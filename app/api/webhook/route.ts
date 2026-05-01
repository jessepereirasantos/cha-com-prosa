// v3.0 - Arquitetura Determinística Final
import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { updateTicket } from '../../../lib/db';
import { query } from '../../../lib/mysql';
import { TicketStatus } from '../../../lib/types';
import { sendTicketEmail } from '../../../lib/email';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    // 1. EXTRAÇÃO ROBUSTA DO ID (PASSO CIRÚRGICO)
    const { searchParams } = new URL(req.url);
    const typeFromParam = searchParams.get('type') || searchParams.get('topic');
    let dataId = searchParams.get('data.id') || searchParams.get('id');

    // Suporte ao corpo JSON (v2)
    if (!dataId) {
      try {
        const body = await req.json();
        console.log('[WEBHOOK] Processando corpo JSON:', JSON.stringify(body));
        dataId = body.data?.id || body.id || (body.resource && body.resource.split('/').pop());
      } catch (e) { /* Silencioso */ }
    }

    if (!dataId) {
      console.warn('[WEBHOOK] ⚠️ Nenhum ID de pagamento encontrado.');
      return NextResponse.json({ received: true });
    }

    // 2. CONSULTA DETERMINÍSTICA À API OFICIAL
    console.log(`[WEBHOOK] Consultando API oficial para ID: ${dataId}`);
    const mpPayment = await getPaymentStatus(dataId.toString());
    const status = mpPayment.status;
    const externalReference = mpPayment.external_reference;

    // 3. TRATAMENTO DE STATUS (APPROVED OU AUTHORIZED)
    if (status === 'approved' || status === 'authorized') {
      console.log(`[WEBHOOK] Status confirmado: ${status}. Atualizando banco...`);
      
      const updateResult = await query(
        'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?) OR LOWER(code) = LOWER(?)',
        [dataId.toString(), dataId.toString(), externalReference || '', externalReference || '']
      ) as any;

      if (updateResult.affectedRows > 0) {
        // Busca o ticket atualizado para as comunicações
        const rows = await query(
          'SELECT * FROM tickets WHERE paymentIdMP = ? OR LOWER(id) = LOWER(?)',
          [dataId.toString(), externalReference || '']
        ) as any[];
        const ticket = rows[0];

        if (ticket) {
          // Disparo de comunicações (Non-blocking)
          sendTicketEmail(ticket.email, ticket).catch(e => console.error('[EMAIL]', e));
          
          if (ticket.whatsapp_sent === 0) {
            await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
            sendWhatsAppNotification(ticket).catch(err => console.error('[WHATSAPP]', err));
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[WEBHOOK] Erro crítico:', error.message);
    return NextResponse.json({ received: true }, { status: 200 }); // Responde 200 para evitar loops do MP
  }
}
