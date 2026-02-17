export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/wallethub',
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    priorityRpcUrl: process.env.SOLANA_PRIORITY_RPC_URL,
  },
  helius: {
    apiKey: process.env.HELIUS_API_KEY,
  },
  session: {
    enabled: (process.env.SESSION_KEYS_ENABLED ?? '').toLowerCase() === 'true',
  },
});
