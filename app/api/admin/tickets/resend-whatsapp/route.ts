import { NextResponse } from 'next/server';
import { getTicket } from '@/lib/db';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { query } from '@/lib/mysql';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('admin_auth');
  if (!authCookie || authCookie.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const ticket = await getTicket(id);
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    // Envia a notificação manualmente
    await sendWhatsAppNotification(ticket);
    
    // Garante que está marcado como enviado
    await query('UPDATE tickets SET whatsapp_sent = 1 WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend WhatsApp Error:', error);
    return NextResponse.json({ error: 'Failed to resend' }, { status: 500 });
  }
}
