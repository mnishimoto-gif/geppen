import type { Env } from "../lib/sheets";
import { computeAllJudgments, listPayrollForEmployee } from "../lib/repository";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const judgments = await computeAllJudgments(context.env);

  const applicable = judgments.filter((j) => j.result.status === "applicable");
  const pending = judgments.filter((j) => j.result.status === "pending");

  let latestMonth: string | null = null;
  for (const { employee } of judgments) {
    const records = await listPayrollForEmployee(context.env, employee.id);
    for (const r of records) {
      if (!latestMonth || r.month > latestMonth) latestMonth = r.month;
    }
  }

  return Response.json({
    employeeCount: judgments.length,
    latestImportedMonth: latestMonth,
    applicableCount: applicable.length,
    pendingCount: pending.length,
    alerts: applicable.map(({ employee, result }) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      changeMonth: result.changeMonth,
      currentGrade: result.currentGrade,
      newGrade: result.newGrade,
      gradeDiff: result.gradeDiff,
    })),
  });
};
