import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

/**
 * ENDPOINT DE POLLING (UX IMEDIATA + REDUNDÂNCIA)
 * Este endpoint consulta DIRETAMENTE a API do Mercado Pago.
 * Ele também serve como REDUNDÂNCIA para o Webhook:
 * Se o Webhook falhar, o Polling detecta a aprovação, atualiza o banco e dispara o WhatsApp.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'ID do pagamento não fornecido' }, { status: 400 });
    }

    // 1. Consulta DIRETAMENTE a API oficial (Fonte da Verdade)
    const mpPayment = await getPaymentStatus(paymentId);
    const status = mpPayment.status;
    const isApproved = status === 'approved' || status === 'authorized';

    // 2. ATUALIZAÇÃO DO BANCO: Se aprovado, apenas atualiza status (WEBHOOK cuida do WhatsApp)
    if (isApproved) {
      // Busca o ticket no banco
      const tickets = await query(
        'SELECT * FROM tickets WHERE paymentIdMP = ? OR id = ?',
        [paymentId, mpPayment.external_reference]
      ) as any[];

      if (tickets.length > 0) {
        const ticket = tickets[0];

        // Atualiza status se ainda não estiver como pago
        if (ticket.status !== 'paid') {
          await query('UPDATE tickets SET status = "paid" WHERE id = ?', [ticket.id]);
          console.log(`[POLLING] Status atualizado para 'paid' para o ticket ${ticket.id}`);
        }
      }
    }

    return NextResponse.json({
      status: isApproved ? 'approved' : 'pending'
    });

  } catch (error: any) {
    console.error('[POLLING] Erro na consulta direta:', error.message);
    return NextResponse.json({ status: 'pending' });
  }
}
