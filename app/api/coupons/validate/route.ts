
import { NextResponse } from 'next/server';
import { query } from '@/lib/mysql';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Código não fornecido' }, { status: 400 });
    }

    const rows = await query('SELECT * FROM coupons WHERE code = ?', [code.toUpperCase()]) as any[];
    
    if (rows.length === 0) {
      return NextResponse.json({ valid: false, error: 'Cupom inválido' });
    }

    const coupon = rows[0];
    return NextResponse.json({
      valid: true,
      code: coupon.code,
      discount: parseFloat(coupon.discount.toString())
    });
  } catch (error) {
    console.error('Validate Coupon Error:', error);
    return NextResponse.json({ error: 'Erro ao validar cupom' }, { status: 500 });
  }
}
