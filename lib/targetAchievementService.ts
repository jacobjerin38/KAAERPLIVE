import { supabase } from './supabase';

export interface TargetAchievementRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  profileId?: string;
  period: 'Monthly' | 'Yearly';
  year: number;
  month?: number; // 1..12 for Monthly
  // Target
  hasTargetAssigned: boolean;
  targetAmount: number | null;
  incentiveRate: number; // e.g. 2.5 (%)
  // Actual Achievement from live transactions
  actualAchievement: number;
  workOrdersValue: number;
  wonOpportunitiesValue: number;
  workOrdersCount: number;
  wonOpportunitiesCount: number;
  // Calculations
  completionPercentage: number | null; // null if no target
  calculatedIncentive: number;
  variance: number | null; // actual - target
  statusBadge: 'ACHIEVED' | 'ON_TRACK' | 'IN_PROGRESS' | 'BEHIND' | 'NO_TARGET';
  // Underlying live records for drill-down
  underlyingWorkOrders: any[];
  underlyingOpportunities: any[];
}

export interface AchievementSummary {
  period: 'Monthly' | 'Yearly';
  year: number;
  month?: number;
  totalTarget: number;
  totalActualAchievement: number;
  overallCompletionPercentage: number | null;
  totalCalculatedIncentive: number;
  employeesWithTargetCount: number;
  totalActiveEmployeesCount: number;
  totalWorkOrdersDeliveredValue: number;
  totalWonDealsValue: number;
}

/**
 * Helper to match an operational transaction date against the selected period
 */
export const isTransactionInPeriod = (
  dateStr: string | null | undefined,
  period: 'Monthly' | 'Yearly',
  year: number,
  month?: number
): boolean => {
  if (!dateStr) return false;
  // Parse YYYY-MM-DD or ISO timestamp safely
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length < 3) return false;
  const transYear = parseInt(parts[0], 10);
  const transMonth = parseInt(parts[1], 10);

  if (transYear !== year) return false;
  if (period === 'Monthly') {
    if (month && transMonth !== month) return false;
  }
  return true;
};

/**
 * Unified calculation function that pulls live records from the database
 * and computes exact monthly and yearly employee vs target vs incentive figures.
 */
