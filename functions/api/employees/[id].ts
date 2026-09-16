import type { Env } from "../../lib/sheets";
import { getEmployee, listPayrollForEmployee, computeJudgment, upsertEmployeeStandardAmount } from "../../lib/repository";
import { fixedTotal, totalPay } from "../../lib/judgment";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  const employee = await getEmployee(context.env, id);
  if (!employee) {
    return Response.json({ error: "対象者が見つかりません" }, { status: 404 });
  }

  const records = await listPayrollForEmployee(context.env, id);
  const sorted = [...records].sort((a, b) => a.month.localeCompare(b.month));
  const result = await computeJudgment(context.env, employee);

  return Response.json({
    employee,
    history: sorted.map((r) => ({
      ...r,
      fixedTotal: fixedTotal(r),
      totalPay: totalPay(r),
      isChangeMonth: r.month === result.changeMonth,
    })),
    judgment: result,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  const body = (await context.request.json()) as { name?: string; currentStandardAmount?: number };

  if (!body.currentStandardAmount || body.currentStandardAmount <= 0) {
    return Response.json({ error: "current_standard_amount は正の整数で指定してください" }, { status: 400 });
  }

  const existing = await getEmployee(context.env, id);
  const name = body.name ?? existing?.name ?? id;
  const updated = await upsertEmployeeStandardAmount(context.env, id, name, body.currentStandardAmount);
  return Response.json(updated);
};
