# KAA ERP – Corrected Technical Blueprint (Frontend-First → Logic-Centered, AI-Optional)

> **Purpose**: This document is a **rewritten, corrected, and realistic technical blueprint** for KAA ERP that reflects how the system actually evolved:
>
> * Built initially as **frontend-heavy**
> * Uses **TypeScript + Supabase** because they were known and free
> * **No AI dependency** in core business logic
> * AI (Gemini) treated as **optional UI enhancement only**
>
> This version is optimized for **stability, gradual refactoring, and zero-regret scaling**.

---

## 1. Project Philosophy (Corrected)

### 1.1 Reality-Based Design

KAA ERP was built with real constraints:

* Solo / small team
* Free-tier infrastructure
* Rapid UI validation

This blueprint **does NOT assume greenfield perfection**.
Instead, it focuses on **progressive hardening**.

### 1.2 Core Principles (Final)

| Principle            | Enforcement                    |
| -------------------- | ------------------------------ |
| UI-first             | Frontend drives UX, not logic  |
| DB-enforced rules    | Supabase RLS + RPC             |
| AI optional          | App works fully without AI     |
| Free-first infra     | No paid infra until real usage |
| Incremental refactor | No big rewrites                |

---

## 2. Technology Stack (Locked & Justified)

### 2.1 Frontend (Keep As-Is)

| Layer     | Choice              | Why It Stays                 |
| --------- | ------------------- | ---------------------------- |
| Framework | React 18 + Vite     | Already implemented, fast    |
| Language  | TypeScript          | Safety, not over-engineering |
| Styling   | TailwindCSS         | UI speed, no refactor cost   |
| Icons     | Lucide React        | Lightweight                  |
| Charts    | Recharts            | UI-only analytics            |
| Routing   | react-router-dom v6 | Stable                       |

> **Important**: Frontend contains **presentation logic only**.

---

### 2.2 Backend (Supabase – Single Source of Truth)

| Feature        | Usage                          |
| -------------- | ------------------------------ |
| Auth           | Supabase Auth                  |
| DB             | PostgreSQL                     |
| Security       | Row Level Security (mandatory) |
| Business Logic | Postgres RPC functions         |
| Realtime       | Notifications & approvals      |

> Supabase is not “temporary”. It is the **core backend**.

---

### 2.3 AI Layer (Strictly Isolated)

| Aspect     | Rule                |
| ---------- | ------------------- |
| Dependency | Optional only       |
| Location   | Edge functions only |
| Failure    | Must not break app  |
| Access     | Read-only data      |

---

## 3. Corrected System Architecture

```
[ React UI (Frontend-heavy UX) ]
          |
          | supabase-js
          v
[ Supabase Auth + Postgres ]
          |
          | RPC / RLS
          v
[ Business Rules Enforced ]
          |
          | optional
          v
[ AI Edge Functions (Gemini) ]
```

### Key Rule

> ❌ No approvals, payroll, permissions, or workflow logic in frontend

---

## 4. Project Structure (Minimal Change Strategy)

```
root/
├── src/
│   ├── modules/           # UI-heavy feature modules
│   ├── components/        # Reusable UI
│   ├── contexts/          # Auth + UI state only
│   ├── hooks/             # Data fetching hooks
│   ├── lib/supabase.ts    # Thin DB client
│   └── App.tsx
├── supabase/
│   ├── schema.sql         # DB truth
│   ├── rls.sql            # Security
│   ├── functions/         # RPC + AI
│   └── seed.sql
└── .env.local
```

> **Frontend code stays mostly untouched**.

---

## 5. Authentication, Roles & Permissions (Hardened)

### 5.1 Model

```sql
users(id, name, email, company_id)
roles(id, code)
permissions(id, code)
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)
```

### 5.2 Enforcement

* Frontend never checks permissions directly
* RLS decides access

---

## 6. Multi-Tenant Handling (Passive, Ready)

### 6.1 Design

Every table includes:

```sql
company_id uuid
```

### 6.2 Enforcement

```sql
USING (company_id = auth.jwt()->>'company_id')
```

UI isolation comes later.

---

## 7. Core Modules – Corrected Responsibilities

## 7.1 Dashboard

* UI aggregation only
* No calculations

---

## 7.2 Workflow Engine (DB-Centric)

### Responsibility Shift

| Layer    | Owns              |
| -------- | ----------------- |
| Frontend | Display, trigger  |
| Database | State transitions |

### Key Tables

```sql
workflows
workflow_levels
workflow_requests
workflow_logs
```

All transitions via RPC.

---

## 7.3 HRMS

### Rules

* Attendance logic → DB
* Leave approval → workflow engine
* Payroll → deterministic, no AI

Frontend only renders.

---

## 7.4 ESSP

### Strict RLS

* User sees only own data

### Allowed Actions

* Punch in/out
* Apply leave
* View approvals

---

## 7.5 CRM

### Allowed Logic

* Stage movement validation → DB
* AI scoring → optional

CRM must work **fully without AI**.

---

## 7.6 Sales

* Invoices
* Transactions
* Export

No AI dependency.

---

## 8. Notifications & Reminders

* Generated by DB triggers
* Delivered via realtime

Frontend is passive consumer.

---

## 9. AI Integration (Final Rules)

### What AI CAN Do

* Summarize
* Draft
* Analyze
* Suggest

### What AI CANNOT Do

* Approve
* Calculate
* Decide
* Modify DB directly

Gemini lives only inside:

```
supabase/functions/ai/
```

---

## 10. TypeScript Usage Policy

### Allowed

* Interfaces
* API typing

### Not Allowed

* Domain logic
* Workflow decisions

---

## 11. Deployment (Still Free)

| Layer    | Platform |
| -------- | -------- |
| Frontend | Vercel   |
| Backend  | Supabase |

---

## 12. Refactor Roadmap (Zero Rewrite)

### Phase A – Stabilize

* Freeze UI
* Add RLS everywhere

### Phase B – Migrate Logic

* Move approvals
* Move validations

### Phase C – Optional AI

* Enable Gemini features

---

## 13. Final Statement

This architecture:

* Respects how KAA ERP actually evolved
* Avoids unnecessary rewrites
* Keeps AI optional
* Keeps Supabase central

> **This is a real-world ERP architecture, not a demo architecture.**

---

**End of Corrected Blueprint**
