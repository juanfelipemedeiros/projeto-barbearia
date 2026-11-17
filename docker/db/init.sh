#!/bin/bash
# Roda só na primeira vez que o volume do banco é criado.
# O usuário barbearia_app já é criado pelo próprio container (MARIADB_USER),
# então as linhas CREATE USER / GRANT dos scripts são ignoradas aqui.
set -e
for f in barbearia.sql migracao.sql dados_iniciais.sql; do
  echo "Rodando $f"
  grep -vE '^\s*(CREATE USER|GRANT|FLUSH PRIVILEGES)' "/sql/$f" \
    | mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"
done
