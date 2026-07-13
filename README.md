<div align="center">
  <img src="./src/app/icon.svg" alt="Dossier Logo" width="120" />
  <h1>Dossier</h1>
  <p><em>Your personal, AI-powered interview research and prep tracker.</em></p>
</div>

---

**Dossier** is a personal web application designed to help you research companies and track your interview pipeline. Given a company name, position, and location, it autonomously researches the company and builds a **living report**. 

As your interview progresses, you can chat with the Dossier assistant to log new rounds, take notes, and automatically fold new facts back into the report without losing your source data.

## ✨ Features

- 🕵️ **Autonomous Research Engine**: Automatically compiles company background, funding news, tech stack, compensation, and culture by shelling out to the Anthropic `claude` CLI.
- 💬 **Interactive Chat**: Tell the assistant how your phone screen went, who you talked to, or what you learned. It parses your updates and seamlessly refines the live report.
- 📝 **Living Reports**: Tracks your pipeline round-by-round. Organizes prep materials, interviewer profiles, smart questions to ask, and personal notes.
- 🔒 **Local & Private**: All data is stored in a local SQLite database (`dev.db` or `local.db`).

## 🚀 Getting Started

### Local Setup (Node)

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

> **Note**: The default script uses a disposable `dev.db`. For real, ongoing usage, you can use the persistent script:
> ```bash
> npm run local:db:push
> npm run local
> ```

### Running with Docker

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000). The SQLite database persists securely in a named Docker volume (`dossier-data`). 
*Note: The `claude` CLI-driven background research is currently not available inside the Docker container.*

## 🧪 Testing

Dossier includes a comprehensive Vitest unit and integration test suite. Tests run against an isolated `test.db` to protect your local data.

```bash
npm run pretest
npm test
```

## ⚙️ Requirements
- Node.js v18+ & npm
- A logged-in [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) CLI session (`claude login`) on the host machine for the autonomous research engine to function.
