module.exports = {
  schema: 'prisma/schema.prisma',
  datasources: {
    db: {
      url: process.env.DATABASE_URL || '',
    },
  },
};
