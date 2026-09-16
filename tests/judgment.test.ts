import { describe, expect, it } from "vitest";
import { fixedTotal, totalPay, detectChangeMonthIndex, judge } from "../functions/lib/judgment";
import { GRADE_TABLE, findGrade } from "../functions/lib/gradeTable";
import type { PayrollRecord } from "../functions/lib/types";

function rec(month: string, base: number, role = 0, skill = 0, housing = 0, overtime = 0, commuting = 0): PayrollRecord {
  return { month, base, roleAllowance: role, skillAllowance: skill, housingAllowance: housing, overtime, commuting };
}

describe("fixedTotal / totalPay", () => {
  it("固定的賃金計は基本給・職務給・能力手当・勤続住宅手当の合計", () => {
    const r = rec("2025-06", 280000, 20000, 10000, 5000, 15000, 8000);
    expect(fixedTotal(r)).toBe(315000);
    expect(totalPay(r)).toBe(338000);
  });
});

describe("findGrade", () => {
  it("等級表の範囲内の金額は対応する等級を返す", () => {
    expect(findGrade(300000, GRADE_TABLE).grade).toBe(22);
    expect(findGrade(289999, GRADE_TABLE).grade).toBe(21);
  });
  it("等級表の下限未満は最下位等級に丸める", () => {
    expect(findGrade(0, GRADE_TABLE).grade).toBe(1);
    expect(findGrade(-100, GRADE_TABLE).grade).toBe(1);
  });
  it("等級表の上限を超える場合は最上位等級に丸める", () => {
    expect(findGrade(5000000, GRADE_TABLE).grade).toBe(50);
  });
});

describe("detectChangeMonthIndex", () => {
  it("固定的賃金の変動がない場合は -1", () => {
    const records = [rec("2025-06", 280000), rec("2025-07", 280000), rec("2025-08", 280000)];
    expect(detectChangeMonthIndex(records)).toBe(-1);
  });
  it("変動が1回だけの場合はその月のインデックスを返す", () => {
    const records = [rec("2025-06", 280000), rec("2025-07", 310000), rec("2025-08", 310000)];
    expect(detectChangeMonthIndex(records)).toBe(1);
  });
  it("変動が複数回ある場合は直近(最後)の変動月を返す", () => {
    const records = [
      rec("2025-04", 280000),
      rec("2025-05", 310000), // 1回目の変動
      rec("2025-06", 310000),
      rec("2025-07", 330000), // 2回目(直近)の変動
      rec("2025-08", 330000),
    ];
    expect(detectChangeMonthIndex(records)).toBe(3);
  });
});

describe("judge", () => {
  it("固定的賃金の変動がなければ no_change", () => {
    const records = [rec("2025-06", 280000, 15000, 0, 5000, 5000, 6000), rec("2025-07", 280000, 15000, 0, 5000, 8000, 6000), rec("2025-08", 280000, 15000, 0, 5000, 3000, 6000)];
    const result = judge(records, 21, GRADE_TABLE);
    expect(result.status).toBe("no_change");
  });

  it("変動月から3ヶ月分揃っていなければ pending", () => {
    const records = [rec("2025-06", 280000), rec("2025-07", 310000)];
    const result = judge(records, 21, GRADE_TABLE);
    expect(result.status).toBe("pending");
    expect(result.changeMonth).toBe("2025-07");
    expect(result.monthsNeeded).toBe(2);
  });

  it("3ヶ月平均額と現行等級の差が2等級以上なら applicable", () => {
    const records = [
      rec("2025-06", 280000, 20000, 10000, 5000, 15000, 8000), // fixed=315000 (基準月)
      rec("2025-07", 310000, 30000, 10000, 5000, 12000, 8000), // fixed=355000 (変動月)
      rec("2025-08", 310000, 30000, 10000, 5000, 20000, 8000),
      rec("2025-09", 310000, 30000, 10000, 5000, 10000, 8000),
    ];
    const result = judge(records, 22, GRADE_TABLE);
    expect(result.status).toBe("applicable");
    expect(result.changeMonth).toBe("2025-07");
    expect(result.targetMonths).toEqual(["2025-07", "2025-08", "2025-09"]);
    expect(result.avgTotalPay).toBeCloseTo((375000 + 383000 + 373000) / 3, 0);
    expect(result.newGrade).toBe(26);
    expect(result.gradeDiff).toBe(4);
  });

  it("3ヶ月平均額と現行等級の差が2等級未満なら not_applicable", () => {
    const records = [
      rec("2025-06", 260000, 15000, 0, 5000, 5000, 6000),
      rec("2025-07", 265000, 15000, 0, 5000, 8000, 6000), // わずかな変動
      rec("2025-08", 265000, 15000, 0, 5000, 3000, 6000),
      rec("2025-09", 265000, 15000, 0, 5000, 6000, 6000),
    ];
    const result = judge(records, 21, GRADE_TABLE);
    expect(result.status).toBe("not_applicable");
  });

  it("複数回変動した場合は直近の変動月を基準に判定する", () => {
    const records = [
      rec("2025-04", 280000, 20000, 10000, 5000, 10000, 8000), // fixed=315000
      rec("2025-05", 310000, 30000, 10000, 5000, 10000, 8000), // fixed=355000 (1回目)
      rec("2025-06", 310000, 30000, 10000, 5000, 10000, 8000),
      rec("2025-07", 330000, 30000, 10000, 5000, 10000, 8000), // fixed=375000 (2回目・直近)
      rec("2025-08", 330000, 30000, 10000, 5000, 10000, 8000),
      rec("2025-09", 330000, 30000, 10000, 5000, 10000, 8000),
    ];
    const result = judge(records, 22, GRADE_TABLE);
    expect(result.changeMonth).toBe("2025-07");
    expect(result.targetMonths).toEqual(["2025-07", "2025-08", "2025-09"]);
  });
});
