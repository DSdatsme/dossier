# Interview Research Tool

A personal webapp for researching a company ahead of an interview and tracking what you learn round by round.

Given a company (name/domain), position, and location, it researches the company and builds a living report per company+position+location — company background, funding & notable news, culture, role specifics, tech stack, compensation, and red flags — plus a per-round breakdown (prep material, interviewer brief, smart questions to ask, your notes) that fills in as the real interview pipeline is discovered or as you mention new rounds in chat. After each round, tell it what you learned and it folds the relevant facts back into the report, tagged by source, so nothing is silently overwritten.

Runs locally for now; Vercel-hosted later.

Status: foundation implemented — a working app renders the full Overview + Rounds report from seeded sample data. Chat-driven fact creation, the research engine, and corrections/editing are not built yet.

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

Run `npm test` for the automated test suite.
