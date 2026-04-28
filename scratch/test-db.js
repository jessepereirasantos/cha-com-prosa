
const mysql = require('mysql2/promise');

async function testDB() {
  console.log('Testing DB Connection...');
  
  try {
    const connection = await mysql.createConnection({
      host: '69.6.249.103',
      user: 'jessep71_cha-com-prosa-admin',
      password: 'jjds06091985',
      database: 'jessep71_cha-com-prosa',
      connectTimeout: 10000
    });
    
    console.log('Successfully connected to the database!');
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('Query test:', rows);
    await connection.end();
  } catch (error) {
    console.error('DATABASE CONNECTION FAILED:', error.message);
  }
}

testDB();
