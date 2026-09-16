import type { Env } from "../../lib/sheets";
import { parseCsv } from "../../lib/csv";
import { upsertPayrollRecords, listEmployees, computeJudgment, recordJudgment } from "../../lib/repository";

// 取込CSVの列構成: employee_id,month,base,role_allowance,skill_allowance,housing_allowance,overtime,commuting
// (マネーフォワードクラウド給与の出力CSVから、この形式への変換方法は実装時に実際のサンプルCSVで確定させる)
const REQUIRED_COLUMNS = [
  "employee_id",
  "month",
  "base",
  "role_allowance",
  "skill_allowance",
  "housing_allowance",
  "overtime",
  "commuting",
];

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const formData = await context.request.formData();
  const file = formData.get("csv");
  if (!file || typeof file === "string") {
    return Response.json({ error: "csv ファイルが指定されていません" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return Response.json({ error: "CSVにデータ行がありません" }, { status: 400 });
  }

  for (const column of REQUIRED_COLUMNS) {
    if (!(column in rows[0])) {
      return Response.json({ error: `CSVに必須列 "${column}" がありません` }, { status: 400 });
    }
  }

  const months = new Set<string>();
  const inputs = [];
  for (const row of rows) {
    const base = Number(row.base);
    const roleAllowance = Number(row.role_allowance);
    const skillAllowance = Number(row.skill_allowance);
    const housingAllowance = Number(row.housing_allowance);
    const overtime = Number(row.overtime);
    const commuting = Number(row.commuting);

    if ([base, roleAllowance, skillAllowance, housingAllowance, overtime, commuting].some((n) => Number.isNaN(n))) {
      return Response.json({ error: `金額列に数値以外の値が含まれています(employee_id: ${row.employee_id})` }, { status: 400 });
    }

    months.add(row.month);
    inputs.push({
      employeeId: row.employee_id,
      month: row.month,
      base,
      roleAllowance,
      skillAllowance,
      housingAllowance,
      overtime,
      commuting,
    });
  }

  await upsertPayrollRecords(context.env, inputs);

  const employees = await listEmployees(context.env);
  const summary = [];
  for (const employee of employees) {
    const result = await computeJudgment(context.env, employee);
    await recordJudgment(context.env, employee, result);
    summary.push({ employeeId: employee.id, employeeName: employee.name, status: result.status });
  }

  return Response.json({
    importedMonths: [...months],
    recordCount: inputs.length,
    judgmentSummary: summary,
  });
};
