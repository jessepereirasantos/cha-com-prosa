import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    const config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    
    if (!config.host || !config.user || !config.password) {
      console.warn('Database credentials missing. Falling back or failing fast on query.');
    }
    
    pool = mysql.createPool(config);
  }
  return pool;
}

export async function query(sql: string, params?: any[]) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}
