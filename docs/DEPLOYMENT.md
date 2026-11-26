# Deploying attendflow

## Run locally (Windows PowerShell)

```powershell
cd "D:\ai project\attendflow"
npm install
npm run db:push     # creates the local SQLite database (prisma/dev.db)
npm run dev         # open http://localhost:3000
```

Run the tests (they use a separate database, prisma/test.db):

```powershell
npm test
```

## Environment variables (.env)

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `file:./dev.db` locally; a PostgreSQL URL in production |
| `SESSION_SECRET` | yes | 32+ random characters. Signs login cookies. **Never share or commit it.** |
| `APP_TIMEZONE` | yes | School's IANA timezone, e.g. `Asia/Karachi` |

Generate a new secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Production checklist (Phase 2 — not yet done)

1. **Database**: create a managed PostgreSQL database (e.g. Neon, Supabase or Railway). In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`, set `DATABASE_URL`, then run `npx prisma migrate deploy`.
2. **Hosting**: deploy to Vercel or similar. Set the three environment variables in the host's dashboard.
3. **HTTPS**: enabled by the host. Cookies are `secure` in production.
4. **Login rate limiting**: add before public launch.
5. **Password reset by email**: needs an email provider (e.g. Resend).
6. **Backups**: enable automatic daily backups on the database.
7. **Monitoring**: add error tracking (e.g. Sentry).
8. **Privacy notice**: publish before collecting student data.
