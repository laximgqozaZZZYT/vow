# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install dependencies (incl. dev) for build
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client + compile TS
RUN npm run prisma:generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma client runtime bits
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# App build output
COPY --from=build /app/dist ./dist

EXPOSE 4000

# The app decides baseUrl via PUBLIC_BASE_URL or x-forwarded-* headers.
CMD ["node", "dist/index.js"]
