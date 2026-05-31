CREATE DATABASE IF NOT EXISTS ultrabarber_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ultrabarber_crm;

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  neighborhood VARCHAR(128),
  address VARCHAR(255),
  instagram VARCHAR(128),
  notes TEXT,
  status ENUM('novo','mensagem_enviada','respondeu','interessado','reuniao_marcada','recusou','cliente') NOT NULL DEFAULT 'novo',
  last_contact_date DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  direction ENUM('sent','received') NOT NULL DEFAULT 'sent',
  content TEXT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
