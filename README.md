# UltraBarber CRM

Sistema simples de CRM de prospecção para vender o SaaS UltraBarber a barbearias.

## Funcionalidades

- Cadastro de leads com dados de contato e status.
- Filtro de leads por status.
- Geração de mensagem inicial personalizada com IA.
- Envio manual de WhatsApp via Evolution API com limite diário.
- Histórico de mensagens por lead.
- Sugestão de follow-up após 2 dias sem resposta.
- Dashboard com métricas de prospecção.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: MySQL
- Integração: Evolution API

## Como usar

1. Crie o banco de dados MySQL `ultrabarber_crm`.
2. Execute `npm run install:all` na raiz.
3. Copie `backend/.env.example` para `backend/.env` e ajuste as variáveis.
4. Execute o script SQL em `backend/sql/schema.sql` para criar as tabelas no MySQL.
5. Inicie o projeto:
   - `npm run dev` para frontend e backend em paralelo.
   - `npm run server` para backend isolado.
   - `npm run client` para frontend isolado.

## Deploy no Railway

- Configure uma instância MySQL no Railway.
- Defina as variáveis de ambiente em Railway com os valores de `backend/.env`.
- O Railway usa `npm start` na raiz, que agora faz o build do frontend e inicia o backend.
- Configure o comando de inicialização para `npm start`, se necessário.
- O backend serve o frontend estático de `frontend/dist` em produção.

## Observações

- O envio de mensagens é manual e controlado.
- O limite diário de envios impede disparos em massa.
- Cada mensagem deve ser revisada antes de enviar.
