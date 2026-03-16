
# KAA ERP - Comprehensive Project Documentation

## 1. Project Overview
**Name**: KAA ERP (Enterprise Resource Planning)
**Version**: 1.0 (Development)
**Description**: A modern, modular, and AI-powered ERP system designed for SMBs. It features a responsive React frontend, a robust Supabase backend, and a suite of integrated modules including CRM, HRMS, and ESSP.

### Tech Stack
- **Frontend**: React (v18), Vite, TypeScript, TailwindCSS.
- **Backend (BaaS)**: Supabase (PostgreSQL, Authentication, Realtime).
- **Icons**: Lucide React.
- **Charts**: Recharts.
- **AI Integration**: Google Gemini API (via `@google/genai`).

---

## 2. System Architecture

### 2.1 Directory Structure
```
root/
├── .env                  # Environment keys (Supabase, Gemini)
├── crm/                  # (Legacy/Reference CRM files - consolidating to components/modules)
├── hrms/                 # (Legacy/Reference HRMS files)
├── components/           # Core React Components
│   ├── modules/          # Feature Modules (CRM.tsx, HRMS.tsx, Organisation.tsx, etc.)
│   ├── Dashboard.tsx     # Main Landing View
│   ├── GlobalHeader.tsx  # Top Navigation & User Menu
│   ├── Login.tsx         # Auth Entry Point
│   └── Sidebar.tsx       # Navigation Sidebar (Mobile/Desktop)
├── contexts/             # Global State Managers
│   ├── AuthContext.tsx   # User Session & Profile Logic
│   └── UIContext.tsx     # Theme & UI State
├── lib/                  # Utilities
│   └── supabase.ts       # Supabase Client Initialization
├── supabase_schema.sql   # Source of Truth for Database Structure
└── App.tsx               # Main Router & Layout
```

### 2.2 Global State Management
- **AuthContext**: Manages the generic `user` object and Supabase `session`. Handles login state and route protection.
- **UIContext**: Manages global UI preferences, primarily the **Dark Mode** toggle and sidebar states.

### 2.3 Routing (`App.tsx`)
The application uses `react-router-dom` with a layout wrapper.
- **`/`**: Dashboard (Home)
- **`/organisation`**: Organisation Management (Workflows, Departments - *In Progress*)
- **`/essp`**: Employee Self Service Portal (Leaves, Profile)
- **`/hrms`**: Human Resource Management System
- **`/crm`**: Customer Relationship Management
- **`/sales`**: Sales Dashboard
- **`/settings`**: System Configuration & User Preferences

---

## 3. Database Schema (Supabase PostgreSQL)
All tables operate with Row Level Security (RLS) enabled.

### 3.1 Authentication & Users
- **`auth.users`**: Managed by Supabase Auth (Email/Password).
- **RLS Policies**: Standard authenticated read/write.

### 3.2 CRM Module
- **`crm_contacts`**: Core customer data.
    - Fields: `name`, `email`, `phone`, `role`, `company`, `status (Active/Lead)`, `owner_id`.
- **`crm_deals`**: Sales pipeline opportunities.
    - Fields: `title`, `value`, `stage (LEAD -> WON)`, `due_date`, `owner_id`.
- **`crm_tasks`**: Action items linked to contacts/deals.
    - Fields: `title`, `status`, `priority`, `referencing_id`.

### 3.3 Workflow Engine (Core Feature)
A flexible engine for approvals (Leave requests, Expenses).
- **`workflows`**: Definitions of workflows.
    - Fields: `name`, `module`, `trigger_type`, `level_order_type (SEQUENTIAL/PARALLEL)`.
- **`workflow_levels`** (V2): Advanced approval routing.
    - Fields: `approver_type (USER/ROLE)`, `approver_ids` (Array), `logic (ANY/ALL)`.
- **`workflow_requests`**: Runtime instances of a workflow.
    - Fields: `status` (PENDING/APPROVED), `current_step`.

### 3.4 Notifications & Reminders
- **`notification_settings`**: User preferences for alerts.
- **`reminders`**: Scheduled events (e.g., "Document Expiry").
- **`notifications`**: The actual alert records displayed in the `NotificationsPopover`.

---

## 4. Module Features Detail

### 4.1 Dashboard
- **Widgets**: Dynamic cards showing "Pending Approvals", "Recent Deals", "Employee Stats".
- **Customization**: Widgets can be toggled (Roadmap feature).

### 4.2 Human Resources (HRMS)
- **Employee Directory**: List view with filters by Department.
- **Leave Management**: Admin view to Approve/Reject leaves (linked to Workflow Engine).
- **Attendance**: Basic check-in/out logs (Roadmap: Biometric integration).

### 4.3 CRM
- **Kanban Board**: Drag-and-drop Deals pipeline.
- **Contact List**: Searchable database of clients.
- **Activity Log**: History of interactions.

### 4.4 Organisation
- **Workflow Builder**: Interface to create new approval chains.
- **Structure**: (Planned) Visual org chart editor.

---

## 5. Development & Deployment

### 5.1 Prerequisities
- Node.js v16+
- Supabase Project URL & Anon Key.
- Google Gemini API Key.

### 5.2 Environment Variables
Create `.env.local`:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_public_key
VITE_GEMINI_API_KEY=your_ai_key
```

### 5.3 Scripts
- `npm run dev`: Start local dev server (default port 5173).
- `npm run build`: Compile for production.
- `npm run preview`: Test production build locally.

---

## 6. Known Limitations & Roadmap

### Limitations (V1)
- **Data Deletion**: Soft deletes are not fully implemented across all tables (currently hard deletes).
- **Mobile View**: Complex tables (HRMS grid) utilize horizontal scroll rather than reflow.

### Roadmap (V2)
- **Multi-Tenant Support**: `company_id` exists in schema but needs UI isolation logic.
- **AI Analytics**: Deeper integration of Gemini for "Predictive Revenue" and "Churn Risk".
- **Mobile Native App**: React Native port.

---
*Generated by Antigravity Agent - 2026*
