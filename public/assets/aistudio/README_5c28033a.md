# Crackpilot — AI Interview Prep & Live-Assist SaaS

Full-stack web application for **Crackpilot**, including the public marketing site, split-screen authentication flows, protected workspace dashboard, and Express API backend with cookie session protection.

## Quick Start

```bash
npm install
npm run dev
```

The server listens on `http://localhost:3000` (Express API + Vite frontend middleware in development, static production bundle via `npm run build && npm start`).

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Public deployment URL used for `/sitemap.xml`, `/robots.txt`, and canonical tags. |
| `SESSION_SECRET` | Secret for signing production session cookies. |
| `VITE_WHATSAPP_NUMBER` | Support WhatsApp number in international format (digits only, no `+`). |
| `DEMO_WEBHOOK_URL` | Optional webhook/CRM endpoint for `/api/demo` bookings. |

## Project Structure

- `server.ts` — Express server with cookie auth (`/api/auth/*`), `/dashboard/*` route protection, mock API routes (`/api/demo`, `/api/sessions`, `/api/credits`, `/api/token`, `/api/tickets`, `/api/profile`, `/api/knowledge`, `/api/review`), `/sitemap.xml`, and `/robots.txt`. All persistence points have `TODO` markers for plugging in a real database/email provider.
- `src/data/` — Centralized mock data (`pricing.ts`, `shortcuts.ts`, `sessions.ts`, `faqs.ts`, `testimonials.ts`, `dashboard.ts`, `landing.ts`).
- `src/components/ui/` — Reusable design system components (`BrandLogo`, `Button`, `Badge`, `Card`, `Input`, `PasswordInput`, `Modal`, `Tabs`, `Accordion`, `Slider`, `Table`, `Sidebar`, `KeyCap`, `StatCard`, `EmptyState`, `Skeleton`, `ThemeToggle`, `WhatsAppButton`).
- `src/components/sections/` — Landing page sections.
- `src/components/auth/` & `src/components/dashboard/` — Split auth layout, OTP input, collapsible dashboard shell, and reusable Book a Demo form.
- `src/pages/` — Public pages, Auth pages, Dashboard Overview + 9 sub-pages, Privacy, Terms, and 404.
- `src/lib/` — Theme context, Toast notifications, Auth context, Zod validation schemas, and per-page SEO helper.

## Customizing Brand Colors, Fonts & Content

1. **Brand Colors & Surfaces**: Edit `@theme` and `:root` / `.dark` custom properties in `src/index.css` (royal blue `#405fe8`, lavender `#e4e4fe`, deep navy `#0d1226`, card `#151a33`, light canvas `#f7f7ff`).
2. **Typography**: Update Google Fonts in `index.html` and the `--font-display`, `--font-sans`, `--font-mono` tokens in `src/index.css`.
3. **Pricing, Shortcuts, FAQs, Testimonials & Sessions**: Edit the typed files in `src/data/`—changes immediately reflect across the landing page, pricing calculator, and dashboard.
