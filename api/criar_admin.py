"""Cria o usuário administrador da barbearia. Use:  python criar_admin.py"""
import getpass
import os

import pymysql
from werkzeug.security import generate_password_hash

nome = input("Nome do administrador: ").strip()
email = input("E-mail: ").strip().lower()
senha = getpass.getpass("Senha: ")

if not (nome and email and senha):
    raise SystemExit("Preencha nome, e-mail e senha.")

conn = pymysql.connect(
    host=os.environ.get("DB_HOST", "localhost"),
    user=os.environ.get("DB_USUARIO", "barbearia_app"),
    password=os.environ.get("DB_SENHA", "troque_esta_senha"),
    database="barbearia",
    autocommit=True,
)
try:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (%s,%s,%s,'admin')",
            (nome, email, generate_password_hash(senha)),
        )
    print("Administrador criado.")
except pymysql.err.IntegrityError:
    print("Já existe um usuário com esse e-mail.")
finally:
    conn.close()
