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

    console.log(`[WEBHOOK] recebido id=${paymentId}`);

    // 1. Consulta API oficial (Fonte da Verdade)
    const mpPayment = await getPaymentStatus(paymentId.toString());
    const status = mpPayment.status;
    const ticketId = mpPayment.external_reference;
    
    console.log(`[WEBHOOK] status confirmado=${status} | ticketId=${ticketId}`);

    // 2. Se aprovado, executa fluxo de confirmação
    if (status === 'approved' || status === 'authorized') {
      
      // Busca o ticket PRIMEIRO
      const tickets = await query(
        'SELECT * FROM tickets WHERE id = ? OR paymentIdMP = ?', 
        [ticketId || '', paymentId.toString()]
      ) as any[];
      
      const ticket = tickets[0];

      if (ticket) {
        // [DB] atualizado com sucesso
        await query(
          'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE id = ?',
          [paymentId.toString(), ticket.id]
        );
        console.log('[DB] atualizado com sucesso');

        if (ticket.whatsapp_sent === 0) {
          console.log('[WHATSAPP] disparo iniciado (background)');
          
          // Marca como enviado ANTES do disparo
          await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
          
          // DISPARO SEM AWAIT (NÃO BLOQUEIA A RESPOSTA 200)
          sendWhatsAppNotification({
            ...ticket,
            amount: mpPayment.transaction_amount || ticket.amount || 57.00
          }).then(() => {
            console.log('[WHATSAPP] sucesso no envio');
          }).catch(waErr => {
            console.error('[WHATSAPP] erro detalhado:', waErr.message);
          });
        }
      }
    }

    // RESPONDE 200 IMEDIATAMENTE (NÃO ESPERA O WHATSAPP)
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error: any) {
    console.error('[WEBHOOK] Erro Crítico:', error.message);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
