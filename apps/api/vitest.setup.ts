process.env.DATABASE_URL ??= 'postgresql://braids:braids@localhost:5432/braids_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
