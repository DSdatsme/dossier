# Dossier

A personal webapp for researching a company ahead of an interview and tracking what you learn round by round.

Given a company (name/domain), position, and location, it researches the company and builds a living report per company+position+location — company background, funding & notable news, culture, role specifics, tech stack, compensation, and red flags — plus a per-round breakdown (prep material, interviewer brief, smart questions to ask, your notes) that fills in as the real interview pipeline is discovered or as you mention new rounds in chat. After each round, tell it what you learned and it folds the relevant facts back into the report, tagged by source, so nothing is silently overwritten.

Runs locally for now (via Docker Compose or directly with Node); a hosted deployment is future work.

Status: the Overview + Rounds report, the autonomous research engine, and chat are built — creating a thread automatically researches the company in the background via the `claude` CLI, and telling the assistant what happened in chat (a round, an interviewer, a correction) updates the report live.

The seeded sample data (Nimbus Robotics, Acme Corp, Foo Inc) is entirely fictional, for demo purposes only.

## Setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

This uses `prisma/dev.db` — treat it as disposable, for poking around and
trying things. For real, ongoing use, run against a separate persistent
database instead:

```bash
npm run local:db:push
npm run local:db:seed   # optional — skip to start with an empty report list
npm run local
```

This uses `prisma/local.db`, which nothing else (tests, the default `dev`
script, ad-hoc scripts) ever touches.

Run `npm test` for the automated test suite. Tests run against a third,
isolated `prisma/test.db`, pushed and reseeded fresh on every run — neither
`dev.db` nor `local.db` is ever touched by a test run.

The autonomous research engine shells out to the `claude` CLI, so it needs a logged-in Claude Code session (`claude login`) on whatever machine runs the app.

## Running with Docker Compose

```bash
docker compose up --build
```

Then open `http://localhost:3000`. The SQLite database persists in a named Docker volume (`dossier-data`) across restarts; on first run it's created and seeded automatically. `claude` CLI-driven research isn't available inside the container — the base image doesn't include or authenticate the CLI.
