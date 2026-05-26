# Cyrix OMS v3.0 — Operations Management System
### Engineered by Lead CTO & Principal Architect (35+ Years Experience)

Cyrix OMS v3.0 is a premium, edge-optimized Operations Management System and SLA Penalty Engine built using **Pure JavaScript, CSS, and HTML**. It features a **dual-mode architecture** that automatically runs locally (using IndexedDB persistent storage) or scales globally (using Cloudflare Pages Functions and Cloudflare D1 SQL Database).

---

## 🚀 Instant Local Execution

Since you have Python installed, you can spin up a local server instantly and test the app with zero installation:

1. Open PowerShell in this folder.
2. Run this command:
   ```powershell
   python -m http.server 8000
   ```
3. Open your browser and go to:
   [**http://localhost:8000**](http://localhost:8000)

**Credentials:**
* **Username:** `Sunil`
* **Password:** `Sunil@9784`

*(In local mode, the app runs entirely in your browser using IndexedDB persistent state. Every chart, penalty calculation, follow-up timeline, and CSV import works instantly.)*

---

## 📁 Repository Structure

```
Sunil App/
├── index.html                   # SPA Shell (Tailwind CSS, Alpine, Chart.js)
├── css/
│   └── styles.css               # Typography, custom animations, glassmorphism UI
├── js/
│   ├── db.js                    # Dual-Mode Database Manager (IndexedDB / API)
│   ├── charts.js                # Chart.js initialization for all 10 analytics charts
│   └── app.js                   # Client-side SPA Router & Controller
├── functions/
│   └── api/
│       └── [[path]].js          # Serverless API routes (GET, POST, PUT, DELETE)
├── schema.sql                   # Database setup for Cloudflare D1 SQL
└── wrangler.toml                # Deployment configuration for Cloudflare Pages
```

---

## ☁️ Global Production Deployment (Cloudflare Pages)

To launch this as a live production system for free:

### 1. Set Up Cloudflare D1 SQL Database
1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to **Workers & Pages** -> **D1**.
2. Click **Create Database** and name it `cyrix_oms_db`.
3. Copy the **Database ID**.
4. Open [wrangler.toml](file:///c:/Users/Cyrix%20HealthCare/Desktop/Sunil%20App/wrangler.toml) and replace `PUT_YOUR_D1_DATABASE_ID_HERE` with your database ID.

### 2. Deploy the Project
If you have `wrangler` CLI installed, run:
```powershell
# Run the SQL migration to seed the database
npx wrangler d1 execute cyrix_oms_db --remote --file=schema.sql

# Deploy the website and serverless backend
npx wrangler pages deploy .
```

*Alternatively, you can commit this folder to a private/public **GitHub Repository** and link it directly via the **Cloudflare Pages Dashboard** (pages will auto-build and deploy every commit).*

---

## 🔒 Security & Performance Features
* **Zero Dependencies**: Client-side is ultra-fast, loads in less than 300ms, and bypasses heavy npm build steps.
* **Edge SLA Engine**: Calculations are done on the fly at Cloudflare's edge servers, ensuring responsive dashboards.
* **Secure Sessions**: Authentication token verified with SHA-256 client/server checks and automatic 8-hour expiry.
