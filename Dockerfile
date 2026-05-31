FROM node:20-alpine

WORKDIR /app

# Copia apenas arquivos de definição primeiro para aproveitar cache
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY package-lock.json ./

RUN npm ci

# Copia o restante do projeto
COPY . ./

# Build do frontend antes de iniciar
RUN npm run build --workspace frontend

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "backend"]
