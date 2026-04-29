import { NextResponse } from 'next/server';
import { getAllTickets, syncTicketStatus } from '@/lib/db';
import { getPaymentStatus } from '@/lib/mercadopago';
import { TicketStatus } from '@/lib/types';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('admin_auth');
  if (!authCookie || authCookie.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tickets = await getAllTickets();
    const pendingTickets = tickets.filter(t => t.status === TicketStatus.PENDING && t.paymentIdMP);
    
    let updatedCount = 0;
    
    for (const ticket of pendingTickets) {
      try {
        if (ticket.paymentIdMP) {
          const mpPayment = await getPaymentStatus(ticket.paymentIdMP);
          if (mpPayment.status === 'approved') {
            await syncTicketStatus(ticket.id, TicketStatus.PAID);
            updatedCount++;
            console.log(`[SYNC] Ticket ${ticket.id} sincronizado para PAGO via auditoria.`);
          }
        }
      } catch (e) {
        console.error(`[SYNC] Erro ao sincronizar ticket ${ticket.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Sync API Error:', error);
    return NextResponse.json({ error: 'Erro ao sincronizar dados' }, { status: 500 });
  }
}
