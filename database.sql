--
-- Estrutura da tabela `tickets`
--

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` varchar(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `document` varchar(20) DEFAULT NULL,
  `status` enum('pending','paid','cancelled','used') DEFAULT 'pending',
  `createdAt` datetime NOT NULL,
  `paymentMethod` enum('pix','card') DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
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
