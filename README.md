# Leads Frontend

Frontend mobile-first do mini-CRM de leads (React + Vite + TypeScript).

## Requisitos
- Node.js 20+
- Backend online com domínio público (Railway)

## Configuração
1. Instale dependências:
```bash
npm install
```
2. Crie o `.env`:
```bash
cp .env.example .env
```
3. Defina a URL da API:
```env
VITE_API_BASE_URL=https://SEU-BACKEND.up.railway.app
```

## Rodar local
```bash
npm run dev
```

## Build de produção
```bash
npm run build
npm run preview
```

## Fluxo de autenticação
- Login em `/auth/login`.
- Access/refresh token salvos em `localStorage`.
- Quando uma request autenticada recebe `401`, o frontend tenta `/auth/refresh`.
- Se refresh falhar, sessão é limpa e o usuário precisa logar de novo.

## Telas
- Login
- Lista de leads com:
  - busca por nome/email/telefone
  - filtro por status
  - botão WhatsApp (gera mensagem em `/leads/:id/generate-message` e abre `wa.me`)
  - atualização rápida de status
- Detalhe do lead com:
  - dados completos
  - histórico de status (`GET /leads/:id/history`)
  - histórico de contatos (`GET /leads/:id/history`)

## Observação de deploy Railway (backend)
No service `leads-backend`, configure `Start Command` como:
```bash
npx prisma migrate deploy && npm run start
```
Isso garante aplicação das migrations antes de iniciar o servidor.
