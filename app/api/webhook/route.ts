import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Logs obrigatórios para auditoria
    console.log("--- WEBHOOK RECEBIDO ---");
    const { searchParams } = new URL(req.url);
    console.log("QUERY PARAMS:", Object.fromEntries(searchParams));

    const body = await req.json().catch(() => ({}));
    console.log("WEBHOOK BODY:", body);

    // 2. RESPOSTA IMEDIATA 200 OK (CRÍTICO)
    return NextResponse.json({ ok: true, message: "Webhook received" }, { status: 200 });

  } catch (error: any) {
    console.error("WEBHOOK ERROR:", error.message);
    // Sempre responde 200 para o Mercado Pago não tentar reenviar infinitamente
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// Suporte para GET apenas para teste manual (retornará 200 também para facilitar validação)
export async function GET() {
  return NextResponse.json({ message: "Webhook endpoint is active. Use POST for Mercado Pago." }, { status: 200 });
}
