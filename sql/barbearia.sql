-- Banco da barbearia (MariaDB). Pode rodar mais de uma vez: só cria o que falta.
-- Para trocar a senha do usuário do sistema, edite 'troque_esta_senha' antes de rodar.

CREATE DATABASE IF NOT EXISTS barbearia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'barbearia_app'@'localhost' IDENTIFIED BY 'troque_esta_senha';
GRANT ALL PRIVILEGES ON barbearia.* TO 'barbearia_app'@'localhost';
FLUSH PRIVILEGES;

USE barbearia;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  nome VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(120),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS servicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  preco DECIMAL(8,2) NOT NULL,
  duracao_min INT NOT NULL DEFAULT 30,
  ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS horarios_funcionamento (
  dia_semana TINYINT PRIMARY KEY,
  aberto TINYINT(1) NOT NULL DEFAULT 1,
  abre TIME,
  fecha TIME
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  servico_id INT NOT NULL,
  data_hora DATETIME NOT NULL,
  status ENUM('agendado','concluido','cancelado') NOT NULL DEFAULT 'agendado',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (servico_id) REFERENCES servicos(id)
);

CREATE TABLE IF NOT EXISTS promocoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo ENUM('combo','desconto') NOT NULL,
  preco_promocional DECIMAL(8,2),
  desconto_percentual DECIMAL(5,2),
  inicio DATE,
  fim DATE,
  ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS combo_servicos (
  promocao_id INT NOT NULL,
  servico_id INT NOT NULL,
  PRIMARY KEY (promocao_id, servico_id),
  FOREIGN KEY (promocao_id) REFERENCES promocoes(id),
  FOREIGN KEY (servico_id) REFERENCES servicos(id)
);

CREATE TABLE IF NOT EXISTS planos_mensais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  preco_mensal DECIMAL(8,2) NOT NULL,
  qtd_servicos INT,
  ativo TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS barbearia_info (
  id TINYINT PRIMARY KEY DEFAULT 1,
  nome VARCHAR(100),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  endereco VARCHAR(200),
  logo_url VARCHAR(255)
);
