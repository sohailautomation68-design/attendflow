# attendflow

Fast, reliable attendance for academies. Teachers mark attendance on their phones in seconds; each academy's data is fully separated from every other academy.

- **Plan & architecture:** [docs/PLANNING.md](docs/PLANNING.md)
- **Deploying:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Quick start

```powershell
npm install
npm run db:push
npm run dev
```

Open http://localhost:3000, click **Create an account** (this creates your academy and you become its administrator), then add teachers, classes and students.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build |
| `npm test` | Run security (tenant isolation) tests |
| `npm run db:push` | Create/update the database from the schema |
| `npm run db:studio` | Open a visual database browser |
