import { NextResponse } from 'next/server';
import { getAllTickets, deleteTicket, updateTicket } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('admin_auth');
  if (!authCookie || authCookie.value !== 'true') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tickets = await getAllTickets();
    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('admin_auth');
  if (!authCookie || authCookie.value !== 'true') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const updated = await updateTicket(id, data);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('admin_auth');
  if (!authCookie || authCookie.value !== 'true') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await deleteTicket(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}
