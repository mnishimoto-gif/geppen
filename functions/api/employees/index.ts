import type { Env } from "../../lib/sheets";
import { computeAllJudgments } from "../../lib/repository";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const judgments = await computeAllJudgments(context.env);
  const body = judgments.map(({ employee, result }) => ({
    id: employee.id,
    name: employee.name,
    currentStandardAmount: employee.currentStandardAmount,
    currentGrade: employee.currentGrade,
    status: result.status,
  }));
  return Response.json(body);
};
