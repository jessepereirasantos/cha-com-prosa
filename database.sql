--
-- Estrutura da tabela `tickets`
--

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `document` varchar(20) DEFAULT NULL,
  `paymentIdMP` VARCHAR(100),
  `status` enum('pending','paid','cancelled','used') DEFAULT 'pending',
  `paymentMethod` enum('pix','card') DEFAULT NULL,
  `amount` DECIMAL(10,2),
  `createdAt` datetime NOT NULL,
  `code` varchar(20) NOT NULL,
  `whatsapp_sent` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Estrutura da tabela `audit_logs`
--

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_id` VARCHAR(50),
  `action` VARCHAR(100),
  `status` VARCHAR(50),
  `payload` TEXT,
  `response` TEXT,
  `error` TEXT,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Estrutura da tabela `coupons`
--

CREATE TABLE IF NOT EXISTS `coupons` (
  `id` varchar(20) NOT NULL,
  `code` varchar(50) NOT NULL,
  `discount` decimal(10,2) NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
