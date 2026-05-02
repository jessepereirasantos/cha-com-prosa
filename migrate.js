const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER?.trim(),
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  console.log('Iniciando migração manual da tabela tickets...');

  try {
    // Tenta adicionar whatsapp_sent
    try {
      await connection.execute(`ALTER TABLE tickets ADD COLUMN whatsapp_sent TINYINT(1) DEFAULT 0`);
      console.log('✅ Coluna whatsapp_sent criada.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('Aviso: whatsapp_sent já existe.');
      else throw e;
    }

    // Tenta adicionar amount
    try {
      await connection.execute(`ALTER TABLE tickets ADD COLUMN amount DECIMAL(10,2) DEFAULT 57.00`);
      console.log('✅ Coluna amount criada.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('Aviso: amount já existe.');
      else throw e;
    }

    console.log('🚀 Migração concluída!');

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
  } finally {
    await connection.end();
  }
}

migrate();
