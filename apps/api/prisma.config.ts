import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Allow generation without a real database; Render build may omit DATABASE_URL
    url: env('DATABASE_URL', 'postgresql://local/local'),
  },
});
