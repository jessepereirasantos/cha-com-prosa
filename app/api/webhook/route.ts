import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { query } from '../../../lib/mysql';
import { sendWhatsAppNotification } from '../../../lib/whatsapp';

export async function POST(req: Request) {
  // 1. EXTRAÇÃO RELÂMPAGO
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const paymentId = searchParams.get('data.id') || searchParams.get('id') || body.data?.id || body.id;

  if (!paymentId) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 2. DISPARA PROCESSAMENTO EM BACKGROUND (SEM AWAIT)
  // Isso garante resposta <100ms para o Mercado Pago/Bancos
  processPaymentInBackground(paymentId.toString());

  // 3. RESPONDE 200 OK IMEDIATAMENTE
  return NextResponse.json({ ok: true }, { status: 200 });
}

// FUNÇÃO DE PROCESSAMENTO DESACOPLADA
async function processPaymentInBackground(paymentId: string) {
  try {
    console.log(`[WEBHOOK] Iniciando processamento background para ID: ${paymentId}`);
    
    // Busca status no Mercado Pago
    const mpPayment = await getPaymentStatus(paymentId);
    if (!mpPayment || (mpPayment.status !== 'approved' && mpPayment.status !== 'authorized')) {
      console.log(`[WEBHOOK] Pagamento ${paymentId} ainda não aprovado: ${mpPayment?.status}`);
      return;
    }

    // BUSCA TICKET REAL NO BANCO
    // Usamos o paymentIdMP como âncora de verdade
    const tickets = await query(
      'SELECT * FROM tickets WHERE paymentIdMP = ?', 
      [paymentId]
    ) as any[];

    if (tickets.length === 0) {
      console.warn(`[WEBHOOK] Alerta: Nenhum ticket encontrado no banco para paymentIdMP: ${paymentId}`);
      return;
    }

    const ticket = tickets[0];
    console.log(`[WEBHOOK] Ticket encontrado! Cliente: ${ticket.name} | Código: ${ticket.code}`);

    // ATUALIZA STATUS NO BANCO
    if (ticket.status !== 'paid') {
      await query('UPDATE tickets SET status = "paid" WHERE id = ?', [ticket.id]);
      console.log(`[DB] Status do Ticket ${ticket.id} atualizado para 'paid'`);
    }

    // DISPARO DO WHATSAPP (Garantindo que envie apenas uma vez)
    // Buscamos se já foi enviado para evitar duplicidade em retentativas do webhook
    const checkSent = await query('SELECT whatsapp_sent FROM tickets WHERE id = ?', [ticket.id]) as any[];
    
    if (checkSent[0]?.whatsapp_sent === 0) {
      console.log(`[WHATSAPP] Enviando para: ${ticket.phone} | Nome: ${ticket.name}`);
      
      // Marcar como enviado ANTES para evitar race condition
      await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [ticket.id]);
      
      try {
        await sendWhatsAppNotification({
          ...ticket,
          amount: mpPayment.transaction_amount || 57.00
        });
        console.log(`[WHATSAPP] Sucesso no disparo para ${ticket.name}`);
      } catch (waErr: any) {
        console.error(`[WHATSAPP] Erro no envio: ${waErr.message}`);
        // Resetamos se falhou para tentar novamente no próximo sinal do webhook
        await query('UPDATE tickets SET whatsapp_sent = 0 WHERE id = ?', [ticket.id]);
      }
    } else {
      console.log(`[WHATSAPP] Notificação já enviada anteriormente para o ticket ${ticket.id}`);
    }

  } catch (error: any) {
    console.error(`[WEBHOOK ERROR] Falha no processamento background: ${error.message}`);
  }
}
