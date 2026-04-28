
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
    
    // Adiciona a coluna paymentIdMP se ela não existir
    try {
      await connection.execute('ALTER TABLE tickets ADD COLUMN paymentIdMP VARCHAR(255) AFTER paymentMethod');
      console.log('Column paymentIdMP added successfully!');
    } catch (err) {
      if (err.code === 'ER_DUP_COLUMN_NAME') {
        console.log('Column paymentIdMP already exists.');
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
