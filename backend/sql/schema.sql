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
  direction ENUM('sent','received','suggested') NOT NULL DEFAULT 'sent',
  content TEXT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

ALTER TABLE leads MODIFY phone VARCHAR(64) NULL;
ALTER TABLE messages MODIFY direction ENUM('sent','received','suggested') NOT NULL DEFAULT 'sent';

CREATE TABLE IF NOT EXISTS ai_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  active_profile VARCHAR(64) NOT NULL DEFAULT 'local_opportunity',
  custom_instructions TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO ai_settings (id, active_profile, custom_instructions)
VALUES (1, 'local_opportunity', '');
