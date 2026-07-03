# POS Billing System

Production-ready Point-of-Sale billing system for mini supermarkets. Built with Node.js, Express, EJS, and MongoDB Atlas.

---

## Tech Stack

- **Backend**: Node.js + Express.js
- **Views**: EJS (server-rendered, no SPA)
- **Database**: MongoDB Atlas (Mongoose)
- **Auth**: JWT in httpOnly cookies
- **Hosting**: Render (backend) + MongoDB Atlas (DB)

---

## Local Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd pos-billing-system
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` and set:
- `MONGO_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — a long random string (min 32 chars)
- `SESSION_SECRET` — another long random string
- `DEFAULT_ADMIN_PASSWORD` — your desired admin password

### 3. Seed the database
```bash
npm run seed
```
Creates the default admin user and store settings.

### 4. Run development server
```bash
npm run dev
```

Visit `http://localhost:5000`

---

## Default Admin Login

```
Username: admin
Password: Admin@12345  (change this in .env before seeding)
```

---

## Deploying to Render

1. Push code to GitHub
2. Create a new **Web Service** on Render
3. Connect your GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables in Render dashboard:
   - `NODE_ENV=production`
   - `MONGO_URI=<your Atlas URI>`
   - `JWT_SECRET=<random string>`
   - `SESSION_SECRET=<random string>`
7. Deploy

After first deploy, run seed via Render Shell:
```bash
node utils/seed.js
```

---

## Keyboard Shortcuts (POS Interface)

| Key | Action |
|-----|--------|
| F2 | Focus product search |
| F3 | Open held orders drawer |
| F4 | Hold current order |
| F8 | Clear cart |
| F10 | Process payment / Charge |
| ↑ / ↓ | Navigate cart rows |
| + / - | Increase / decrease qty of selected row |
| Delete | Remove selected cart row |
| Enter | Add highlighted search result to cart |
| Escape | Close search dropdown |

---

## Role Permissions

| Feature | Admin | Staff |
|---------|-------|-------|
| POS Interface | ✅ | ✅ |
| Dashboard | ✅ | ❌ |
| Products | ✅ | ❌ |
| Categories | ✅ | ❌ |
| Staff Management | ✅ | ❌ |
| Inventory | ✅ | ❌ |
| Reports | ✅ | ❌ |
| Settings | ✅ | ❌ |

---

## Project Structure

```
pos-billing-system/
├── config/          # DB, env, constants
├── controllers/     # Route handlers
├── middleware/      # Auth, roles, validation, rate limiting
├── models/          # Mongoose schemas
├── public/          # Static CSS, JS, images
├── routes/          # Express routers
├── services/        # Business logic (billing, inventory)
├── utils/           # JWT, invoice generator, logger, seed
├── validators/      # express-validator rule chains
├── views/           # EJS templates
│   ├── admin/       # Dashboard, staff, products, reports, etc.
│   ├── auth/        # Login, change password
│   ├── billing/     # Receipt, 58mm/80mm print views
│   ├── errors/      # 403, 404, 500
│   ├── partials/    # Layout, sidebar, topbar
│   └── pos/         # POS terminal interface
├── app.js           # Express app setup
└── server.js        # Entry point
```

---

## Security Features

- JWT in httpOnly, sameSite, secure cookies
- Helmet (CSP, XSS headers)
- Rate limiting (general + login brute-force + billing)
- express-mongo-sanitize (NoSQL injection protection)
- xss-clean (XSS sanitization)
- Password hashing with bcrypt (12 rounds)
- Role-based route authorization
- MongoDB transactions for atomic billing + stock deduction
