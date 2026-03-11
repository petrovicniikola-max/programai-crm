# Backend (Nest + Prisma) – produkcija
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

# Prisma client + build (DATABASE_URL za generate može biti dummy ako ne radi migrate ovde)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
RUN npm run build

# Runtime
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/src/main"]
