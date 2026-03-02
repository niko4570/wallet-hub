FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile and package manifests for deterministic install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

# Install all deps for build but skip lifecycle scripts (postinstall runs before source copy)
# This prevents the root `postinstall` from running too early (which expects source files).
RUN pnpm install --frozen-lockfile --ignore-scripts --filter api... --filter @wallethub/contracts...

# Copy source
COPY . .

# After copying source, run a full install so workspace bins (e.g. `nest`) are available
# We previously skipped lifecycle scripts to avoid running postinstall too early;
# now that source exists, run a normal install to create executables and run prepare scripts.
RUN pnpm install --frozen-lockfile --filter api... --filter @wallethub/contracts... \
    && DATABASE_URL="postgresql://user:password@localhost:5432/db" pnpm --filter api exec prisma generate --schema=prisma/schema.prisma \
    && pnpm run build:contracts \
    && pnpm run build:api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/node_modules ./node_modules

# Copy package manifests
COPY package.json ./
COPY apps/api/package.json apps/api/

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
