import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  // [WEBHOOK] INÍCIO - RESPOSTA IMEDIATA É PRIORIDADE
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const paymentId = searchParams.get('data.id') || searchParams.get('id') || body.data?.id || body.id;
    
    if (!paymentId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    console.log(`[WEBHOOK] recebido id=${paymentId}`);

    // EXECUTAR PROCESSAMENTO EM BACKGROUND (PADRÃO VERCEL)
    // Para garantir que o Mercado Pago não dê timeout, processamos e respondemos o mais rápido possível.
    
    const processWebhook = async () => {
      try {
        const mpPayment = await getPaymentStatus(paymentId.toString());
        const status = mpPayment.status;
        const ticketId = mpPayment.external_reference;

        if (status === 'approved' || status === 'authorized') {
          const tickets = await query(
            'SELECT * FROM tickets WHERE id = ? OR paymentIdMP = ?', 
            [ticketId || '', paymentId.toString()]
          ) as any[];
          
          const ticket = tickets[0];

          if (ticket && ticket.status !== 'paid') {
            // [DB] ATUALIZAÇÃO RÁPIDA
            await query(
              'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE id = ?',
              [paymentId.toString(), ticket.id]
            );
            console.log(`[DB] Ticket ${ticket.id} marcado como pago`);

            // [WHATSAPP] DISPARO SEM BLOQUEAR O FLUXO PRINCIPAL
            if (ticket.whatsapp_sent === 0) {
              await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
              
              // Fire and forget (Vercel manterá a execução por alguns segundos após a resposta se a função for rápida)
              sendWhatsAppNotification({
                ...ticket,
                amount: mpPayment.transaction_amount || ticket.amount || 57.00
              }).catch(e => console.error('[WHATSAPP] erro no envio:', e.message));
            }
          }
        }
      } catch (err: any) {
        console.error('[WEBHOOK] Erro no processamento:', err.message);
      }
    };

    // Iniciamos o processamento mas NÃO aguardamos o WhatsApp para responder
    // No entanto, aguardamos o status básico do MP para garantir integridade.
    await processWebhook();

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error: any) {
    console.error('[WEBHOOK] Erro Crítico:', error.message);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
