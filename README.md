# 🎭 Parable Service (Cloudflare)

A cost-optimized **Cloudflare Workers** alternative to the [parable-service](https://github.com/vishal-reddy/parable-service) — rewritten in TypeScript with full API parity.

## Architecture

| Component | Technology |
|-----------|-----------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Framework | [Hono](https://hono.dev) |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at edge) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| Auth | [Kinde](https://kinde.com) OAuth 2.0 + JWT |
| Validation | [Zod](https://zod.dev) |
| Styling | TailwindCSS + Alpine.js + HTMX |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` |

## Cost Comparison

| | DigitalOcean (Original) | Cloudflare (This) |
|---|---|---|
| Compute | ~$5/mo | **Free** (100K req/day) |
| Database | ~$15/mo | **Free** (D1: 5M reads/day) |
| **Total** | **~$20/mo** | **$0/mo** |

## Features

- **Stories API** — Full CRUD with nested acts, beats, characters, locations
- **Puritan Library** — FTS5 full-text search across digitized theological works
- **Assessments** — AI session grading with prompt engineering & ethics scores
- **MCP Protocol** — Model Context Protocol for Claude Code integration
- **Weather** — Weather.gov proxy with D1 caching
- **Auth** — Kinde OAuth + Bearer JWT + API key authentication

## Getting Started

```bash
# Install dependencies
npm install

# Create local D1 database and run migrations
npm run db:migrate:local

# Start dev server (http://localhost:8787)
npm run dev
```

## Development

```bash
npm run dev           # Start Workers dev server
npm run test          # Run tests
npm run test:watch    # Watch mode
npm run typecheck     # TypeScript check
npm run css:build     # Build Tailwind CSS
npm run css:watch     # Watch CSS changes
npm run precommit     # All checks
```

## Database

```bash
npm run db:generate       # Generate migrations from schema
npm run db:migrate:local  # Apply migrations locally
npm run db:migrate:remote # Apply migrations to production D1
npm run db:studio         # Open Drizzle Studio
```

## Deployment

1. Set up Cloudflare account and create D1 database:
   ```bash
   npx wrangler d1 create parable-db
   ```
2. Update `database_id` in `wrangler.toml`
3. Set secrets:
   ```bash
   npx wrangler secret put KINDE_DOMAIN
   npx wrangler secret put KINDE_CLIENT_ID
   npx wrangler secret put KINDE_CLIENT_SECRET
   npx wrangler secret put KINDE_REDIRECT_URI
   npx wrangler secret put KINDE_LOGOUT_REDIRECT_URI
   npx wrangler secret put KINDE_AUDIENCE
   npx wrangler secret put SESSION_SECRET
   ```
4. Deploy:
   ```bash
   npm run db:migrate:remote
   npm run deploy
   ```

## API Reference

### Public Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Home page |
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness probe (DB check) |
| `GET` | `/login` | Kinde OAuth login |
| `GET` | `/signup` | Kinde OAuth signup |
| `GET` | `/logout` | Logout |
| `GET` | `/kinde/callback` | OAuth callback |

### Stories API
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stories` | List stories (paginated) |
| `POST` | `/api/stories` | Create story |
| `GET` | `/api/stories/samples` | Get sample stories |
| `GET` | `/api/stories/:id` | Get story with details |
| `PUT` | `/api/stories/:id` | Update story |
| `DELETE` | `/api/stories/:id` | Delete story |

### Puritan Library API *(Auth required)*
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/puritan/tokens` | List search tokens |
| `POST` | `/api/puritan/search` | Search works by token/FTS5 |
| `GET` | `/api/puritan/works/:id` | Get work content |
| `GET` | `/api/puritan/authors` | List authors |
| `GET` | `/api/puritan/authors/:id/works` | Works by author |

### Assessments API
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/assessments` | API Key | Submit assessment |
| `POST` | `/api/assessments/batch` | API Key | Batch submit |
| `GET` | `/api/assessments` | Kinde | List assessments |
| `GET` | `/api/assessments/:id` | Kinde | Get assessment details |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/weather/forecast` | Weather forecast |
| `POST` | `/mcp` | MCP protocol endpoint |

## License

ISC
