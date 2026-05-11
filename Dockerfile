FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3001
ENV OLLAMA_URL=http://127.0.0.1:11434

WORKDIR /app

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server

EXPOSE 3001

CMD ["node", "server/index.js"]
