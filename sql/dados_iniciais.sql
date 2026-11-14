-- Dados iniciais: os mesmos valores que estavam escritos no App.jsx (são exemplos).
-- Pode rodar mais de uma vez sem duplicar. Rode DEPOIS do migracao.sql.
-- Para trocar pelos dados reais, veja os comandos UPDATE explicados na conversa.

USE barbearia;

INSERT INTO barbearia_info (id, nome, telefone, whatsapp, endereco, campanha)
VALUES (1, 'Barbearia Navalha', '(81) 90000-0000', '5581900000000',
        'Rua Exemplo, 123 – Paulista, PE',
        'Campanha do mês: traga um amigo e ganhe 10% de desconto no próximo corte.')
ON DUPLICATE KEY UPDATE nome = VALUES(nome), telefone = VALUES(telefone),
  whatsapp = VALUES(whatsapp), endereco = VALUES(endereco), campanha = VALUES(campanha);

-- dia_semana: 0 = domingo ... 6 = sábado
INSERT INTO horarios_funcionamento (dia_semana, aberto, abre, fecha) VALUES
  (0, 0, NULL, NULL),
  (1, 1, '09:00', '19:00'),
  (2, 1, '09:00', '19:00'),
  (3, 1, '09:00', '19:00'),
  (4, 1, '09:00', '19:00'),
  (5, 1, '09:00', '19:00'),
  (6, 1, '08:00', '17:00')
ON DUPLICATE KEY UPDATE aberto = VALUES(aberto), abre = VALUES(abre), fecha = VALUES(fecha);

INSERT INTO barbeiros (nome) SELECT 'Rafael' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM barbeiros WHERE nome = 'Rafael');
INSERT INTO barbeiros (nome) SELECT 'Diego' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM barbeiros WHERE nome = 'Diego');

INSERT INTO servicos (nome, preco, duracao_min, combo, preco_original)
  SELECT 'Corte', 35, 30, 0, NULL FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE nome = 'Corte');
INSERT INTO servicos (nome, preco, duracao_min, combo, preco_original)
  SELECT 'Barba', 30, 30, 0, NULL FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE nome = 'Barba');
INSERT INTO servicos (nome, preco, duracao_min, combo, preco_original)
  SELECT 'Sobrancelha', 15, 30, 0, NULL FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE nome = 'Sobrancelha');
INSERT INTO servicos (nome, preco, duracao_min, combo, preco_original)
  SELECT 'Corte + Barba', 55, 60, 1, 65 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE nome = 'Corte + Barba');
INSERT INTO servicos (nome, preco, duracao_min, combo, preco_original)
  SELECT 'Corte + Sobrancelha', 45, 60, 1, 50 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE nome = 'Corte + Sobrancelha');

INSERT INTO planos_mensais (nome, descricao, preco_mensal, qtd_servicos, preco_original)
  SELECT 'Plano Corte', '4 cortes por mês', 99, 4, 140 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM planos_mensais WHERE nome = 'Plano Corte');
INSERT INTO planos_mensais (nome, descricao, preco_mensal, qtd_servicos, preco_original)
  SELECT 'Plano Corte + Barba', '4 combos por mês', 179, 4, 220 FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM planos_mensais WHERE nome = 'Plano Corte + Barba');
