
# KAA ERP - Comprehensive User Manual

## 1. Introduction
Welcome to KAA ERP. This manual serves as a complete reference guide for all modules, buttons, and icons within the application.

### 1.1 General Navigation
*   **Sidebar**: Located on the left (desktop) or bottom (mobile). Use this to switch between main modules.
*   **Global Header**:
    *   **Breadcrumbs**: Shows where you are (e.g., "Dashboard / Overview").
    *   **Search (Ctrl+K)**: Opens the global search modal to find any page or record.
    *   **Theme Toggle**: Found in Settings to switch between Light and Dark modes.

---

## 2. Dashboard Module
*The landing page providing a high-level overview of personal and company metrics.*

### 2.1 Key Elements
*   **Welcome Card**: Displays "Good Morning/Evening" and current date.
*   **Quick Stats**: Cards showing personal leave balance, pending tasks, or team attendance.
*   **Recent Activity**: A feed of latest system actions or notifications.
*   **Quick Actions**: Common shortcuts like "Punch In" or "Add Task".

---

## 3. Organisation Module
*Control center for company structure and policies. Access limited to Admins.*

### 3.1 Tabs & Navigation
Navigate using the pill-shaped tabs at the top of the page.

#### A. Masters Tab (Default)
Manage core structural entities.
*   **Sub-Tabs**:
    *   **Departments**: List of all company departments.
        *   **Button**: `+ Add Department` (Opens creation modal).
        *   **Table Icons**: `Check` (Active Status).
        *   **Search**: Filter departments by name/code.
    *   **Locations**: List of physical offices/sites.
        *   **Button**: `+ Add Location`.
        *   **Card Icons**: `MapPin` (Indicates address).

#### B. Roles & Permissions Tab
Define what users can do.
*   **Button**: `+ Add Role`.
*   **Role Cards**:
    *   **Icon**: `Shield` (Represents security level).
    *   **Content**: Lists active permissions (e.g., `essp.view`) and user count.

#### C. System Users Tab
Manage employee accounts.
*   **Button**: `+ Add User`.
*   **Search**: Find users by name or email.
*   **Table Columns**: User Name, Role, Status, Linked Employee.

#### D. Workflows Tab
Configure approval chains.
*   **Button**: `+ Create Workflow`.
    *   *Triggers*: Select from Leave Request, Resignation, Expense Claim, Deal Approval.
*   **Workflow Cards**:
    *   **Layout**: Shows flow from "Trigger" → "Step 1" → "Step 2".
    *   **Icons**: `GitMerge` (Workflow path), `Check` (Approval Node).
    *   **Edit**: Click the `Edit` (Pencil) icon on a card to modify steps.

#### E. Notifications Tab
Set up automated alerts.
*   **Button**: `+ Add Notification Rule`.
*   **Form Controls**:
    *   **Event Type**: Select trigger (e.g., New User Joined).
    *   **Channels**: Checkboxes for `Email` and `In-App`.
    *   **Recipients**: Toggle buttons to select roles (e.g., "HR Manager", "Admin").

#### F. Reminders Tab
Configure expiry and compliance alerts.
*   **Button**: `+ Add Configuration`.
*   **Configuration Form**:
    *   **Remind Before**: Enter days (e.g., "30, 60").
    *   **Toggles**: On/Off switches for "Email To Employee" and "Email To Manager".
    *   **Same Day**: Button to enable/disable "Remind On Same Day".

---

## 4. HRMS Module (Human Resource Management)
*Comprehensive employee lifecycle management.*

### 4.1 Overview Tab
*   **KPI Cards**: Total Employees (`Users`), Present Today (`Check`), Payroll Liability (`DollarSign`), Departments (`Briefcase`).
*   **Chart**: Attendance Trends (Bar chart showing last 7 days).
*   **Announcements**:
    *   **Icon**: `Bell` (Red indicator for new items).
    *   **Content**: List of latest company news.

### 4.2 People Tab (Directory)
*   **Button**: `+ Add Employee`.
*   **Search**: Filter by name/role.
*   **Actions**: `MoreHorizontal` (Three dots) icon on rows for Edit/Deactivate options.
*   **Profile Images**: Click on avatar to view full profile (if applicable).

