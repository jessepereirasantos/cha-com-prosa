import { NextResponse } from 'next/server';
import { getAllCoupons, addCoupon, deleteCoupon } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const auth = cookieStore.get('admin_auth');
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const coupons = await getAllCoupons();
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const auth = cookieStore.get('admin_auth');
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code, discount } = await req.json();
    if (!code || !discount) {
       return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const coupon = await addCoupon(code, parseFloat(discount));
    return NextResponse.json(coupon);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add coupon' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const auth = cookieStore.get('admin_auth');
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await deleteCoupon(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
  }
}
