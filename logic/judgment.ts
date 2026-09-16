import { GRADE_TABLE, findGrade, gradeOf, type GradeRow } from "./gradeTable";
import type { JudgmentResult, PayrollRecord } from "./types";

/** 固定的賃金計(基本給+職務給+能力手当+勤続住宅手当) */
export function fixedTotal(r: PayrollRecord): number {
  return r.base + r.roleAllowance + r.skillAllowance + r.housingAllowance;
}

/** 総支給額(固定的賃金計+残業手当+通勤手当) */
export function totalPay(r: PayrollRecord): number {
  return fixedTotal(r) + r.overtime + r.commuting;
}

function sortByMonth(records: PayrollRecord[]): PayrollRecord[] {
  return [...records].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * 固定的賃金変動月のインデックスを返す(sorted配列に対する添字)。
 * 複数回変動している場合は直近(最後)の変動月を返す。変動がなければ -1。
 */
export function detectChangeMonthIndex(records: PayrollRecord[]): number {
  const sorted = sortByMonth(records);
  let changeIdx = -1;
  for (let i = 1; i < sorted.length; i++) {
    if (fixedTotal(sorted[i]) !== fixedTotal(sorted[i - 1])) {
      changeIdx = i;
    }
  }
  return changeIdx;
}

/**
 * 随時改定(月額変更)の判定を行う。
 * records は同一対象者の給与レコード(順不同で可、内部で支給年月順にソートする)。
 */
export function judge(records: PayrollRecord[], currentGrade: number, table: GradeRow[] = GRADE_TABLE): JudgmentResult {
  const sorted = sortByMonth(records);
  const changeIdx = detectChangeMonthIndex(sorted);

  if (changeIdx === -1) {
    return { status: "no_change" };
  }

  const need = sorted.slice(changeIdx, changeIdx + 3);
  if (need.length < 3) {
    return {
      status: "pending",
      changeMonth: sorted[changeIdx].month,
      monthsNeeded: 3 - need.length,
    };
  }

  const avgTotalPay = need.reduce((sum, r) => sum + totalPay(r), 0) / 3;
  const newGradeRow = findGrade(avgTotalPay, table);
  const curGradeRow = gradeOf(currentGrade, table);
  const gradeDiff = newGradeRow.grade - curGradeRow.grade;

  return {
    status: Math.abs(gradeDiff) >= 2 ? "applicable" : "not_applicable",
    changeMonth: sorted[changeIdx].month,
    targetMonths: need.map((r) => r.month),
    avgTotalPay,
    currentGrade: curGradeRow.grade,
    newGrade: newGradeRow.grade,
    gradeDiff,
  };
}
