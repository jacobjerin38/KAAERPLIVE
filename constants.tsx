import {
  Users,
  Briefcase,
  ShoppingCart,
  Calculator,
  Package,
  KanbanSquare,
  Headphones,
  Factory,
  Megaphone,
  LayoutGrid,
  Building2,
  UserCircle
} from 'lucide-react';
import { AppView, ModuleConfig } from './types';

export const APP_NAME = "KAA ERP";

// Kaa Brand Logo
import kaaLogo from './kaa_logo.png';
export const KAA_LOGO_URL = kaaLogo;

export const MODULES: ModuleConfig[] = [
  {
    id: AppView.ORGANISATION,
    name: "Organisation",
    description: "Company Structure & Policy",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    id: AppView.HRMS,
    name: "HRMS",
    description: "Employees, Payroll & Recruiting",
    icon: Users,
    color: "text-rose-600",
    bgColor: "bg-rose-100",
  },
  {
    id: AppView.ESSP,
    name: "ESSP",
    description: "Employee Self Service Portal",
    icon: UserCircle,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
  },
  {
    id: AppView.CRM,
    name: "CRM",
    description: "Customer Relationships & Pipelines",
    icon: Briefcase,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  {
    id: AppView.SALES,
    name: "Sales",
    description: "Quotations, Orders & Invoicing",
    icon: ShoppingCart,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  {
    id: AppView.ACCOUNTING,
    name: "Accounting",
    description: "Financials, Banking & Audit",
    icon: Calculator,
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    id: AppView.INVENTORY,
    name: "Inventory",
    description: "Stock, Logistics & Warehouse",
    icon: Package,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  {
    id: AppView.PROJECTS,
    name: "Projects",
    description: "Tasks, Timesheets & Planning",
    icon: KanbanSquare,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
  {
    id: AppView.HELP_DESK,
    name: "Help Desk",
    description: "Tickets & Customer Support",
    icon: Headphones,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
  {
    id: AppView.MANUFACTURING,
    name: "Manufacturing",
    description: "Work Orders, BOM & PLM",
    icon: Factory,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  {
    id: AppView.MARKETING,
    name: "Marketing",
    description: "Campaigns & Automation",
    icon: Megaphone,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
];