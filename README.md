# Kominimo

**A live learning platform built for educational institutions.**

Kominimo provides the infrastructure for tutors and educational institutions to conduct live online classes, manage student participation, assess learning, and deliver structured courses.

The platform combines live video sessions, automated attendance tracking, interactive quizzes, and course publishing in one system.

Students can join a class using a shared link and their name and phone number or matriculation number. No student account is required.

Kominimo supports classes of up to **250 participants at no cost**.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | TanStack Start Server Functions, Nitro |
| Database | Neon PostgreSQL |
| Authentication | Neon Auth (Better Auth) |
| Object Storage | Neon Object Storage (S3-compatible) |
| Live Communication | Daily.co |
| Deployment | Vercel |

### Infrastructure and Security

- Database access is restricted to server-side operations.
- Application access uses managed authentication and server-side JWT verification.
- Database operations use a least-privilege role with Row Level Security (RLS).
- File storage uses private buckets and presigned URLs.
- Server-only modules are isolated from browser bundles.

---

## Getting Started

### Requirements

- Node.js
- npm
- A Neon project with PostgreSQL, Neon Auth, and Object Storage configured
- A Daily.co account

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd kominimo
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

Configure the required environment variables using the instructions in `docs/SETUP-NEON.md`.

Apply database migrations:

```bash
npm run db:migrate
```

Validate the environment configuration:

```bash
npm run check:env
```

Start the development server:

```bash
npm run dev
```

The application will be available at:

http://localhost:3000

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Generate a production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Run TypeScript checks |
| `npm run lint` | Run code linting |
| `npm run test` | Run the test suite |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:status` | Check migration status |
| `npm run storage:cors` | Configure browser upload permissions |
| `npm run check:env` | Validate environment configuration |
| `node scripts/smoke.mjs` | Run the production smoke test |

---

## Project Structure

```text
src/
├── config/             Application configuration
├── content/
│   └── legal/          Legal documents and policies
├── routes/             Application routes and pages
├── lib/                Server function interfaces
└── server/              Server-side services and infrastructure

db/
└── migrations/         Database schema and migrations

docs/                   Technical documentation

scripts/                Development and maintenance scripts
```

### Key Directories

| Directory | Responsibility |
|---|---|
| `src/config/` | Application settings, plans, pricing and legal versions |
| `src/content/legal/` | Terms of Use and Privacy Policy |
| `src/routes/` | Public pages, authentication, dashboards, classrooms, quizzes and administration |
| `src/lib/` | Server functions consumed by the application |
| `src/server/` | Database, authentication, storage and server-side services |
| `db/migrations/` | Version-controlled SQL schema, policies and database functions |
| `docs/` | Setup, architecture, security and operational documentation |

---

## Documentation

Technical documentation is maintained in the `docs/` directory.

| Document | Description |
|---|---|
| [Setup Guide](docs/SETUP-NEON.md) | Neon configuration, authentication, database roles, storage and Vercel deployment |
| [Architecture](docs/ARCHITECTURE.md) | Application architecture, request lifecycle and feature development |
| [Security](docs/SECURITY.md) | Security controls, implementation notes and deployment checklist |
| [Customization](docs/CUSTOMIZING.md) | Application branding, plans, pricing and legal configuration |
| [Administration](docs/ADMIN.md) | Administrative infrastructure and extension guidelines |
| [Product Roadmap](roadmap.md) | Development priorities and planned improvements |
| [Product Direction](docs/north-star.md) | Long-term product vision and direction |

---

## Configuration

Application-specific settings are managed through the configuration files in `src/config/`.

Before deployment, ensure the following environment variables are configured:

- `VITE_LEGAL_ENTITY`
- `VITE_LEGAL_ADDRESS`
- `VITE_CONTACT_EMAIL`

Refer to the setup and customization documentation for the complete environment configuration.

---

## Deployment

Kominimo is configured for deployment on Vercel using the Nitro Vercel preset.

Before deploying a new environment:

1. Configure the required environment variables.
2. Set up the Neon database and application roles.
3. Apply all database migrations.
4. Configure Neon Auth and Object Storage.
5. Verify storage CORS settings.
6. Run the environment validation checks.
7. Generate and verify the production build.

See [SETUP-NEON.md](docs/SETUP-NEON.md) for the complete deployment procedure.

---

## Legal

The Terms of Use and Privacy Policy are maintained within `src/content/legal/`.

These documents are initial templates and should undergo review by a qualified Nigerian legal practitioner before production use.

---

**Kominimo**  
*Live learning infrastructure for modern education.*