### 4.3 Attendance Tab
*   **Controls**:
    *   **Date Picker**: Select specific day to view logs.
    *   **Button**: `Export CSV` (Download report).
    *   **Button**: `Mark All Present` (Bulk action).
*   **Table Data**: Check-in/out times, Duration, Status (Present/Absent).
*   **Action**: `Edit3` (Pencil) to manually correct punch times.

### 4.4 Leave Administration Tab
*   **Stats**: Pending Requests, Approved Today, Currently On Leave.
*   **Buttons**:
    *   `Policy Settings` (Configure quotas).
    *   `Grant Leave` (Admin override).
*   **Filters**: buttons for "All", "Pending", "History".
*   **Actions (On Pending Requests)**:
    *   `Check` (Green): Approve request.
    *   `X` (Red): Reject request.

### 4.5 Payroll Tab
*   **Button**: `Run Payroll` (`DollarSign` icon). Generates payslips for all active employees.
*   **Table**: Shows Earnings (`+Green`), Deductions (`-Red`), Net Pay.
*   **Action**: `Download` icon to save PDF payslip.

### 4.6 Assets Tab
Manage company equipment.
*   **Button**: `+ Add Asset`.
*   **Table**: Asset Name, Type (`Monitor` icon), Assigned Employee, Status (In Use/Available).

### 4.7 Help Desk Tab
Internal ticketing system.
*   **Button**: `+ New Ticket`.
*   **Ticket Card**:
    *   **Priority Badge**: "High" (Red) / "Medium" (Blue).
    *   **Status Dropdown**: Change ticket state (Open -> In Progress -> Resolved).

### 4.8 Exit Management Tab
*   **Content**: List of resignation requests.
*   **Actions**: `Approve`/`Reject` resignation. Updates "Last Working Day".

---

## 5. ESSP Module (Employee Self Service)
*The employee's personal portal.*

*   **Dashboard**:
    *   **Punch In/Out**: Large toggle button. Green = In, Red = Out.
    *   **Leave Balance**: Shows remaining annual leave cards.
*   **My Leaves**:
    *   **Button**: `+ Apply Leave` (Opens application form).
    *   **Form**: Select Type, Dates, Reason.
*   **My Approvals** (Managers Only):
    *   View requests from reporting team members.
    *   Approve (`Check`) or Reject (`X`).
*   **Resignation**:
    *   **Form**: Submit resignation with reason and proposed date.

---

## 6. CRM Module (Customer Relationship Management)
*For Sales and customer engagement.*

*   **Pipeline Tab**:
    *   **Kanban Board**: Drag and drop Deal cards between columns (Lead -> Proposal -> Negotiation -> Won).
    *   **Button**: `+ Add Deal` (at bottom of columns).
*   **Contacts Tab**:
    *   **Button**: `+ Add New` (Create contact).
    *   **AI Analysis**: Click "Analyze Lead Score" inside a contact to use Gemini AI.
    *   **Email**: Click "Draft Email" to auto-generate content.
*   **Tasks Tab**:
    *   **Button**: `+ New Task`. Set priority and due date.
*   **Assistant Tab**:
    *   **Chat Interface**: Type simple commands like "List high value deals" to get AI responses.

---

## 7. Sales Module
*Financial tracking and invoicing.*

*   **Header Buttons**:
    *   `Export` (`Download` icon).
    *   `Create Invoice` (Emerald button).
*   **Metrics**:
    *   **Monthly Revenue**: Gradient card with `TrendingUp` icon.
    *   **Paid Invoices**: Progress bar card with `CheckCircle`.
    *   **Overdue**: Alert card with `AlertCircle` and pulse animation.
*   **Transactions**: Table of recent orders with `View` link.

---

## 8. Settings Module
*System operational preferences.*

*   **Appearance**:
    *   **Dark Mode**: Toggle button. Switches between Sun (Amber) and Moon (Indigo) icons.
*   **Data Management**:
    *   **Backup**: `Download` box. Saves `kaa_erp_backup_DATE.json`.
    *   **Restore**: `Upload` box. Overwrites system data from file.
*   **Account**:
    *   **Logout**: `LogOut` button. Ends session and returns to login screen.

---

*Note: Some modules like "Search" are global features accessible via the header `Search` icon or `Ctrl+K` shortcut.*
