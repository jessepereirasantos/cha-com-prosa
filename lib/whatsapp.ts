import axios from 'axios';

export async function sendWhatsAppMessage(phone: string, message: string) {
  const url = process.env.WHATSAPP_BOT_URL;
  const token = process.env.WHATSAPP_BOT_TOKEN;

  if (!url || !token) {
    console.warn('WhatsApp configuration missing');
    return;
  }

  try {
    const response = await axios.post(url, {
      token,
      phone,
      message
    });
    return response.data;
  } catch (error) {
    console.error('WhatsApp error:', error);
    throw error;
  }
}
