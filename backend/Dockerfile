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

# Kompajliraj seed u JS da u runtime imageu ne treba ts-node
RUN npx tsc prisma/seed.ts --outDir prisma --module commonjs --target ES2020 --esModuleInterop --skipLibCheck --resolveJsonModule --moduleResolution node

# Runtime
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3001

# Seed pa start. (migrate deploy izostavljen kad je baza već usklađena sa db push; za nove migracije pokrenuti ručno.)
CMD ["sh", "-c", "node prisma/seed.js && node dist/src/main"]
