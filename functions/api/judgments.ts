import type { Env } from "../lib/sheets";
import { computeAllJudgments } from "../lib/repository";
import type { JudgmentStatus } from "../lib/types";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const statusFilter = url.searchParams.get("status") as JudgmentStatus | null;

  const judgments = await computeAllJudgments(context.env);
  const filtered = statusFilter ? judgments.filter((j) => j.result.status === statusFilter) : judgments;

  const body = filtered.map(({ employee, result }) => ({
    employeeId: employee.id,
    employeeName: employee.name,
    ...result,
  }));

  return Response.json(body);
};
