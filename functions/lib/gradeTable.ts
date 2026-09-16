// 健康保険 標準報酬月額等級表(東京都情報サービス産業健康保険組合〈TJK〉 令和8年度)
// max が null の等級は上限なし(最上位等級)を表す。
export interface GradeRow {
  grade: number;
  standardAmount: number;
  min: number;
  max: number | null;
}

export const GRADE_TABLE: GradeRow[] = [
  { grade: 1, standardAmount: 58000, min: 0, max: 63000 },
  { grade: 2, standardAmount: 68000, min: 63000, max: 73000 },
  { grade: 3, standardAmount: 78000, min: 73000, max: 83000 },
  { grade: 4, standardAmount: 88000, min: 83000, max: 93000 },
  { grade: 5, standardAmount: 98000, min: 93000, max: 101000 },
  { grade: 6, standardAmount: 104000, min: 101000, max: 107000 },
  { grade: 7, standardAmount: 110000, min: 107000, max: 114000 },
  { grade: 8, standardAmount: 118000, min: 114000, max: 122000 },
  { grade: 9, standardAmount: 126000, min: 122000, max: 130000 },
  { grade: 10, standardAmount: 134000, min: 130000, max: 138000 },
  { grade: 11, standardAmount: 142000, min: 138000, max: 146000 },
  { grade: 12, standardAmount: 150000, min: 146000, max: 155000 },
  { grade: 13, standardAmount: 160000, min: 155000, max: 165000 },
  { grade: 14, standardAmount: 170000, min: 165000, max: 175000 },
  { grade: 15, standardAmount: 180000, min: 175000, max: 185000 },
  { grade: 16, standardAmount: 190000, min: 185000, max: 195000 },
  { grade: 17, standardAmount: 200000, min: 195000, max: 210000 },
  { grade: 18, standardAmount: 220000, min: 210000, max: 230000 },
  { grade: 19, standardAmount: 240000, min: 230000, max: 250000 },
  { grade: 20, standardAmount: 260000, min: 250000, max: 270000 },
  { grade: 21, standardAmount: 280000, min: 270000, max: 290000 },
  { grade: 22, standardAmount: 300000, min: 290000, max: 310000 },
  { grade: 23, standardAmount: 320000, min: 310000, max: 330000 },
  { grade: 24, standardAmount: 340000, min: 330000, max: 350000 },
  { grade: 25, standardAmount: 360000, min: 350000, max: 370000 },
  { grade: 26, standardAmount: 380000, min: 370000, max: 395000 },
  { grade: 27, standardAmount: 410000, min: 395000, max: 425000 },
  { grade: 28, standardAmount: 440000, min: 425000, max: 455000 },
  { grade: 29, standardAmount: 470000, min: 455000, max: 485000 },
  { grade: 30, standardAmount: 500000, min: 485000, max: 515000 },
  { grade: 31, standardAmount: 530000, min: 515000, max: 545000 },
  { grade: 32, standardAmount: 560000, min: 545000, max: 575000 },
  { grade: 33, standardAmount: 590000, min: 575000, max: 605000 },
  { grade: 34, standardAmount: 620000, min: 605000, max: 635000 },
  { grade: 35, standardAmount: 650000, min: 635000, max: 665000 },
  { grade: 36, standardAmount: 680000, min: 665000, max: 695000 },
  { grade: 37, standardAmount: 710000, min: 695000, max: 730000 },
  { grade: 38, standardAmount: 750000, min: 730000, max: 770000 },
  { grade: 39, standardAmount: 790000, min: 770000, max: 810000 },
  { grade: 40, standardAmount: 830000, min: 810000, max: 855000 },
  { grade: 41, standardAmount: 880000, min: 855000, max: 905000 },
  { grade: 42, standardAmount: 930000, min: 905000, max: 955000 },
  { grade: 43, standardAmount: 980000, min: 955000, max: 1005000 },
  { grade: 44, standardAmount: 1030000, min: 1005000, max: 1055000 },
  { grade: 45, standardAmount: 1090000, min: 1055000, max: 1115000 },
  { grade: 46, standardAmount: 1150000, min: 1115000, max: 1175000 },
  { grade: 47, standardAmount: 1210000, min: 1175000, max: 1235000 },
  { grade: 48, standardAmount: 1270000, min: 1235000, max: 1295000 },
  { grade: 49, standardAmount: 1330000, min: 1295000, max: 1355000 },
  { grade: 50, standardAmount: 1390000, min: 1355000, max: null },
];

/** 報酬月額に対応する等級を返す。範囲外は最上位/最下位等級に丸める。 */
export function findGrade(amount: number, table: GradeRow[] = GRADE_TABLE): GradeRow {
  for (const row of table) {
    const belowMax = row.max === null ? true : amount < row.max;
    if (amount >= row.min && belowMax) return row;
  }
  return amount < table[0].min ? table[0] : table[table.length - 1];
}

export function gradeOf(grade: number, table: GradeRow[] = GRADE_TABLE): GradeRow {
  const row = table.find((g) => g.grade === grade);
  if (!row) throw new Error(`不明な等級です: ${grade}`);
  return row;
}
