# UltraBarber CRM

Sistema simples de CRM de prospecção para vender o SaaS UltraBarber a barbearias.

## Funcionalidades

- Cadastro de leads com dados de contato e status.
- Filtro de leads por status.
- Geração de mensagem inicial personalizada com IA.
- Busca de novos leads no Google Maps/Perfil da Empresa com priorização por IA.
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

## Instalação com Docker Compose

1. Certifique-se de ter o Docker instalado.
2. Execute `docker compose up --build -d` na raiz do projeto.
3. O serviço MySQL será provisionado automaticamente e o backend tentará criar o banco e aplicar as tabelas ao conectar.
4. Acesse o backend em `http://localhost:4000`.

Você também pode usar os scripts de instalação:

- `./install.sh` (Linux/macOS)
- `.\install.ps1` (Windows PowerShell)

## Deploy no Railway

- Crie um serviço MySQL no projeto Railway.
- Crie um serviço web apontando para este repositório ou envie com `railway up`.
- Configure no serviço web as variáveis:
  - `MYSQL_URL=${{MySQL.MYSQL_URL}}`
  - `EVOLUTION_API_KEY`
  - `EVOLUTION_INSTANCE_ID`
  - `OPENAI_API_KEY`
  - `GOOGLE_MAPS_API_KEY`
  - `DAILY_SEND_LIMIT=10`
- O `Dockerfile` faz o build do frontend durante a imagem e inicia apenas o backend em produção.
- O `railway.json` define o start command `npm run start --workspace backend` e healthcheck em `/api/health`.
- O backend aplica automaticamente `backend/sql/schema.sql` no database informado por `MYSQL_URL`.
- O backend serve o frontend estático de `frontend/dist` em produção.
- A busca de novos leads usa Google Places Text Search, com foco em resultados do Google Maps/Perfil da Empresa. Configure `GOOGLE_MAPS_API_KEY`; `OPENAI_API_KEY` ranqueia e explica os candidatos.

## Observações

- O envio de mensagens é manual e controlado.
- O limite diário de envios impede disparos em massa.
- Cada mensagem deve ser revisada antes de enviar.
