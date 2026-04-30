const pool = require('../config/database');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].c > 0;
}

async function ensureColumn(tableName, columnName, ddl) {
  const exists = await columnExists(tableName, columnName);
  if (exists) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
}

async function ensureIndex(tableName, indexName, ddl) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  if (rows[0].c > 0) return;
  await pool.query(`ALTER TABLE ${tableName} ADD ${ddl}`);
}

async function ensureSchema() {
  await ensureColumn('instances', 'flow_id', 'flow_id INT NULL');
  await ensureIndex('instances', 'idx_instances_flow_id', 'INDEX idx_instances_flow_id (flow_id)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS instance_flows (
      instance_id INT NOT NULL,
      flow_id INT NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (instance_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('flows', 'version', 'version INT NOT NULL DEFAULT 1');
  await ensureColumn('flows', 'structure_json', 'structure_json JSON NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instance_id INT NOT NULL,
      user_phone VARCHAR(30) NOT NULL,
      current_node VARCHAR(100) NOT NULL DEFAULT 'start',
      variables_json JSON NULL,
      is_human_active TINYINT(1) NOT NULL DEFAULT 0,
      human_until DATETIME NULL,
      inactivity_due_at DATETIME NULL,
      inactivity_payload_json JSON NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_instance_user (instance_id, user_phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('conversations', 'is_human_active', 'is_human_active TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('conversations', 'human_until', 'human_until DATETIME NULL');
  await ensureColumn('conversations', 'inactivity_due_at', 'inactivity_due_at DATETIME NULL');
  await ensureColumn('conversations', 'inactivity_payload_json', 'inactivity_payload_json JSON NULL');

  await ensureColumn('conversations', 'finished_at', 'finished_at DATETIME NULL');
  await ensureColumn('conversations', 'finished_by', 'finished_by VARCHAR(50) NULL');
  await ensureColumn('conversations', 'status', "status VARCHAR(20) NOT NULL DEFAULT 'active'");
  await ensureColumn('conversations', 'started_at', 'started_at DATETIME NULL');
  await ensureColumn('conversations', 'source', "source VARCHAR(30) NOT NULL DEFAULT 'flow'");

  await ensureIndex('conversations', 'idx_conversations_inactivity_due_at', 'INDEX idx_conversations_inactivity_due_at (inactivity_due_at)');
  await ensureIndex('conversations', 'idx_conversations_human_until', 'INDEX idx_conversations_human_until (human_until)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_limits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instance_id INT NOT NULL,
      phone VARCHAR(30) NOT NULL,
      rule_id VARCHAR(120) NOT NULL,
      counter INT NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_limit (instance_id, phone, rule_id),
      KEY idx_user_limit_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instance_id INT NOT NULL,
      phone VARCHAR(30) NOT NULL,
      blocked_until DATETIME NOT NULL,
      reason VARCHAR(255) NULL,
      block_message VARCHAR(500) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_blocked_user (instance_id, phone),
      KEY idx_blocked_until (blocked_until)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_media_uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      client_id INT NOT NULL,
      media_type VARCHAR(50) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      original_name VARCHAR(255) NULL,
      mime_type VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_flow_media_flow_id (flow_id),
      KEY idx_flow_media_client_id (client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(30) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'manager', 'operator') DEFAULT 'operator',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_users_tenant_id (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('instances', 'tenant_id', 'tenant_id INT NULL');
  await ensureIndex('instances', 'idx_instances_tenant_id', 'INDEX idx_instances_tenant_id (tenant_id)');

  await ensureColumn('flows', 'tenant_id', 'tenant_id INT NULL');
  await ensureIndex('flows', 'idx_flows_tenant_id', 'INDEX idx_flows_tenant_id (tenant_id)');

  await ensureColumn('conversations', 'tenant_id', 'tenant_id INT NULL');
  await ensureIndex('conversations', 'idx_conversations_tenant_id', 'INDEX idx_conversations_tenant_id (tenant_id)');

  await ensureColumn('clients', 'tenant_id', 'tenant_id INT NULL');
  await ensureColumn('clients', 'role', "role ENUM('admin', 'client') NOT NULL DEFAULT 'client'");
  await ensureColumn('clients', 'password', 'password VARCHAR(255) NULL');
  await ensureColumn('clients', 'name', 'name VARCHAR(255) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL,
      max_instances INT NOT NULL DEFAULT 1,
      max_flows INT NOT NULL DEFAULT 1,
      api_events_enabled TINYINT(1) NOT NULL DEFAULT 0,
      price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      plan_id INT NOT NULL,
      status ENUM('active', 'suspended', 'cancelled', 'trial', 'pending') DEFAULT 'pending',
      mp_subscription_id VARCHAR(100) NULL,
      mp_init_point VARCHAR(500) NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NULL,
      cancelled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_subscriptions_tenant_id (tenant_id),
      KEY idx_subscriptions_plan_id (plan_id),
      KEY idx_subscriptions_status (status),
      KEY idx_subscriptions_mp_id (mp_subscription_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await ensureColumn('subscriptions', 'mp_subscription_id', 'mp_subscription_id VARCHAR(100) NULL');
  await ensureColumn('subscriptions', 'mp_init_point', 'mp_init_point VARCHAR(500) NULL');
  await ensureColumn('subscriptions', 'mp_payment_id', 'mp_payment_id VARCHAR(100) NULL');
  await ensureColumn('subscriptions', 'coupon_id', 'coupon_id INT NULL');
  await ensureColumn('subscriptions', 'discount_applied', 'discount_applied DECIMAL(10,2) NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      description VARCHAR(255) NULL,
      discount_type ENUM('percentage', 'fixed', 'free_period') DEFAULT 'percentage',
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      free_days INT NULL,
      max_uses INT NULL,
      uses_count INT DEFAULT 0,
      valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
      valid_until DATETIME NULL,
      plan_id INT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_coupons_code (code),
      KEY idx_coupons_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [existingPlans] = await pool.query('SELECT COUNT(*) as count FROM plans');
  if (existingPlans[0].count === 0) {
    await pool.query(`
      INSERT INTO plans (name, slug, max_instances, max_flows, api_events_enabled, price_monthly, is_active) VALUES
      ('Gold', 'gold', 1, 1, 0, 97.00, 1),
      ('Medium', 'medium', 3, 3, 0, 197.00, 1),
      ('Platinum', 'platinum', 6, 6, 1, 297.00, 1)
    `);
  }

  // Garantir que todos os planos estejam ativos
  await pool.query('UPDATE plans SET is_active = 1 WHERE is_active IS NULL OR is_active = 0');
}

module.exports = {
  ensureSchema
};
