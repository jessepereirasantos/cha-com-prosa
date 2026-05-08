import { NextResponse } from 'next/server';
import { query } from '../../../lib/mysql';

export async function GET() {
  try {
    const logs = await query(
      'SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 20'
    ) as any[];

    const html = `
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>Auditoria de Vendas - Chá com Prosa</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background: #f4f4f4; }
            table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
            th { background: #C87A9F; color: white; }
            .success { color: green; font-weight: bold; }
            .error { color: red; font-weight: bold; }
            pre { background: #f9f9f9; padding: 5px; border-radius: 4px; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>Painel de Auditoria (Black Box)</h1>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ticket ID</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Erro/Resposta</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td>${new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                  <td>${log.ticket_id}</td>
                  <td>${log.action}</td>
                  <td class="${log.status}">${log.status}</td>
                  <td>
                    ${log.error ? `<div class="error">ERRO: ${log.error}</div>` : ''}
                    <pre>${log.response || log.payload}</pre>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
