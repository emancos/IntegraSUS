# Stage 1: Builder
FROM node:24-alpine AS builder

WORKDIR /app

# Instalar dependências para build
COPY package*.json ./
RUN npm ci

# Copiar código-fonte e compilar
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:24-alpine

WORKDIR /app

# Instalar bibliotecas de compatibilidade nativa para o 7zip-bin e outras libs
RUN apk add --no-cache libc6-compat

# Copiar os arquivos de manifesto e instalar apenas as dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar o build da etapa anterior
COPY --from=builder /app/dist ./dist

# Copiar scripts avulsos (.cjs)
COPY --from=builder /app/*.cjs ./

# Garantir permissões para a aplicação baixar e extrair arquivos (CNES/SIA)
RUN chown -R node:node /app
RUN chmod +x /app/node_modules/7zip-bin/linux/arm64/7za
USER node

# Definir as variáveis de ambiente padrões
ENV NODE_ENV=production
ENV PORT=4000

# Expor a porta definida via variável
EXPOSE ${PORT}

CMD ["node", "dist/main.js"]
