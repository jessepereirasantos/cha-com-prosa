-- =============================
-- TABELA DE CLIENTES
-- =============================
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================
-- TABELA DE INSTÂNCIAS (NÚMEROS)
-- =============================
CREATE TABLE instances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    instance_name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'disconnected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =============================
-- TABELA DE FLUXOS
-- =============================
CREATE TABLE flows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    flow_data JSON NOT NULL,
    is_active TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =============================
-- TABELA DE CONTATOS
-- =============================
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    name VARCHAR(150),
    current_flow_id INT NULL,
    current_step VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- =============================
-- TABELA DE MENSAGENS
-- =============================
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    contact_id INT NOT NULL,
    direction ENUM('inbound','outbound') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- =============================
-- TABELA DE TRIGGERS EXTERNOS
-- (Integração com plataforma de cursos)
-- =============================
CREATE TABLE external_triggers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instance_id INT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON,
    status VARCHAR(20) DEFAULT 'pending',
    status_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_event_type (event_type)
);