# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm start         # Run production server
npm run lint      # Run ESLint
```

No test suite is configured. There is no `npm test` script.

### Firebase Cloud Functions (separate project)

```bash
cd functions
npm install
npm run build     # Compile TypeScript
firebase deploy --only functions
```

## Architecture Overview

**MayoristaMovil** is a B2B wholesale marketplace for Argentina built with Next.js 14 App Router + Firebase. The core business model is **fractional lots**: retailers join an accumulating order for a product until the manufacturer's minimum quantity is reached, then the lot closes and the order is processed.

### Authentication & Sessions

- **Firebase Auth** for identity; **Firebase Admin SDK** verifies tokens server-side
- Login flow: client gets Firebase `idToken` → `POST /api/auth/login` → backend verifies and sets HTTP-only cookies (`userId`, `activeRole`, `userEmail`) with 7-day expiry
- `middleware.ts` protects all `/dashboard/*` routes, redirecting unauthenticated users to `/login`
- Role-based middleware guards: manufacturers/distributors/wholesalers go to `/dashboard/fabricante`; retailers go to `/dashboard/pedidos-fraccionados`

### User Roles

Users can hold multiple roles simultaneously and switch between them. Roles: `manufacturer`, `distributor`, `wholesaler`, `retailer`. The `activeRole` cookie determines the current dashboard context.

### Core Data Flow: Fractional Lots

1. Manufacturer creates a product with a minimum order quantity
2. Retailers browse products in `/explorar` and reserve a quantity via `POST /api/lots/fraccionado/reserve`
3. Reservations accumulate atomically in the `lots` Firestore collection (`accumulatedQty`)
4. When minimum is reached, the lot closes (`status: closed`) and payment is triggered via Mercado Pago
5. `checkFeaturedExpiration` Firebase Cloud Function runs on a schedule to expire featured listings

### API Structure

All API routes are under `app/api/`. Key domains:
- `/api/auth/*` — Login, register, session management, role switching
- `/api/lots/*` — Fractional lot creation, reservation, closing
- `/api/products/*` — Product CRUD
- `/api/payments/*` — Mercado Pago payment preferences and refunds
- `/api/webhooks/mercadopago` — Payment status webhook
- `/api/featured/*` — Featured product/factory listings with expiration
- `/api/admin/*` — Manufacturer verification, admin exports
- `/api/cron/*` — Scheduled task endpoints

### Database

**Firestore** (project: `studio-3528216260-c7c7e`). No ORM. Raw Admin SDK calls throughout `lib/` and `app/api/`. Key collections: `users`, `manufacturers`, `products`, `lots`, `featured`, `orders`, `reservations`.

Composite index definitions live in `firestore.indexes.json` — update this when adding multi-field queries.

### Caching

- Home page (`app/page.tsx`) uses `export const revalidate = 300` for 5-minute ISR
- API response caching uses `lru-cache` (imported from `lib/`)
- No client-side state management library — data fetched directly in components or API routes

### Key Libraries

| Library | Use |
|---------|-----|
| `firebase` / `firebase-admin` | Auth + Firestore (client / server) |
| `mercadopago` | Payment processing |
| `resend` | Transactional email |
| `@anthropic-ai/sdk` | Claude API (embedded AI features) |
| `lru-cache` | In-memory API response cache |
| `date-fns` / `date-fns-tz` | Date manipulation with Argentina timezone |
| `react-hot-toast` | Toast notifications |
| Tailwind CSS v4 | Styling (via `@tailwindcss/postcss`) |

### Path Aliases

TypeScript path alias `@/` maps to the project root. Use `@/lib/...`, `@/components/...`, etc.

### Image Domains

Allowed remote image hosts (configured in `next.config.js`): `firebasestorage.googleapis.com`, `storage.googleapis.com`, `images.unsplash.com`.

### CORS

CORS headers on `/api/*` routes are set in `next.config.js`. The allowed origin is controlled by `ALLOWED_ORIGIN` env var, falling back to `NEXT_PUBLIC_APP_URL`, then `https://mayoristamovil.com`.

### Auth Helpers

- `lib/auth/requireAdmin.ts` — Throws if user is not admin
- `lib/auth/requireRole.ts` — Throws if user lacks the required role
- Call these at the top of API route handlers before business logic
