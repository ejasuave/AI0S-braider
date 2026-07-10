export * from './env/index.js';

export type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export type DbHealthResponse = {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  latencyMs?: number;
  error?: string;
};
