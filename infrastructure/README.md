# Local infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Services:
- Postgres: `postgresql://braids:braids@localhost:5432/braids_dev`
- Redis: `redis://localhost:6379`
