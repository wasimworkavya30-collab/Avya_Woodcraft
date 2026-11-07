<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:3E2723,50:8B5A2B,100:D2A679&height=220&section=header&text=AVYA%20WOODCRAFT&fontSize=54&fontColor=FFF8E7&fontAlignY=38&desc=Crafted%20in%20Wood.%20Built%20to%20Last.&descSize=20&descAlignY=60" alt="Avya Woodcraft banner" />

### 🪵 Manufacturer of Fine Furniture 🪵

<img src="https://readme-typing-svg.demolab.com?font=Georgia&size=20&duration=3500&pause=1000&color=8B5A2B&center=true&vCenter=true&width=520&lines=Handcrafted+with+precision;Quality+wood.+Honest+craftsmanship.;Furniture+made+for+your+home" alt="Typing animation" />

![Location](https://img.shields.io/badge/📍_Hyderabad-Telangana,_India-8B5A2B?style=for-the-badge)
![Craft](https://img.shields.io/badge/Craft-Furniture_Manufacturing-3E2723?style=for-the-badge)
![Material](https://img.shields.io/badge/Material-Solid_Wood-D2A679?style=for-the-badge&labelColor=3E2723)

</div>

---

## 🏡 About Us

**Avya Woodcraft** is a furniture manufacturer based in Hyderabad. We bring together traditional woodworking and careful engineering, so every piece is beautiful to look at and dependable to use.

> *"Good furniture is not made in a day. It is shaped with patience, measured with care, and finished with pride."*

---

## 🛠️ What We Make

| | |
|---|---|
| 🛋️ **Furniture** | Custom and made-to-order pieces for homes and spaces |
| 📐 **Design & Drawings** | Detailed CAD drawings before production begins |
| 🪚 **Manufacturing** | In-house fabrication with attention to joinery and finish |

<!-- Add your actual product categories here, e.g. beds, doors, wardrobes, tables -->

---

## ✨ Why Choose Us

- 🌳 **Quality materials**, carefully selected
- 📏 **Precision drawings** and accurate dimensions
- 🤝 **Made to your requirement**, not just off the shelf
- 🏆 **Finish and detail** that lasts

---

## 💻 What You'll Find Here

This GitHub space holds our tools and technical work:

- 📄 CAD-style drawing generators (Python / matplotlib)
- 📊 BOQ and cutting schedule automation
- 🧾 Documentation for our projects

---

## 📬 Get In Touch

<div align="center">

[![Website](https://img.shields.io/badge/🌐_Website-your--website.com-8B5A2B?style=for-the-badge)](https://your-website.com)
[![Email](https://img.shields.io/badge/✉️_Email-your@email.com-3E2723?style=for-the-badge)](mailto:your@email.com)
[![WhatsApp](https://img.shields.io/badge/💬_WhatsApp-+91_XXXXXXXXXX-25D366?style=for-the-badge)](https://wa.me/91XXXXXXXXXX)
[![Instagram](https://img.shields.io/badge/📸_Instagram-@yourhandle-D2A679?style=for-the-badge&labelColor=3E2723)](https://instagram.com/yourhandle)

</div>

---

## 📱 Attendance & Payroll Web App

A complete three-tier web application for the workshop: employees punch in from the authorized company phone, admins approve hours, and the app produces the monthly salary report. It replaces the earlier single-file HTML demo — every record now lives in a database on the server, so the admin phone, managers and employees all see the same live data.

### 🧱 Three-tier architecture

```
┌─────────────────────────────┐
│  Presentation tier          │  React 18 + Vite, react-router
│  client/                    │  Admin console + employee mobile app
└──────────────┬──────────────┘
               │  REST / JSON  ·  JWT bearer token
┌──────────────▼──────────────┐
│  Application tier           │  Node.js + Express, business rules
│  server/                    │  auth, geofence, approvals, payroll
└──────────────┬──────────────┘
               │  SQL (prepared statements)
┌──────────────▼──────────────┐
│  Data tier                  │  SQLite (built into Node 22.5+)
│  server/src/schema.sql      │  20 tables, foreign keys, WAL mode
└─────────────────────────────┘
```

### ✨ What it does

| Area | Features |
|---|---|
| **Attendance** | Check in / check out with selfie, 150 m workshop geofence, one authorized company phone, blocked-attempt log, pairing codes |
| **Approvals** | Day type (full / half / double / custom) and hours per shift, approve one or all; only approved hours are payable |
| **Payroll** | Monthly salary report = approved hours × rate, advance deductions, monthly attendance matrix with Sunday-off policy |
| **People** | Employees, soft remove / restore, photos, PINs, teams, org chart, team leaders, leave requests |
| **Work log** | Daily work per employee (task, item, hours) with overtime and missing-log warnings |
| **Operations** | Product costing, petty cash book, inventory with low-stock alerts, material requests, production stages |
| **Security** | JWT sessions, bcrypt password/PIN hashes, role checks on every endpoint, admin-only routes |
| **Backup** | Full JSON export / import and scoped resets |

### 🚀 Run it locally

```bash
# Node 22.5 or newer (uses the SQLite engine built into Node)
npm install
cp .env.example .env      # then change JWT_SECRET and the admin password
npm run seed              # optional: reload the sample workshop data
npm run dev               # API on :4000, web on :5173
```

Open http://localhost:5173

| Login | Credentials |
|---|---|
| Admin | `admin@avyawoodcraft.in` / `Avya@2026` (from `.env`) |
| Employee | code `AW-101` … `AW-116`, PIN `1234` |

Production (single port, API serves the built app):

```bash
npm run build && npm start     # http://localhost:4000
```

### 🔌 API surface

`/api/auth` · `/api/employees` · `/api/teams` · `/api/attendance` · `/api/work` · `/api/leave` · `/api/payroll` · `/api/devices` · `/api/settings` · `/api/dashboard` · `/api/ops` · `/api/backup`

`npm run smoke` runs 30 end-to-end checks against a running API (login, punch gate, geofence, approvals, payroll, leave, material requests, permissions).

### 🔐 Before using real data

- Change `JWT_SECRET` and `ADMIN_PASSWORD` in `.env`.
- Set `WORKSHOP_LAT` / `WORKSHOP_LNG` to the real workshop gate.
- Serve the app over HTTPS — the browser only shares location and camera on a secure origin.
- Pair the company phone from **Devices → Generate pairing code**.

<details>
<summary>Project layout</summary>

```
client/            React app (presentation tier)
  src/pages/admin  overview, approvals, work log, employees, teams, leave,
                   salary, monthly report, devices, costing, petty, inventory,
                   production, data & backup
  src/pages/employee  today (punch), work, material, hours, leave
server/            Express API (application tier)
  src/routes       one router per domain
  src/lib          payroll rules, date maths, device + geofence helpers
  src/schema.sql   SQLite schema (data tier)
scripts/smoke.mjs  end-to-end API test
```

</details>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:D2A679,50:8B5A2B,100:3E2723&height=120&section=footer" alt="footer" />

**Avya Woodcraft** · Hyderabad, India

</div>
