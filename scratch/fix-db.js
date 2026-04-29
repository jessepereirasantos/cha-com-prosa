
const mysql = require('mysql2/promise');

async function fixDatabase() {
  console.log('Adding missing columns to tickets table...');
  
  try {
    const connection = await mysql.createConnection({
      host: '69.6.249.103',
      user: 'jessep71_cha-com-prosa-admin',
      password: 'jjds06091985',
      database: 'jessep71_cha-com-prosa'
    });
    
    // Adiciona a coluna whatsapp_sent se ela não existir
    try {
      await connection.execute('ALTER TABLE tickets ADD COLUMN whatsapp_sent TINYINT DEFAULT 0 AFTER status');
      console.log('Column whatsapp_sent added successfully!');
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log('Column whatsapp_sent already exists.');
      } else {
        throw err;
      }
    }
    
    await connection.end();
    console.log('Database fix completed!');
  } catch (error) {
    console.error('DATABASE FIX FAILED:', error.message);
  }
}

fixDatabase();
