# System module

Platform infrastructure endpoints (ping, example jobs).

- `GET /api/v1/ping` — registered in `routes/v1.ts`
- `POST /api/v1/system/example-job` — enqueue demonstration job
- `GET /api/v1/system/example-job/:jobId` — poll job status