export const fetchEmployeeTargetAchievementData = async (
  companyId: string,
  period: 'Monthly' | 'Yearly',
  year: number,
  month?: number
): Promise<{
  rows: TargetAchievementRecord[];
  summary: AchievementSummary;
}> => {
  // 1. Fetch Active Employees
  const { data: employeesData, error: empError } = await supabase
    .from('employees')
    .select('id, employee_code, name, designation, department, profile_id, status')
    .eq('company_id', companyId)
    .neq('status', 'Resigned')
    .order('name');

  if (empError) {
    console.error('Error fetching employees:', empError);
    throw empError;
  }
  const employees = employeesData || [];

  // 2. Fetch Profiles for mapping user/profile IDs to employee IDs
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name, email, employee_id');
  const profiles = profilesData || [];

  // Map to resolve any ID (profile_id or employee_id) to the employee record
  const idToEmployeeMap = new Map<string, any>();
  employees.forEach(emp => {
    idToEmployeeMap.set(emp.id, emp);
    if (emp.profile_id) {
      idToEmployeeMap.set(emp.profile_id, emp);
    }
  });
  profiles.forEach(p => {
    if (p.employee_id && idToEmployeeMap.has(p.employee_id)) {
      idToEmployeeMap.set(p.id, idToEmployeeMap.get(p.employee_id));
    }
  });

  // 3. Fetch Assigned Targets from employee_targets table
  let targetQuery = supabase
    .from('employee_targets')
    .select('*')
    .eq('company_id', companyId)
    .eq('target_year', year);

  const { data: targetsData, error: targetError } = await targetQuery;
  if (targetError) {
    console.error('Error fetching employee targets:', targetError);
  }
  const targets = targetsData || [];

  // 4. Fetch Customer Work Orders from live CRM module
  const { data: workOrdersData, error: woError } = await supabase
    .from('crm_customer_work_orders')
    .select(`
      id, wo_number, contract_ref, description, amount, currency, status,
      issue_date, start_date, completion_date, employee_id, assigned_to, created_by,
      customer:crm_customers(id, name)
    `)
    .eq('company_id', companyId);

  if (woError) {
    console.error('Error fetching customer work orders:', woError);
  }
  const workOrders = workOrdersData || [];

  // 5. Fetch Won Opportunities from live CRM module
  const { data: opportunitiesData, error: oppError } = await supabase
    .from('crm_opportunities')
    .select(`
      id, title, amount, currency, status, stage_id, expected_closing_date, created_at,
      owner_id, created_by,
      customer:crm_customers(id, name)
    `)
    .eq('company_id', companyId)
    .eq('status', 'Won');

  if (oppError) {
    console.error('Error fetching won opportunities:', oppError);
  }
  const wonOpportunities = opportunitiesData || [];

  // 6. Aggregate transactions by employee for the selected period
  // Map of employeeId -> { workOrders: [], opportunities: [], workOrdersValue: 0, wonOppsValue: 0 }
  const empTransMap = new Map<
    string,
    {
      workOrders: any[];
      opportunities: any[];
      workOrdersValue: number;
      wonOppsValue: number;
    }
  >();

  employees.forEach(emp => {
    empTransMap.set(emp.id, {
      workOrders: [],
      opportunities: [],
      workOrdersValue: 0,
      wonOppsValue: 0,
    });
  });

  // Process Work Orders
  workOrders.forEach(wo => {
    const transDate = wo.issue_date || wo.start_date || wo.completion_date;
    if (!isTransactionInPeriod(transDate, period, year, month)) return;

    // Resolve which employee this work order belongs to
    const targetEmp =
      (wo.employee_id && idToEmployeeMap.get(wo.employee_id)) ||
      (wo.assigned_to && idToEmployeeMap.get(wo.assigned_to)) ||
      (wo.created_by && idToEmployeeMap.get(wo.created_by));

    if (targetEmp && empTransMap.has(targetEmp.id)) {
      const rec = empTransMap.get(targetEmp.id)!;
      const rawAmt = Number(wo.amount) || 0;
      const amtQAR = wo.currency === 'USD' ? rawAmt * 3.64 : rawAmt;
      rec.workOrders.push({ ...wo, amountQAR: amtQAR });
      rec.workOrdersValue += amtQAR;
    }
  });

  // Process Won Opportunities (with deduplication against work orders with identical amounts/refs)
  wonOpportunities.forEach(opp => {
    const transDate = opp.expected_closing_date || opp.created_at;
    if (!isTransactionInPeriod(transDate, period, year, month)) return;

    // Resolve employee
    const targetEmp =
      (opp.owner_id && idToEmployeeMap.get(opp.owner_id)) ||
      (opp.created_by && idToEmployeeMap.get(opp.created_by));

    if (targetEmp && empTransMap.has(targetEmp.id)) {
      const rec = empTransMap.get(targetEmp.id)!;
      const rawAmt = Number(opp.amount) || 0;
      const amtQAR = opp.currency === 'USD' ? rawAmt * 3.64 : rawAmt;
      rec.opportunities.push({ ...opp, amountQAR: amtQAR });
      rec.wonOppsValue += amtQAR;
    }
  });

  // 7. Build Rows per Employee
  let totalAssignedTargetSum = 0;
  let totalActualAchievementSum = 0;
  let totalCalculatedIncentiveSum = 0;
  let employeesWithTargetCount = 0;
  let totalWorkOrdersDeliveredSum = 0;
  let totalWonDealsSum = 0;

  const rows: TargetAchievementRecord[] = employees.map(emp => {
    const trans = empTransMap.get(emp.id) || {
      workOrders: [],
      opportunities: [],
      workOrdersValue: 0,
      wonOppsValue: 0,
    };

    // Calculate actual achievement from live database records
    // Work Orders represent executed client purchase orders / contracts
    // Won Opportunities represent closed sales
    // If an employee has work orders, those represent verified deliveries/orders
    // Actual achievement is the total verified performance attributed to this employee
    const woTotal = trans.workOrdersValue;
    const oppTotal = trans.wonOppsValue;
    // To prevent double counting when a won deal turned into a customer work order with same amount
    let actualAchievement = 0;
    if (woTotal > 0 && oppTotal > 0) {
      // If work orders exist, use work orders value plus any won deals not already mirrored as work orders
      const woAmounts = new Set(trans.workOrders.map(w => Math.round(w.amountQAR)));
      let extraOppsValue = 0;
      trans.opportunities.forEach(o => {
        if (!woAmounts.has(Math.round(o.amountQAR))) {
          extraOppsValue += o.amountQAR;
        }
      });
      actualAchievement = woTotal + extraOppsValue;
    } else {
      actualAchievement = woTotal + oppTotal;
    }

    // Determine Assigned Target
    let targetAmount: number | null = null;
    let incentiveRate = 0;

    if (period === 'Monthly') {
      const monthlyTarget = targets.find(
        t =>
          t.employee_id === emp.id &&
          t.target_period === 'Monthly' &&
          Number(t.target_period_val) === Number(month)
      );
      if (monthlyTarget && monthlyTarget.target_amount != null) {
        targetAmount = Number(monthlyTarget.target_amount);
        incentiveRate = Number(monthlyTarget.incentive_rate) || 0;
      }
    } else {
      // Yearly View
      const yearlyTarget = targets.find(
        t => t.employee_id === emp.id && t.target_period === 'Yearly'
      );
      if (yearlyTarget && yearlyTarget.target_amount != null) {
        targetAmount = Number(yearlyTarget.target_amount);
        incentiveRate = Number(yearlyTarget.incentive_rate) || 0;
      } else {
        // Fallback: sum of 12 monthly targets if set
        const empMonthlyTargets = targets.filter(
          t => t.employee_id === emp.id && t.target_period === 'Monthly'
        );
        if (empMonthlyTargets.length > 0) {
          targetAmount = empMonthlyTargets.reduce(
            (sum, t) => sum + (Number(t.target_amount) || 0),
            0
          );
          // Average incentive rate
          incentiveRate =
            empMonthlyTargets.reduce(
              (sum, t) => sum + (Number(t.incentive_rate) || 0),
              0
            ) / empMonthlyTargets.length;
        }
      }
    }

    const hasTargetAssigned = targetAmount !== null && targetAmount > 0;
    if (hasTargetAssigned) {
      totalAssignedTargetSum += targetAmount!;
      employeesWithTargetCount += 1;
    }

    // Completion percentage & variance
    let completionPercentage: number | null = null;
    let variance: number | null = null;
    let statusBadge: 'ACHIEVED' | 'ON_TRACK' | 'IN_PROGRESS' | 'BEHIND' | 'NO_TARGET' =
      'NO_TARGET';

    if (hasTargetAssigned && targetAmount! > 0) {
      completionPercentage = Math.round((actualAchievement / targetAmount!) * 100);
      variance = actualAchievement - targetAmount!;

      if (completionPercentage >= 100) statusBadge = 'ACHIEVED';
      else if (completionPercentage >= 75) statusBadge = 'ON_TRACK';
      else if (completionPercentage >= 50) statusBadge = 'IN_PROGRESS';
      else statusBadge = 'BEHIND';
    } else if (actualAchievement > 0) {
      statusBadge = 'ACHIEVED';
    }

    // Incentive calculation
    const calculatedIncentive = (actualAchievement * incentiveRate) / 100;

    totalActualAchievementSum += actualAchievement;
    totalCalculatedIncentiveSum += calculatedIncentive;
    totalWorkOrdersDeliveredSum += woTotal;
    totalWonDealsSum += oppTotal;

    return {
      employeeId: emp.id,
      employeeCode: emp.employee_code || '-',
      employeeName: emp.name || 'Unnamed Staff',
      designation: emp.designation || 'Staff',
      department: emp.department || 'General',
      profileId: emp.profile_id,
      period,
      year,
      month,
      hasTargetAssigned,
      targetAmount,
      incentiveRate,
      actualAchievement,
      workOrdersValue: woTotal,
      wonOpportunitiesValue: oppTotal,
      workOrdersCount: trans.workOrders.length,
      wonOpportunitiesCount: trans.opportunities.length,
      completionPercentage,
      calculatedIncentive,
      variance,
      statusBadge,
      underlyingWorkOrders: trans.workOrders,
      underlyingOpportunities: trans.opportunities,
    };
  });

  const overallCompletionPercentage =
    totalAssignedTargetSum > 0
      ? Math.round((totalActualAchievementSum / totalAssignedTargetSum) * 100)
      : null;

  return {
    rows,
    summary: {
      period,
      year,
      month,
      totalTarget: totalAssignedTargetSum,
      totalActualAchievement: totalActualAchievementSum,
      overallCompletionPercentage,
      totalCalculatedIncentive: totalCalculatedIncentiveSum,
      employeesWithTargetCount,
      totalActiveEmployeesCount: employees.length,
      totalWorkOrdersDeliveredValue: totalWorkOrdersDeliveredSum,
      totalWonDealsValue: totalWonDealsSum,
    },
  };
};
