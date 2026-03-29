

export interface GroupCompany {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  logo_url?: string;
}

export interface Company {
  id: string;
  group_company_id?: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  currency: string;
  country?: string;
}

export interface UserCompanyAccess {
  company_id: string;
  company_name: string;
  company_code: string;
  group_name?: string;
  role_name?: string;
  is_default: boolean;
}

export type HRMSViewMode =
  | 'OVERVIEW'
  | 'APPROVALS'
  | 'ORGANISATION'
  | 'MASTERS'
  | 'PEOPLE'
  | 'ASSETS'
  | 'ATTENDANCE'
  | 'LEAVES'
  | 'PAYROLL'
  | 'HELPDESK'
  | 'REPORTS'
  | 'EXIT'
  | 'ROLES'
  | 'SETTINGS';

export type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated' | 'Probation' | 'Notice Period' | 'Inactive';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type AttendanceStatusType = 'Present' | 'Absent' | 'Half Day' | 'Weekend'; // Renamed to avoid conflict

// Master Data Interfaces
export interface Department {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
  company_id: string;
}

export interface Location {
  id: number;
  name: string;
  address?: string;
  status: 'Active' | 'Inactive';
  company_id: string;
}

export interface Role {
  id: string; // UUID
  name: string;
  description?: string;
  permissions?: string[];
  status: 'Active' | 'Inactive';
  company_id: string;
}

// Generic Interface for simple masters (Designation, Grade, etc.)
export interface BaseMaster {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  company_id: string;
}

export interface Designation extends BaseMaster { }
export interface Grade extends BaseMaster { }
export interface EmploymentType extends BaseMaster { }
export interface PayGroup extends BaseMaster {
  pay_frequency?: string;
}
export interface Faith extends BaseMaster { }
export interface MaritalStatus extends BaseMaster { }
export interface BloodGroup extends BaseMaster { }
export interface Nationality extends BaseMaster { }

export interface LeaveType extends BaseMaster {
  default_balance?: number;
  is_paid?: boolean;
}

export interface SalaryComponent extends BaseMaster {
  component_type: 'EARNING' | 'DEDUCTION';
  is_taxable: boolean;
}

export interface ShiftTiming extends BaseMaster {
  start_time: string;
  end_time: string;
}

export interface AttendanceStatusMaster extends BaseMaster {
  affects_salary: boolean;
}

export interface WeekoffRule extends BaseMaster {
  weekdays: string[];
}


export interface Employee {
  id: string;
  name: string;
  role: string; // Display name
  department: string; // Display name
  email: string;
  phone: string;
  joinDate: string; // Mapped from join_date
  salary: number; // Mapped from salary_amount
  status: EmployeeStatus;
  avatar: string;
  location: string; // Display name
  employeeId?: string; // Frontend display helper
  linkedEmployeeId?: string; // Explicit link for profile


  // DB Fields (Snake Case)
  role_id?: string;
  roleId?: string; // Frontend mapped ID
  department_id?: number | null;
  designation_id?: number | null;
  location_id?: number | null;
  grade_id?: number | null;
  employment_type_id?: number | null;
  pay_group_id?: number | null;
  shift_timing_id?: number | null;
  weekoff_rule_id?: number | null;
  reporting_manager_id?: string | null;
  company_id: string;

  employee_code?: string;
  gender?: string;
  date_of_birth?: string;
  join_date?: string;

  // Extended DB Fields
  faith_id?: number | null;
  blood_group_id?: number | null;
  marital_status_id?: number | null;
  office_mobile?: string;
  office_email?: string;
  profile_photo_url?: string;
  salary_amount?: number;

  // Banking
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;

  // Display name fields
  designation?: string;

  // Personal
  personal_email?: string;
  personal_mobile?: string;
  current_address?: string;
  permanent_address?: string;

  // Extended HR Fields
  nationality?: string;
  nationality_id?: number | null;
  annual_leave_duration_policy?: string;
  memo?: string;
  remarks?: string;
  client_name?: string;
  passport_number?: string;
  passport_expiry?: string;
  visa_number?: string;
  visa_expiry?: string;
  visa_sponsor?: string;
  visa_type?: string;
  age?: number;

  // Extended Profile
  skills?: string[];
  documents?: {
    name: string;
    date: string;
    url: string;
  }[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string; // Mapped name
  attendanceStatusId?: number;
  duration: number;
}

export interface LeaveRequest {
  id: string;
  employeeId?: string; // Mapped if needed, usually just user_id in DB
  user_id?: string; // DB field
  type: string; // Mapped name
  leave_type_id?: number | null;
  appliedOn: string; // created_at
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';

  // Helper for UI
  startDate?: string;
  endDate?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  expiry_date?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  serial?: string;
  assignedTo: string | null; // Employee ID
  assigned_to?: string | null; // DB field
  status: 'In Use' | 'Available' | 'Repair';
  purchase_date?: string;
  created_at?: string;
  company_id?: string;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  employee_id: string;
}

export interface PayrollRun {
  id: string;
  month_year: string;
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'PAID';
  total_net_pay: number;
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  employee: { name: string; department: string } | null;
  base_salary: number;
  payable_days: number;
  lop_days: number; // Loss of Pay days
  gross_earning: number;
  total_deduction: number;
  net_pay: number;
  components_breakdown: any;
}
