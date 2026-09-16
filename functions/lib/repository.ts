import type { Env } from "./sheets";
import { readTable, appendRow, overwriteTable } from "./sheets";
import { findGrade, gradeOf, GRADE_TABLE } from "./gradeTable";
import { judge } from "./judgment";
import type { JudgmentResult, PayrollRecord } from "./types";

export interface Employee {
  id: string;
  name: string;
  currentStandardAmount: number;
  currentGrade: number;
  memo: string;
}

const EMPLOYEES_HEADER = ["employee_id", "name", "current_standard_amount", "current_grade", "memo"];
const PAYROLL_HEADER = [
  "record_id",
  "employee_id",
  "month",
  "base",
  "role_allowance",
  "skill_allowance",
  "housing_allowance",
  "overtime",
  "commuting",
  "imported_at",
];
const JUDGMENT_HEADER = [
  "judgment_id",
  "employee_id",
  "change_month",
  "target_months",
  "avg_total_pay",
  "current_grade",
  "new_grade",
  "grade_diff",
  "status",
  "judged_at",
];

export async function listEmployees(env: Env): Promise<Employee[]> {
  const rows = await readTable(env, env.SHEET_ID_EMPLOYEES);
  return rows
    .filter((r) => r.employee_id)
    .map((r) => ({
      id: r.employee_id,
      name: r.name,
      currentStandardAmount: Number(r.current_standard_amount || 0),
      currentGrade: Number(r.current_grade || 0),
      memo: r.memo ?? "",
    }));
}

export async function getEmployee(env: Env, id: string): Promise<Employee | null> {
  const employees = await listEmployees(env);
  return employees.find((e) => e.id === id) ?? null;
}

/** 対象者の現行標準報酬月額を登録・更新する。等級はGradeTableから自動算出する。 */
export async function upsertEmployeeStandardAmount(
  env: Env,
  id: string,
  name: string,
  currentStandardAmount: number
): Promise<Employee> {
  const rows = await readTable(env, env.SHEET_ID_EMPLOYEES);
  const grade = findGrade(currentStandardAmount, GRADE_TABLE).grade;
  const existingIndex = rows.findIndex((r) => r.employee_id === id);

  const updatedRow = {
    employee_id: id,
    name,
    current_standard_amount: currentStandardAmount,
    current_grade: grade,
    memo: existingIndex >= 0 ? rows[existingIndex].memo ?? "" : "",
  };

  if (existingIndex >= 0) {
    rows[existingIndex] = updatedRow as unknown as Record<string, string>;
  } else {
    rows.push(updatedRow as unknown as Record<string, string>);
  }

  await overwriteTable(env, env.SHEET_ID_EMPLOYEES, EMPLOYEES_HEADER, rows as unknown as Record<string, string | number>[]);
  return { id, name, currentStandardAmount, currentGrade: grade, memo: updatedRow.memo };
}

export async function listPayrollForEmployee(env: Env, employeeId: string): Promise<PayrollRecord[]> {
  const rows = await readTable(env, env.SHEET_ID_PAYROLL_RECORDS);
  return rows
    .filter((r) => r.employee_id === employeeId)
    .map((r) => ({
      month: r.month,
      base: Number(r.base || 0),
      roleAllowance: Number(r.role_allowance || 0),
      skillAllowance: Number(r.skill_allowance || 0),
      housingAllowance: Number(r.housing_allowance || 0),
      overtime: Number(r.overtime || 0),
      commuting: Number(r.commuting || 0),
    }));
}

interface UpsertPayrollInput {
  employeeId: string;
  month: string;
  base: number;
  roleAllowance: number;
  skillAllowance: number;
  housingAllowance: number;
  overtime: number;
  commuting: number;
}

/** 同一対象者・同一支給年月のレコードが既にあれば上書き(アップサート)し、なければ追加する。 */
export async function upsertPayrollRecords(env: Env, inputs: UpsertPayrollInput[]): Promise<void> {
  const rows = await readTable(env, env.SHEET_ID_PAYROLL_RECORDS);
  const importedAt = new Date().toISOString();

  for (const input of inputs) {
    const existingIndex = rows.findIndex((r) => r.employee_id === input.employeeId && r.month === input.month);
    const row = {
      record_id: existingIndex >= 0 ? rows[existingIndex].record_id : crypto.randomUUID(),
      employee_id: input.employeeId,
      month: input.month,
      base: input.base,
      role_allowance: input.roleAllowance,
      skill_allowance: input.skillAllowance,
      housing_allowance: input.housingAllowance,
      overtime: input.overtime,
      commuting: input.commuting,
      imported_at: importedAt,
    };
    if (existingIndex >= 0) {
      rows[existingIndex] = row as unknown as Record<string, string>;
    } else {
      rows.push(row as unknown as Record<string, string>);
    }
  }

  await overwriteTable(env, env.SHEET_ID_PAYROLL_RECORDS, PAYROLL_HEADER, rows as unknown as Record<string, string | number>[]);
}

export interface EmployeeJudgment {
  employee: Employee;
  result: JudgmentResult;
}

export async function computeJudgment(env: Env, employee: Employee): Promise<JudgmentResult> {
  const records = await listPayrollForEmployee(env, employee.id);
  return judge(records, employee.currentGrade, GRADE_TABLE);
}

export async function computeAllJudgments(env: Env): Promise<EmployeeJudgment[]> {
  const employees = await listEmployees(env);
  const results: EmployeeJudgment[] = [];
  for (const employee of employees) {
    const result = await computeJudgment(env, employee);
    results.push({ employee, result });
  }
  return results;
}

/** 判定結果をJudgmentResultsシートに1件記録する(該当・非該当・判定保留のときのみ)。 */
export async function recordJudgment(env: Env, employee: Employee, result: JudgmentResult): Promise<void> {
  if (result.status === "no_change") return;

  await appendRow(env, env.SHEET_ID_JUDGMENT_RESULTS, JUDGMENT_HEADER, {
    judgment_id: crypto.randomUUID(),
    employee_id: employee.id,
    change_month: result.changeMonth ?? "",
    target_months: (result.targetMonths ?? []).join(","),
    avg_total_pay: result.avgTotalPay ? Math.round(result.avgTotalPay) : "",
    current_grade: result.currentGrade ?? "",
    new_grade: result.newGrade ?? "",
    grade_diff: result.gradeDiff ?? "",
    status: result.status,
    judged_at: new Date().toISOString(),
  });
}
