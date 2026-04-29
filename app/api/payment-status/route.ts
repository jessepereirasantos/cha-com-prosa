import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { syncTicketStatus } from '../../../lib/db';
import { query } from '../../../lib/mysql';
import { TicketStatus } from '../../../lib/types';
import { sendTicketEmail } from '../../../lib/email';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'ID do pagamento não fornecido' }, { status: 400 });
    }

    console.log(`[POLLING] Verificando status oficial para pagamento: ${paymentId}`);
    const mpPayment = await getPaymentStatus(paymentId);
    const status = mpPayment.status;

    // ====== DEBUG CRÍTICO: Dados completos do polling ======
    console.log(`[DEBUG POLLING] ===== DADOS DO MP =====`);
    console.log(`[DEBUG POLLING] payment.id: ${paymentId}`);
    console.log(`[DEBUG POLLING] payment.status: ${status}`);
    console.log(`[DEBUG POLLING] payment.status_detail: ${mpPayment.status_detail}`);
    console.log(`[DEBUG POLLING] payment.payment_type_id: ${mpPayment.payment_type_id}`);
    console.log(`[DEBUG POLLING] payment.external_reference: ${mpPayment.external_reference}`);

    // Se aprovado ou authorized (cartão), garante que o banco está atualizado
    if (status === 'approved' || status === 'authorized') {
      // Busca o ticket pelo paymentIdMP ou pela external_reference (ID do ticket)
      let ticket = null;
      const rowsById = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [paymentId]) as any[];

      console.log(`[DEBUG POLLING] Busca por paymentIdMP=${paymentId}: encontrou ${rowsById.length} ticket(s)`);

      if (rowsById.length > 0) {
        ticket = rowsById[0];
        console.log(`[DEBUG POLLING] Ticket encontrado por paymentIdMP: id=${ticket.id}, status=${ticket.status}`);
      } else if (mpPayment.external_reference) {
        console.log(`[DEBUG POLLING] Ticket não encontrado por paymentIdMP. Buscando por external_reference: ${mpPayment.external_reference}`);
        const rowsByRef = await query('SELECT * FROM tickets WHERE LOWER(id) = LOWER(?)', [mpPayment.external_reference]) as any[];
        console.log(`[DEBUG POLLING] Busca por external_reference=${mpPayment.external_reference}: encontrou ${rowsByRef.length} ticket(s)`);
        if (rowsByRef.length > 0) {
          ticket = rowsByRef[0];
          console.log(`[DEBUG POLLING] Ticket encontrado por external_reference: id=${ticket.id}, status=${ticket.status}, paymentIdMP=${ticket.paymentIdMP}`);
          // Vincula o ID do pagamento se estava faltando
          const { updateTicket } = await import('../../../lib/db');
          await updateTicket(ticket.id, { paymentIdMP: paymentId });
          console.log(`[DEBUG POLLING] paymentIdMP vinculado ao ticket ${ticket.id}`);
        }
      } else {
        console.error(`[DEBUG POLLING] ❌ Nenhum external_reference e nenhum ticket com paymentIdMP=${paymentId}`);
      }

      if (ticket && ticket.status === 'pending') {
        console.log(`[DEBUG POLLING] Detectada aprovação oficial. Atualizando ticket ${ticket.id} de pending para paid...`);

        // Atualiza status no banco usando SQL DIRETO
        const updateResult = await query(
          'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE id = ?',
          [paymentId, ticket.id]
        ) as any;
        console.log(`[DEBUG POLLING] UPDATE result: affectedRows=${updateResult.affectedRows}, changedRows=${updateResult.changedRows}`);

        // Verifica se realmente atualizou
        const ticketAfter = await query('SELECT id, status, paymentIdMP FROM tickets WHERE id = ?', [ticket.id]) as any[];
        console.log(`[DEBUG POLLING] Ticket DEPOIS do update: status=${ticketAfter[0]?.status}, paymentIdMP=${ticketAfter[0]?.paymentIdMP}`);

        // Dispara e-mail e whatsapp de forma assíncrona
        try {
          await sendTicketEmail(ticket.email, ticket);
          if (ticket.phone) {
            await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`);
          }
        } catch (msgErr) {
          console.error('[POLLING] Messaging error during status check:', msgErr);
        }
      } else if (ticket && ticket.status !== 'pending') {
        console.log(`[DEBUG POLLING] Ticket ${ticket.id} já está com status=${ticket.status}, nada a fazer.`);
      } else {
        console.error(`[DEBUG POLLING] ❌ Nenhum ticket encontrado para pagamento ${paymentId}`);
      }
    }

    return NextResponse.json({
      status: (status === 'approved' || status === 'authorized') ? 'approved' : 'pending'
    });

  } catch (error: any) {
    console.error('[POLLING] Error:', error.message);
    return NextResponse.json({ status: 'pending' });
  }
}
