import { LucideIcon } from 'lucide-react';

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  ORGANISATION = 'ORGANISATION',
  HRMS = 'HRMS',
  CRM = 'CRM',
  ESSP = 'ESSP',
  SALES = 'SALES',
  ACCOUNTING = 'ACCOUNTING',
  INVENTORY = 'INVENTORY',
  PROJECTS = 'PROJECTS',
  HELP_DESK = 'HELP_DESK',
  MANUFACTURING = 'MANUFACTURING',
  PROCUREMENT = 'PROCUREMENT',
  MARKETING = 'MARKETING',
  SETTINGS = 'SETTINGS',
}

export interface ModuleConfig {
  id: AppView;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string; // Tailwind class for text color or background
  bgColor: string; // Tailwind class for background
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  view?: AppView;
  action?: () => void;
}

export interface Employee {
  id: string;
  company_id: string;
  name: string;
  email: string;
  designation?: string;
  department?: string;
  profile_photo_url?: string;
  status: string;
  join_date?: string;
  mobile?: string;
  bank_account_no?: string;
  leave_balance?: Record<string, number>;
  salary_amount?: number;
  role_id?: string;
  phone?: string;
  role?: string;
  department_id?: string;
  // Mapped fields for UI
  avatar?: string;
  joinDate?: string;
  salary?: number;
  location?: string;
  departmentId?: string; // Mapped from department_id
  roleId?: string; // Mapped from role_id
  manager_id?: string;
  designation_id?: string;
  employment_type_id?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: string;
  duration?: number;
  total_hours?: number;
  attendance_status_id?: string;
  // Mapped fields for UI
  employeeId?: string;
  checkIn?: string;
  checkOut?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type?: string;
  type?: string; // legacy support
  leave_type_id?: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
  appliedOn?: string; // Mapped
}

export interface Announcement {
  id: string;
  company_id: string;
  title: string;
  content: string;
  is_pinned?: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  serial: string;
  type: string;
  assigned_to?: string;
  assignedTo?: string; // Mapped
  status: string;
  purchase_date?: string;
  purchaseDate?: string; // Mapped
}

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority?: string;
  status: string;
  created_at: string;
  createdAt?: string; // Mapped
  employee_id: string;
  employeeId?: string; // Mapped
  description?: string;
}

export type HRMSViewMode = 'OVERVIEW' | 'EMPLOYEES' | 'PEOPLE' | 'ATTENDANCE' | 'LEAVES' | 'PAYROLL' | 'PERFORMANCE' | 'ASSETS' | 'HELPDESK' | 'SETTINGS' | 'REPORTS' | 'EXIT' | 'DOCUMENTS' | 'ADMIN' | 'RECRUITMENT' | 'ONBOARDING' | 'OFFBOARDING';

// CRM Interfaces
export interface CRMStage {
  id: number;
  name: string;
  position: number;
  win_probability: number;
  status: string;
}

export interface CRMLeadSource {
  id: number;
  name: string;
  status: string;
}

export interface CRMTaskStatus {
  id: number;
  name: string;
  is_closed: boolean;
  color?: string;
  status: string;
}

export interface CRMTaskPriority {
  id: number;
  name: string;
  color?: string;
  level: number;
  status: string;
}

export interface CRMDealType {
  id: number;
  name: string;
  status: string;
}

export interface CRMDeal {
  id: number;
  company_id: string;
  title: string;
  company: string; // client company name
  value: number;
  stage_id: number;
  stage?: CRMStage; // Joined
  deal_type_id?: number;
  deal_type?: CRMDealType; // Joined
  source_id?: number;
  source?: CRMLeadSource; // Joined
  expected_close_date?: string;
  owner_id?: string; // Auth user
  employee_owner_id?: string; // Employee
  owner?: Employee; // Joined
  status: 'OPEN' | 'WON' | 'LOST';
  currency: string;
  tag?: string;
  tag_color?: string;
  pending_target_stage_id?: number;
  created_at: string;
}

export interface CRMContact {
  id: number;
  company_id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  organization?: string;
  company?: string; // [NEW] Added to fix lint error
  assigned_to?: string;
  assignee?: Employee; // Joined
  status: string;
  last_contact?: string;
  owner_id?: string; // [NEW] Added for ownership tracking
}

export interface CRMTask {
  id: number;
  company_id: string;
  title: string;
  description?: string;
  status_id?: number;
  status_details?: CRMTaskStatus; // Joined
  priority_id?: number;
  priority_details?: CRMTaskPriority; // Joined
  due_date?: string;
  assigned_to?: string;
  assignee?: Employee; // Joined
  related_type?: 'DEAL' | 'CONTACT';
  related_id?: number;
  created_by?: string;
  owner_id?: string; // [NEW] Added to match DB schema
  created_at: string;
}

export interface CRMDocument {
  id: string;
  company_id: string;
  name: string;
  file_url: string;
  document_type_id?: number;
  uploaded_by?: string;
  uploader?: Employee; // Joined
  related_type: 'DEAL' | 'CONTACT';
  related_id: number;
  created_at: string;
}

export interface CRMActivity {
  id: string;
  company_id: string;
  entity_type: 'DEAL' | 'CONTACT' | 'TASK';
  entity_id: string;
  action: string;
  description?: string;
  performed_by?: string;
  performer?: Employee; // Joined
  created_at: string;
}

// AI & Website Finder Types
export interface OrgAISettings {
  id: string;
  company_id: string;
  provider: 'GEMINI';
  api_key_encrypted: string;
  model: string;
  status: 'ACTIVE' | 'DISABLED';
  updated_at: string;
}

export interface WebsiteFinderJob {
  id: string;
  company_id: string;
  created_by: string;
  status: 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  countries_checked: string[];
  total_records: number;
  processed_records: number;
  created_at: string;
}

export interface WebsiteFinderResult {
  id: string;
  job_id: string;
  company_name: string;
  website_url?: string;
  branch_presence?: { [key: string]: boolean };
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';
  attempts: number;
  raw_response?: string;
  created_at: string;
}