# 40. Serve the website from `apps/api`

Date: 2026-11-18
Status: Accepted
Builds on: 1 (monorepo layout), 5 (API server on Fly), 17 (invitations), 28 (recipe share links), 39 (ChatGPT plugin)

## Context

Magpie needs a public website on `magpiemeals.com`: a high-craft landing page,
SEO articles, and legal documents. It is a website for a mobile app, not a web
version of the app.

`https://magpiemeals.com` already points to `apps/api` on Fly.io and serves
user-facing HTML at `/join/:code`, `/r/:id`, and `/oauth/consent`. Adding a
separate `apps/web` deployment (e.g. Next.js) now would either split the apex
domain behind reverse-proxy rules—risking buffering on `/v1/chats` and `/mcp`
SSE streams (`pristine = true` in `apps/api/fly.toml`)—or introduce SSR vs. SSG
complexity we do not need.

## Decision

Serve the website directly from `apps/api` on `https://magpiemeals.com`.

- Render pages on request with Hono JSX / React SSR in `apps/api`.
- Build client-side motion and interactivity with plain CSS, SVG, and
  typechecked vanilla TypeScript (per `.agents/skills/animate/SKILL.md`),
  bundled by `esbuild` alongside the server rather than shipping a client-side
  React runtime.
- User-facing URLs (`/`, `/join/:code`, `/r/:id`, `/oauth/consent`, articles,
  legal pages) always stay on the apex domain `magpiemeals.com`, never on an
  `api.` subdomain.

## Consequences

- One server, one build, and one deployment own `magpiemeals.com`. `/join` and
  `/r` can share layout and design tokens with the rest of the website.
- If the website ever outgrows `apps/api` and warrants a dedicated `apps/web`
  project (Next.js, Remix, or TanStack Start), `magpiemeals.com` moves to
  `apps/web` along with all human-visible URLs (`/join`, `/r`, articles, legal
  pages), while machine-only endpoints (`/v1/*`) move to `api.magpiemeals.com`.
