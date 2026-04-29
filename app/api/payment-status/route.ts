import { NextResponse } from 'next/server';
import { getPaymentStatus } from '../../../lib/mercadopago';
import { updateTicketStatus } from '../../../lib/db';
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

    console.log(`[POLLING] Status oficial retornado: ${status}`);

    // Se aprovado, garante que o banco está atualizado
    if (status === 'approved') {
      // Busca o ticket pelo paymentIdMP
      const rows = await query('SELECT * FROM tickets WHERE paymentIdMP = ?', [paymentId]) as any[];
      const ticket = rows[0];

      if (ticket && ticket.status === 'pending') {
        console.log(`[POLLING] Detectada aprovação oficial. Atualizando ticket ${ticket.id}...`);
        
        // Atualiza status no banco
        await updateTicketStatus(ticket.id, TicketStatus.PAID);
        
        // Dispara e-mail e whatsapp de forma assíncrona
        try {
          await sendTicketEmail(ticket.email, ticket);
          if (ticket.phone) {
             await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu pagamento foi aprovado! Seu código é ${ticket.code}`);
          }
        } catch (msgErr) {
          console.error('[POLLING] Messaging error during status check:', msgErr);
        }
      }
    }

    return NextResponse.json({ 
      status: status === 'approved' ? 'approved' : 'pending' 
    });

  } catch (error: any) {
    console.error('[POLLING] Error:', error.message);
    return NextResponse.json({ status: 'pending' });
  }
}
