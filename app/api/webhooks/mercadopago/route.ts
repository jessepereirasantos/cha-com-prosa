import { NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/mercadopago';
import { updateTicketStatus, getTicket } from '@/lib/db';
import { TicketStatus } from '@/lib/types';
import { sendTicketEmail } from '@/lib/email';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const resourceId = searchParams.get('id') || searchParams.get('data.id');
  const type = searchParams.get('type');

  console.log('Webhook received:', { type, resourceId });

  if (type === 'payment' && resourceId) {
    try {
      const payment = await getPaymentStatus(resourceId);
      
      if (payment.status === 'approved') {
        const ticketId = payment.external_reference || (payment.additional_info?.items?.[0]?.id);
        
        if (ticketId) {
          const ticket = await getTicket(ticketId);
          if (ticket && ticket.status !== TicketStatus.PAID) {
            await updateTicketStatus(ticketId, TicketStatus.PAID);
            
            // Send notifications
            await sendTicketEmail(ticket.email, ticket);
            await sendWhatsAppMessage(ticket.phone, `Olá ${ticket.name}, seu ingresso para o Chá com Prosa foi confirmado! Código: ${ticket.code}`);
          }
        }
      }
    } catch (error) {
      console.error('Webhook Error:', error);
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
