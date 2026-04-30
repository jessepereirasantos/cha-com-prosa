const axios = require('axios');

async function testRealWA() {
  const url = 'https://bot-eloha.discloud.app/api/events/purchase';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsImVtYWlsIjoiaWFkZWxvaGFAZ21haWwuY29tIiwiaWF0IjoxNzc3NDg4OTQyLCJleHAiOjE3NzgwOTM3NDJ9.DzGFWgF-8JjKcQZWuUphmjtMTiUZvdtQp6NtLILjM9o';

  // NUMERO COM CODIGO DO PAIS 55 + DDD + NUMERO
  const myPhone = "5511946721741";

  try {
    console.log(`[TESTE] Enviando evento de compra simulado para: ${myPhone}`);
    const response = await axios.post(
      url,
      {
        name: "Teste de Sistema",
        phone: myPhone,
        product: "Ingresso Chá com Prosa (Teste)",
        value: 57.00,
        data: {
          ticket_id: "test1234",
          ticket_code: "XYZ987",
          email: "teste@teste.com",
          // URL de PDF publico para teste — em producao sera o link real do ingresso
          ticket_url: "https://www.w3.org/WAI/UR/pdf-test/A2/ev.pdf"
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ SUCESSO! Resposta do Bot:', response.data);
  } catch (error) {
    console.error('❌ ERRO:', error.response ? error.response.data : error.message);
  }
}

testRealWA();
