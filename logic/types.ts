export interface PayrollRecord {
  month: string; // 'YYYY-MM'
  base: number;
  roleAllowance: number;
  skillAllowance: number;
  housingAllowance: number;
  overtime: number;
  commuting: number;
}

export type JudgmentStatus = "no_change" | "pending" | "applicable" | "not_applicable";

export interface JudgmentResult {
  status: JudgmentStatus;
  changeMonth?: string;
  targetMonths?: string[];
  avgTotalPay?: number;
  currentGrade?: number;
  newGrade?: number;
  gradeDiff?: number;
  monthsNeeded?: number;
}
