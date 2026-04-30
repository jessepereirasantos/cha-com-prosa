const axios = require('axios');

async function testWA() {
  const url = 'https://escolateologicaeloha.com.br/painel/public/api/triggers/create';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTEsImVtYWlsIjoiaWFkZWxvaGFAZ21haWwuY29tIiwiaWF0IjoxNzc3NDg4OTQyLCJleHAiOjE3NzgwOTM3NDJ9.DzGFWgF-8JjKcQZWuUphmjtMTiUZvdtQp6NtLILjM9o';

  try {
    console.log('Sending request...');
    const response = await axios.post(
      url,
      {
        instance_id: 15,
        phone: '5511999999999', // dummy
        event: 'purchase_completed',
        data: {
          customer_name: 'Teste Local',
          product_name: 'Ingresso Chá com Prosa',
          amount: 57.00
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
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testWA();
