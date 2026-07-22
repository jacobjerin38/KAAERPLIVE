/**
 * Centralized date formatting utilities for the KAA ERP system.
 * All dates are displayed in dd/mm/yyyy format across the application.
 */

/**
 * Formats a date string or Date object to dd/mm/yyyy format.
 * Example: "2025-12-25" → "25/12/2025"
 */
export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date to a short display format: "25 Dec 2025"
 */
export function formatDateShort(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Formats a date to a long display format: "25 December 2025"
 */
export function formatDateLong(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Formats a date with weekday: "Monday, 25 December 2025"
 */
export function formatDateWithWeekday(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Formats a date for month/year display: "December 2025"
 */
export function formatMonthYear(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Formats a date range: "25 Dec — 31 Dec 2025"
 */
export function formatDateRange(startStr?: string | Date | null, endStr?: string | Date | null): string {
  if (!startStr || !endStr) return '-';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
  const startFmt = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endFmt = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startFmt} — ${endFmt}`;
}

/**
 * Formats weekday short name: "Mon", "Tue", etc.
 */
export function formatWeekdayShort(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/**
 * Formats weekday with date: "Mon, 25 Dec"
 */
export function formatWeekdayDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
