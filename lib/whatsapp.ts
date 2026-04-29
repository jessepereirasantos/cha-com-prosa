import axios from 'axios';

export async function sendWhatsAppNotification(ticket: any) {
  const baseUrl = process.env.WHATSAPP_BOT_URL;
  const token = process.env.WHATSAPP_BOT_TOKEN;

  if (!baseUrl || !token) {
    console.warn('[WHATSAPP] Configuração ausente no .env');
    return;
  }

  if (!ticket || !ticket.phone) {
    console.warn('[WHATSAPP] Ticket ou telefone ausente');
    return;
  }

  // Ensure phone is only digits
  const phone = ticket.phone.replace(/\D/g, '');
  const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;

  try {
    console.log(`[WHATSAPP] Enviando mensagem para: ${phoneFormatted}`);
    const response = await axios.post(
      `${baseUrl}/api/triggers/create`,
      {
        instance_id: 15,
        phone: phoneFormatted,
        event: "purchase_completed",
        data: {
          customer_name: ticket.name,
          product_name: "Ingresso Chá com Prosa",
          amount: ticket.amount || 57.00
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('[WHATSAPP] Sucesso no envio');
    return response.data;
  } catch (error: any) {
    console.error(`[WHATSAPP] Erro ao enviar: ${error?.response?.data?.message || error.message}`);
    // Non-blocking, do not throw
  }
}
