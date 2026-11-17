import os
from datetime import date, datetime
from decimal import Decimal
from functools import wraps

import pymysql
from flask import Flask, g, jsonify, request, session
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash


def _default(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    return DefaultJSONProvider.default(o)


class MeuJSON(DefaultJSONProvider):
    default = staticmethod(_default)


app = Flask(__name__)
app.json = MeuJSON(app)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "troque-esta-chave-em-producao")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
# o React (Vite) roda em localhost:5173; use sempre "localhost", não 127.0.0.1
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])


# ---------- Banco de dados (MariaDB) ----------
def db():
    if "db" not in g:
        g.db = pymysql.connect(
            host=os.environ.get("DB_HOST", "localhost"),
            user=os.environ.get("DB_USUARIO", "barbearia_app"),
            password=os.environ.get("DB_SENHA", "troque_esta_senha"),
            database="barbearia",
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
        )
    return g.db


@app.teardown_appcontext
def fecha_db(_exc):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def consulta(sql, params=(), um=False):
    with db().cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone() if um else cur.fetchall()


def executa(sql, params=()):
    with db().cursor() as cur:
        cur.execute(sql, params)
        return cur.lastrowid


# ---------- Login ----------
def login_obrigatorio(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if "uid" not in session:
            return jsonify(erro="Faça login."), 401
        g.user = consulta("SELECT id, nome, email, perfil FROM usuarios WHERE id = %s",
                          (session["uid"],), um=True)
        if g.user is None:
            session.clear()
            return jsonify(erro="Faça login."), 401
        return f(*a, **kw)
    return wrapper


def admin_obrigatorio(f):
    @wraps(f)
    @login_obrigatorio
    def wrapper(*a, **kw):
        if g.user["perfil"] != "admin":
            return jsonify(erro="Apenas o administrador pode fazer isso."), 403
        return f(*a, **kw)
    return wrapper


@app.post("/api/login")
def login():
    d = request.get_json(silent=True) or {}
    u = consulta("SELECT * FROM usuarios WHERE email = %s",
                 (d.get("email", "").strip().lower(),), um=True)
    if not u or not check_password_hash(u["senha_hash"], d.get("senha", "")):
        return jsonify(erro="E-mail ou senha incorretos."), 401
    session.clear()
    session["uid"] = u["id"]
    return jsonify(id=u["id"], nome=u["nome"], email=u["email"], perfil=u["perfil"])


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
@login_obrigatorio
def me():
    return jsonify(g.user)


@app.post("/api/registrar")
def registrar():
    """Cliente cria a própria conta (perfil 'cliente')."""
    d = request.get_json(silent=True) or {}
    nome = d.get("nome", "").strip()
    email = d.get("email", "").strip().lower()
    senha = d.get("senha", "")
    if not (nome and email and senha):
        return jsonify(erro="Preencha nome, e-mail e senha."), 400
    conn = db()
    conn.begin()
    try:
        uid = executa("INSERT INTO usuarios (nome, email, senha_hash) VALUES (%s,%s,%s)",
                      (nome, email, generate_password_hash(senha)))
        executa("INSERT INTO clientes (usuario_id, nome, telefone, whatsapp, email) "
                "VALUES (%s,%s,%s,%s,%s)",
                (uid, nome, d.get("telefone"), d.get("whatsapp"), email))
        conn.commit()
    except pymysql.err.IntegrityError:
        conn.rollback()
        return jsonify(erro="E-mail já cadastrado."), 409
    return jsonify(ok=True), 201


# ---------- Serviços, promoções e planos (leitura pública, escrita só admin) ----------
RECURSOS = {
    "servicos": ("servicos", ["nome", "preco", "duracao_min", "ativo", "combo", "preco_original"]),
    "promocoes": ("promocoes", ["titulo", "descricao", "tipo", "preco_promocional",
                                "desconto_percentual", "inicio", "fim", "ativo"]),
    "planos": ("planos_mensais", ["nome", "descricao", "preco_mensal", "qtd_servicos",
                                  "ativo", "preco_original"]),
    "barbeiros": ("barbeiros", ["nome", "ativo"]),
}
ROTA = "/api/<any(servicos,promocoes,planos,barbeiros):recurso>"


def _campos(recurso, dados):
    return {c: dados[c] for c in RECURSOS[recurso][1] if c in dados}


@app.get(ROTA)
def listar(recurso):
    tabela = RECURSOS[recurso][0]
    return jsonify(consulta(f"SELECT * FROM {tabela} ORDER BY id"))


@app.post(ROTA)
@admin_obrigatorio
def criar(recurso):
    tabela = RECURSOS[recurso][0]
    campos = _campos(recurso, request.get_json(silent=True) or {})
    if not campos:
        return jsonify(erro="Nenhum dado enviado."), 400
    colunas = ", ".join(campos)
    marcas = ", ".join(["%s"] * len(campos))
    try:
        novo = executa(f"INSERT INTO {tabela} ({colunas}) VALUES ({marcas})", list(campos.values()))
    except pymysql.MySQLError:
        return jsonify(erro="Dados inválidos."), 400
    return jsonify(id=novo), 201


@app.put(ROTA + "/<int:rid>")
@admin_obrigatorio
def atualizar(recurso, rid):
    tabela = RECURSOS[recurso][0]
    campos = _campos(recurso, request.get_json(silent=True) or {})
    if not campos:
        return jsonify(erro="Nenhum dado enviado."), 400
    sets = ", ".join(f"{c} = %s" for c in campos)
    try:
        executa(f"UPDATE {tabela} SET {sets} WHERE id = %s", list(campos.values()) + [rid])
    except pymysql.MySQLError:
        return jsonify(erro="Dados inválidos."), 400
    return jsonify(ok=True)


@app.delete(ROTA + "/<int:rid>")
@admin_obrigatorio
def apagar(recurso, rid):
    tabela = RECURSOS[recurso][0]
    try:
        executa(f"DELETE FROM {tabela} WHERE id = %s", (rid,))
    except pymysql.err.IntegrityError:
        return jsonify(erro="Item em uso. Desative-o em vez de apagar."), 409
    return jsonify(ok=True)


# ---------- Clientes (só admin) ----------
@app.get("/api/clientes")
@admin_obrigatorio
def clientes_listar():
    return jsonify(consulta("SELECT * FROM clientes ORDER BY nome"))


@app.post("/api/clientes")
@admin_obrigatorio
def clientes_criar():
    d = request.get_json(silent=True) or {}
    if not d.get("nome", "").strip():
        return jsonify(erro="Informe o nome."), 400
    novo = executa("INSERT INTO clientes (nome, telefone, whatsapp, email) VALUES (%s,%s,%s,%s)",
                   (d["nome"].strip(), d.get("telefone"), d.get("whatsapp"), d.get("email")))
    return jsonify(id=novo), 201


@app.put("/api/clientes/<int:cid>")
@admin_obrigatorio
def clientes_atualizar(cid):
    d = request.get_json(silent=True) or {}
    if not (d.get("nome") or "").strip():
        return jsonify(erro="Informe o nome."), 400
    executa("UPDATE clientes SET nome = %s, telefone = %s, whatsapp = %s, email = %s WHERE id = %s",
            (d.get("nome"), d.get("telefone"), d.get("whatsapp"), d.get("email"), cid))
    return jsonify(ok=True)


# ---------- Agendamentos ----------
SQL_AGENDAMENTOS = """
    SELECT a.id, a.data_hora, a.status,
           c.id AS cliente_id, c.nome AS cliente, c.telefone,
           s.id AS servico_id, s.nome AS servico, s.preco, s.duracao_min,
           b.id AS barbeiro_id, b.nome AS barbeiro
    FROM agendamentos a
    JOIN clientes c ON c.id = a.cliente_id
    JOIN servicos s ON s.id = a.servico_id
    LEFT JOIN barbeiros b ON b.id = a.barbeiro_id"""


@app.get("/api/agendamentos")
@login_obrigatorio
def agendamentos_listar():
    if g.user["perfil"] == "admin":
        return jsonify(consulta(SQL_AGENDAMENTOS + " ORDER BY a.data_hora DESC"))
    return jsonify(consulta(SQL_AGENDAMENTOS + " WHERE c.usuario_id = %s ORDER BY a.data_hora DESC",
                            (g.user["id"],)))


@app.post("/api/agendamentos")
@login_obrigatorio
def agendamentos_criar():
    d = request.get_json(silent=True) or {}
    servico_id = d.get("servico_id")
    data_hora = (d.get("data_hora") or "").replace("T", " ")   # "YYYY-MM-DDTHH:MM"
    if g.user["perfil"] == "admin":
        cliente_id = d.get("cliente_id")
    else:
        c = consulta("SELECT id FROM clientes WHERE usuario_id = %s", (g.user["id"],), um=True)
        cliente_id = c["id"] if c else None
    barbeiro_id = d.get("barbeiro_id")
    if not (servico_id and data_hora and cliente_id):
        return jsonify(erro="Informe serviço, data/hora e cliente."), 400
    try:
        inicio = datetime.strptime(data_hora[:16], "%Y-%m-%d %H:%M")
    except ValueError:
        return jsonify(erro="Data/hora inválida."), 400
    if inicio < datetime.now():
        return jsonify(erro="Não é possível agendar no passado."), 400
    serv = consulta("SELECT duracao_min FROM servicos WHERE id = %s AND ativo = 1",
                    (servico_id,), um=True)
    if not serv:
        return jsonify(erro="Serviço não encontrado."), 400
    if barbeiro_id is not None and not consulta(
            "SELECT 1 FROM barbeiros WHERE id = %s AND ativo = 1", (barbeiro_id,), um=True):
        return jsonify(erro="Barbeiro não encontrado."), 400

    # precisa estar dentro do horário de funcionamento (dia_semana: 0 = domingo)
    h = consulta("SELECT aberto, abre, fecha FROM horarios_funcionamento WHERE dia_semana = %s",
                 ((inicio.weekday() + 1) % 7,), um=True)
    ini_min = inicio.hour * 60 + inicio.minute
    if not h or not h["aberto"] or h["abre"] is None or h["fecha"] is None:
        return jsonify(erro="A barbearia não abre nesse dia."), 400
    if ini_min < _minutos(h["abre"]) or ini_min + serv["duracao_min"] > _minutos(h["fecha"]):
        return jsonify(erro="Fora do horário de funcionamento."), 400

    # trava para que dois pedidos ao mesmo tempo não peguem o mesmo horário
    if not consulta("SELECT GET_LOCK('barbearia_agenda', 10) AS ok", um=True)["ok"]:
        return jsonify(erro="Sistema ocupado, tente de novo."), 503
    try:
        # impede sobreposição de horários do mesmo barbeiro (considera a duração dos serviços)
        conflito = consulta(
            """SELECT 1 FROM agendamentos a JOIN servicos s ON s.id = a.servico_id
               WHERE a.status = 'agendado' AND a.barbeiro_id <=> %s
                 AND a.data_hora < DATE_ADD(%s, INTERVAL %s MINUTE)
                 AND DATE_ADD(a.data_hora, INTERVAL s.duracao_min MINUTE) > %s""",
            (barbeiro_id, inicio, serv["duracao_min"], inicio), um=True)
        if conflito:
            return jsonify(erro="Horário já ocupado para este barbeiro."), 409
        try:
            novo = executa("INSERT INTO agendamentos (cliente_id, servico_id, barbeiro_id, data_hora) "
                           "VALUES (%s,%s,%s,%s)", (cliente_id, servico_id, barbeiro_id, inicio))
        except pymysql.MySQLError:
            return jsonify(erro="Dados inválidos."), 400
    finally:
        consulta("SELECT RELEASE_LOCK('barbearia_agenda')")
    return jsonify(id=novo), 201


def _minutos(t):
    """TIME do MariaDB chega como timedelta."""
    return int(t.total_seconds() // 60)


@app.patch("/api/agendamentos/<int:aid>")
@login_obrigatorio
def agendamentos_status(aid):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in ("agendado", "concluido", "cancelado"):
        return jsonify(erro="Status inválido."), 400
    if g.user["perfil"] != "admin":
        dono = consulta("""SELECT 1 FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id
                           WHERE a.id = %s AND c.usuario_id = %s""", (aid, g.user["id"]), um=True)
        if not dono or status != "cancelado":
            return jsonify(erro="Você só pode cancelar os seus agendamentos."), 403
    executa("UPDATE agendamentos SET status = %s WHERE id = %s", (status, aid))
    return jsonify(ok=True)


# ---------- Dados da barbearia e horários de funcionamento ----------
@app.get("/api/info")
def info_ler():
    return jsonify(consulta("SELECT * FROM barbearia_info WHERE id = 1", um=True) or {})


@app.put("/api/info")
@admin_obrigatorio
def info_salvar():
    d = request.get_json(silent=True) or {}
    campos = {c: d[c] for c in ("nome", "telefone", "whatsapp", "endereco", "logo_url", "campanha")
              if c in d}
    if not campos:
        return jsonify(erro="Nenhum dado enviado."), 400
    colunas = ", ".join(["id"] + list(campos))
    marcas = ", ".join(["1"] + ["%s"] * len(campos))
    sets = ", ".join(f"{c} = VALUES({c})" for c in campos)
    executa(f"INSERT INTO barbearia_info ({colunas}) VALUES ({marcas}) "
            f"ON DUPLICATE KEY UPDATE {sets}", list(campos.values()))
    return jsonify(ok=True)


@app.get("/api/horarios")
def horarios_ler():
    return jsonify(consulta(
        "SELECT dia_semana, aberto, TIME_FORMAT(abre, '%%H:%%i') AS abre, "
        "TIME_FORMAT(fecha, '%%H:%%i') AS fecha FROM horarios_funcionamento ORDER BY dia_semana"))


@app.put("/api/horarios")
@admin_obrigatorio
def horarios_salvar():
    """Recebe uma lista: [{dia_semana: 0-6, aberto: 1, abre: "09:00", fecha: "19:00"}, ...]"""
    lista = request.get_json(silent=True)
    if not isinstance(lista, list):
        return jsonify(erro="Envie uma lista de horários."), 400
    for h in lista:
        if not isinstance(h, dict) or h.get("dia_semana") not in range(7):
            return jsonify(erro="Dia da semana inválido."), 400
        if h.get("aberto", 1):
            try:
                abre = datetime.strptime(h.get("abre") or "", "%H:%M")
                fecha = datetime.strptime(h.get("fecha") or "", "%H:%M")
            except ValueError:
                return jsonify(erro="Horário inválido (use HH:MM)."), 400
            if fecha <= abre:
                return jsonify(erro="O fechamento precisa ser depois da abertura."), 400
    for h in lista:
        executa("""INSERT INTO horarios_funcionamento (dia_semana, aberto, abre, fecha)
                   VALUES (%s,%s,%s,%s)
                   ON DUPLICATE KEY UPDATE aberto = VALUES(aberto), abre = VALUES(abre),
                       fecha = VALUES(fecha)""",
                (h["dia_semana"], h.get("aberto", 1), h.get("abre"), h.get("fecha")))
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(port=5001, debug=True)
