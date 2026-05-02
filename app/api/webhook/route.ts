import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // [WEBHOOK] capturando ID do pagamento
    const paymentId = searchParams.get('data.id') || searchParams.get('id') || body.data?.id || body.id;
    
    if (!paymentId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    console.log(`[WEBHOOK] recebido id=${paymentId}`);

    // 1. Consulta API oficial (Fonte Única da Verdade)
    const mpPayment = await getPaymentStatus(paymentId.toString());
    const status = mpPayment.status;
    const ticketId = mpPayment.external_reference;
    
    console.log(`[WEBHOOK] status confirmado=${status} | ticketId=${ticketId}`);

    // 2. Se aprovado, executa o fluxo determinístico
    if (status === 'approved' || status === 'authorized') {
      
      // Busca o ticket (pelo ID ou pelo paymentIdMP vinculado na criação)
      const tickets = await query(
        'SELECT * FROM tickets WHERE id = ? OR paymentIdMP = ?', 
        [ticketId || '', paymentId.toString()]
      ) as any[];
      
      const ticket = tickets[0];

      if (ticket) {
        // [DB] Atualização Atômica
        await query(
          'UPDATE tickets SET status = "paid", paymentIdMP = ? WHERE id = ?',
          [paymentId.toString(), ticket.id]
        );
        console.log('[DB] atualizado com sucesso');

        // [WHATSAPP] Disparo com trava de duplicidade
        if (ticket.whatsapp_sent === 0) {
          console.log('[WHATSAPP] disparando gatilho...');
          
          // Marca como enviado ANTES para ser ultra-seguro contra race conditions
          await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
          
          // Aguarda o disparo para garantir que a Vercel não corte a execução,
          // mas o bot é rápido o suficiente para não estourar o timeout do MP.
          try {
            await sendWhatsAppNotification({
              ...ticket,
              amount: mpPayment.transaction_amount || ticket.amount || 57.00
            });
            console.log('[WHATSAPP] enviado com sucesso');
          } catch (waErr: any) {
            console.error('[WHATSAPP] falha no envio:', waErr.message);
          }
        }
      } else {
        console.warn(`[WEBHOOK] Ticket não encontrado para paymentId ${paymentId}`);
      }
    }

    // RESPONDE 200 OK (Obrigatório para o MP parar de reenviar)
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error: any) {
    console.error('[WEBHOOK] Erro Crítico:', error.message);
    // Sempre responde 200 para evitar que o Mercado Pago bloqueie o endpoint por erros repetidos
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Webhook Motor is active" }, { status: 200 });
}
