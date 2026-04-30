const axios = require('axios');

async function testRealWA() {
  const url = 'https://bot-eloha.discloud.app/api/events/purchase';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsImVtYWlsIjoiaWFkZWxvaGFAZ21haWwuY29tIiwiaWF0IjoxNzc3NDg4OTQyLCJleHAiOjE3NzgwOTM3NDJ9.DzGFWgF-8JjKcQZWuUphmjtMTiUZvdtQp6NtLILjM9o';

  // O NÚMERO DE TELEFONE QUE VAI RECEBER O TESTE
  // Mude para o seu número com DDD antes de rodar (ex: 11999999999)
  const myPhone = "11946721741"; 

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
          ticket_url: "https://chacomprosa.iadeeloha.com.br/api/generate-ticket?id=cm87i5n2r000214aohv55h11x"
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
