const axios = require('axios');

async function testWA() {
  const url = 'https://bot-eloha.discloud.app/api/events/purchase';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsImVtYWlsIjoiaWFkZWxvaGFAZ21haWwuY29tIiwiaWF0IjoxNzc3NDg4OTQyLCJleHAiOjE3NzgwOTM3NDJ9.DzGFWgF-8JjKcQZWuUphmjtMTiUZvdtQp6NtLILjM9o';

  try {
    console.log('Sending request to', url);
    const response = await axios.post(
      url,
      {
        name: "João Silva",
        phone: "5511999999999",
        product: "Ingresso Chá com Prosa",
        value: 57.00,
        data: {
          ticket_id: "test1234",
          ticket_code: "XYZ987",
          email: "joao@email.com"
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error Status:', error.response ? error.response.status : error.message);
    console.error('Error Data:', error.response ? error.response.data : error.message);
  }
}

testWA();
