# Barbearia Navalha – Painel

Protótipo em React + Vite (agendamento, clientes, promoções, planos).

## Como rodar

Precisa do Node.js 18 ou mais novo (nodejs.org).

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente http://localhost:5173).

## Versão de produção

```bash
npm run build
npm run preview
```

## Onde mudar os dados da barbearia

Em `src/App.jsx`, no começo do arquivo: `SHOP` (nome, telefone, WhatsApp, endereço),
`SERV` (serviços e combos), `PLANOS`, `BARB` (barbeiros) e `HRS` (horários).

Os dados de agendamentos e clientes ficam no localStorage do navegador.
