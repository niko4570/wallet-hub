FROM node:20-alpine AS builder
WORKDIR /app

# Install workspace dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

# Build shared contracts + API
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build:contracts && npm run build:api
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and compiled artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/api/dist/main.js"]
