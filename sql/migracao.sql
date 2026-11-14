-- Acrescenta ao banco da barbearia o que o painel precisa. Não apaga nada.
-- Rode uma vez. Se rodar de novo, só a última linha dá erro de "duplicado" e pode ser ignorada.

USE barbearia;

CREATE TABLE IF NOT EXISTS barbeiros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1
);

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS barbeiro_id INT NULL;

-- combo = 1 marca "casadinhas"; preco_original é o preço "de" (sem desconto)
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS combo TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_original DECIMAL(8,2) NULL;

ALTER TABLE planos_mensais ADD COLUMN IF NOT EXISTS preco_original DECIMAL(8,2) NULL;

ALTER TABLE barbearia_info ADD COLUMN IF NOT EXISTS campanha VARCHAR(300) NULL;

ALTER TABLE agendamentos
  ADD CONSTRAINT fk_agendamento_barbeiro FOREIGN KEY (barbeiro_id) REFERENCES barbeiros(id);
