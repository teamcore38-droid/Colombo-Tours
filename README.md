# Colombo Tours — Luxury Car Rental & Chauffeur Fleet Website (MERN)

Mobile-first, responsive car rental storefront and staff admin dashboard built for **Colombo Tours** (Sri Lanka) using the MERN stack (**MongoDB Atlas, Express, React, Node.js**) structured for deployment on **Vercel**.

## Key Features

- **Brand & Theme**: Obsidian black, charcoal, and brushed champagne-gold palette paired with the official Colombo Tours logo. Dark mode is the default, with a light mode toggle saved to `localStorage`.
- **Responsive Storefront**:
  - **Mobile**: Compact header with slide-over navigation, WhatsApp Support button, theme toggle, unified Search + Filter bar, horizontal category pills (`Luxury`, `SUV`, `Wedding`, `Chauffeur`, `Airport Transfer`, `Van & Group`), and single-column vehicle cards.
  - **Desktop**: Wide luxury Hero Banner with featured vehicle carousel, 2-column `Premium Fleet` grid underneath, and a sticky `Quick Enquiry` panel on the right.
  - **No prices or currency toggles** anywhere — availability, rates, and confirmations are handled directly through WhatsApp.
- **WhatsApp Enquiry Flow**:
  - Every vehicle card, specs modal, hero banner, service card, and header support button opens WhatsApp with a pre-filled message identifying the chosen vehicle or service.
  - Optional pickup location, pickup/return dates (validated against past and inverted ranges), and chauffeur preference in Quick Enquiry are automatically included in the message.
  - Managed via a single global WhatsApp number in the Admin Dashboard. All WhatsApp buttons remain cleanly disabled until a valid international number is saved.
- **Secure Staff Admin Dashboard (`/admin`)**:
  - Hardened JWT `HttpOnly; SameSite=Strict` cookie authentication (`HS256` pinned) with bcrypt password hashing (cost 12), server-side token revocation on logout, MongoDB-backed serverless rate limiting + per-account lockout, and same-origin CSRF protection.
  - Self-service **Change Password** & **Sign Out All Devices** controls under **Settings → Account Security**, plus an interactive CLI reset tool (`npm run reset-password`).
  - Add, edit, publish, unpublish, feature, and delete vehicles.
  - Client-side WebP photo optimization before upload; serverless-safe storage via **Cloudinary** (recommended, with automatic CDN optimization and delete cleanup), **Vercel Blob** (optional), or **MongoDB Media** fallback (`/api/media/:id` with immutable HTTP caching).
  - Manage categories, rental services, storefront headlines, and the global WhatsApp number.

---

## Project Structure

```text
├── api/index.js          # Vercel Serverless Function entrypoint for Express API
├── vercel.json           # Vercel build & /api + SPA rewrites
├── .env.example          # Required environment variables template
├── server/               # Express + Mongoose backend API
│   ├── src/
│   │   ├── config/       # Env loader & serverless-cached MongoDB Atlas connector
│   │   ├── models/       # AdminUser, Category, Vehicle, Service, SiteSettings, Media
│   │   ├── middleware/   # JWT cookie auth & memory-based multer image upload
│   │   ├── routes/       # auth, public (/bootstrap, /vehicles, ...), media, admin
│   │   └── utils/        # E.164 WhatsApp validation, storage, idempotent seeder
│   └── tests/            # Vitest + Supertest + mongodb-memory-server API tests
└── client/               # React + Vite + Tailwind CSS v4 frontend
    ├── public/brand/     # Official Colombo Tours logo variants (dark/light/emblem)
    ├── public/vehicles/  # Optimized lightweight WebP studio fleet images
    └── src/              # Storefront, Quick Enquiry, Specs Modal, Admin Dashboard
```

---

## Local Setup Instructions

### Prerequisites
- **Node.js 20+** (tested on Node.js 24 LTS) and **npm 10+**
- A **MongoDB Atlas** connection string (or use `USE_IN_MEMORY_DB=true` for quick local preview without Atlas credentials)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Update `.env` with your values:
- `MONGODB_URI` — your MongoDB Atlas SRV connection string (or set `USE_IN_MEMORY_DB=true` for an ephemeral local preview database).
- `JWT_SECRET` — a strong random string (at least 32 characters).
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — credentials for the initial staff admin account (auto-created on first boot when no admin exists).
- `DEFAULT_WHATSAPP_NUMBER` — leave empty to start with WhatsApp buttons disabled until configured in `/admin`, or provide digits with country code (e.g., `94771234567`).

### 3. Run Locally (API + Frontend)
```bash
npm run dev
```
- **Storefront**: `http://localhost:5173`
- **Staff Admin Dashboard**: `http://localhost:5173/admin`
- **Express API**: `http://localhost:5000/api/health`

### 4. Production Build & Automated Tests
```bash
npm run build
npm test
npm run lint
```

---

## Deploying to Vercel

1. Push this repository to GitHub and import it into Vercel.
2. Vercel automatically detects `vercel.json`:
   - Builds `client/` into `client/dist`
   - Routes `/api/*` to the serverless Express function at `api/index.js`
   - Routes all frontend paths (`/`, `/admin`, `/admin/login`) to `index.html`
3. Add the environment variables from `.env.example` in **Vercel Project Settings → Environment Variables**:
   - Required: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - Recommended for image uploads (Cloudinary): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (and optional `CLOUDINARY_FOLDER=colombo-tours/vehicles`), or single-line `CLOUDINARY_URL`
   - Optional: `SEED_ON_EMPTY=true`, `DEFAULT_WHATSAPP_NUMBER`, `BLOB_READ_WRITE_TOKEN`
4. Ensure your MongoDB Atlas **Network Access** allows Vercel connections (e.g., `0.0.0.0/0` or Vercel Static IPs).
5. After deploying, visit `/admin`, sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and save your Sri Lankan WhatsApp number under **WhatsApp & Settings** to activate all WhatsApp enquiry buttons site-wide.
