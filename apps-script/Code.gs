/**
 * 月変チェッカー - Google Apps Script バックエンド
 *
 * このファイルの中身をまるごと、Apps Scriptエディタ(script.google.com)の
 * Code.gs に貼り付けて「デプロイ」→「ウェブアプリ」として公開してください。
 * サービスアカウントやGoogle Cloudの設定は一切不要です。
 *
 * ロジック(判定アルゴリズム・等級表)は logic/judgment.ts / logic/gradeTable.ts と
 * 同じ内容を、Apps Script(V8ランタイム)で動くプレーンなJavaScriptに書き写したものです。
 * ロジックを変更する場合は、両方のファイルを合わせて更新してください。
 */

// ==== 設定: 4つのスプレッドシートのファイルID ====
var SHEET_ID_EMPLOYEES = "1maVFaFJ1HdJkurvw5KqDODtTvvxo1EJ9AdvZYTU1Be8";
var SHEET_ID_PAYROLL_RECORDS = "1dBIW5ofut28J9MNwuny36duy2bjYZwClotWRo0zssxs";
var SHEET_ID_JUDGMENT_RESULTS = "1vDbXuhKzIIU9HutMM7_qkTco_4uLOsk9yzjK0mFb-GI";

// ==== 健康保険 標準報酬月額等級表(TJK 令和8年度、全50等級) ====
var GRADE_TABLE = [
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

function findGrade_(amount) {
  for (var i = 0; i < GRADE_TABLE.length; i++) {
    var row = GRADE_TABLE[i];
    var belowMax = row.max === null ? true : amount < row.max;
    if (amount >= row.min && belowMax) return row;
  }
  return amount < GRADE_TABLE[0].min ? GRADE_TABLE[0] : GRADE_TABLE[GRADE_TABLE.length - 1];
}

function gradeOf_(grade) {
  for (var i = 0; i < GRADE_TABLE.length; i++) {
    if (GRADE_TABLE[i].grade === grade) return GRADE_TABLE[i];
  }
  throw new Error("不明な等級です: " + grade);
}

// ==== 判定ロジック(logic/judgment.ts と同じ内容) ====
function fixedTotal_(r) {
  return r.base + r.roleAllowance + r.skillAllowance + r.housingAllowance;
}

function totalPay_(r) {
  return fixedTotal_(r) + r.overtime + r.commuting;
}

function sortByMonth_(records) {
  return records.slice().sort(function (a, b) {
    return a.month < b.month ? -1 : a.month > b.month ? 1 : 0;
  });
}

function detectChangeMonthIndex_(records) {
  var sorted = sortByMonth_(records);
  var changeIdx = -1;
  for (var i = 1; i < sorted.length; i++) {
    if (fixedTotal_(sorted[i]) !== fixedTotal_(sorted[i - 1])) {
      changeIdx = i;
    }
  }
  return changeIdx;
}

function judge_(records, currentGrade) {
  var sorted = sortByMonth_(records);
  var changeIdx = detectChangeMonthIndex_(sorted);

  if (changeIdx === -1) {
    return { status: "no_change" };
  }

  var need = sorted.slice(changeIdx, changeIdx + 3);
  if (need.length < 3) {
    return {
      status: "pending",
      changeMonth: sorted[changeIdx].month,
      monthsNeeded: 3 - need.length,
    };
  }

  var sum = 0;
  for (var i = 0; i < need.length; i++) sum += totalPay_(need[i]);
  var avgTotalPay = sum / 3;

  var newGradeRow = findGrade_(avgTotalPay);
  var curGradeRow = gradeOf_(currentGrade);
  var gradeDiff = newGradeRow.grade - curGradeRow.grade;

  return {
    status: Math.abs(gradeDiff) >= 2 ? "applicable" : "not_applicable",
    changeMonth: sorted[changeIdx].month,
    targetMonths: need.map(function (r) { return r.month; }),
    avgTotalPay: avgTotalPay,
    currentGrade: curGradeRow.grade,
    newGrade: newGradeRow.grade,
    gradeDiff: gradeDiff,
  };
}

// ==== スプレッドシート読み書き(1ファイル=1シート、先頭行がヘッダー) ====
function readTable_(spreadsheetId) {
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) return [];
  var header = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var c = 0; c < header.length; c++) {
      row[header[c]] = values[i][c];
    }
    if (row[header[0]] !== "" && row[header[0]] !== undefined) rows.push(row);
  }
  return rows;
}

function writeTable_(spreadsheetId, header, rows) {
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
  sheet.clearContents();
  var values = [header];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    values.push(header.map(function (key) { return row[key] !== undefined ? row[key] : ""; }));
  }
  sheet.getRange(1, 1, values.length, header.length).setValues(values);
}

var EMPLOYEES_HEADER = ["employee_id", "name", "current_standard_amount", "current_grade", "memo"];
var PAYROLL_HEADER = [
  "record_id", "employee_id", "month", "base", "role_allowance",
  "skill_allowance", "housing_allowance", "overtime", "commuting", "imported_at",
];
var JUDGMENT_HEADER = [
  "judgment_id", "employee_id", "change_month", "target_months", "avg_total_pay",
  "current_grade", "new_grade", "grade_diff", "status", "judged_at",
];

function listEmployees_() {
  var rows = readTable_(SHEET_ID_EMPLOYEES);
  return rows.map(function (r) {
    return {
      id: String(r.employee_id),
      name: String(r.name),
      currentStandardAmount: Number(r.current_standard_amount || 0),
      currentGrade: Number(r.current_grade || 0),
      memo: r.memo || "",
    };
  });
}

function listPayrollForEmployee_(employeeId) {
  var rows = readTable_(SHEET_ID_PAYROLL_RECORDS);
  return rows
    .filter(function (r) { return String(r.employee_id) === employeeId; })
    .map(function (r) {
      return {
        month: String(r.month),
        base: Number(r.base || 0),
        roleAllowance: Number(r.role_allowance || 0),
        skillAllowance: Number(r.skill_allowance || 0),
        housingAllowance: Number(r.housing_allowance || 0),
        overtime: Number(r.overtime || 0),
        commuting: Number(r.commuting || 0),
      };
    });
}

function computeJudgment_(employee) {
  var records = listPayrollForEmployee_(employee.id);
  return judge_(records, employee.currentGrade);
}

function recordJudgment_(employee, result) {
  if (result.status === "no_change") return;
  var rows = readTable_(SHEET_ID_JUDGMENT_RESULTS);
  rows.push({
    judgment_id: Utilities.getUuid(),
    employee_id: employee.id,
    change_month: result.changeMonth || "",
    target_months: (result.targetMonths || []).join(","),
    avg_total_pay: result.avgTotalPay ? Math.round(result.avgTotalPay) : "",
    current_grade: result.currentGrade || "",
    new_grade: result.newGrade || "",
    grade_diff: result.gradeDiff !== undefined ? result.gradeDiff : "",
    status: result.status,
    judged_at: new Date().toISOString(),
  });
  writeTable_(SHEET_ID_JUDGMENT_RESULTS, JUDGMENT_HEADER, rows);
}

// ==== ルート処理 ====
function handleDashboard_() {
  var employees = listEmployees_();
  var results = employees.map(function (e) { return { employee: e, result: computeJudgment_(e) }; });
  var applicable = results.filter(function (r) { return r.result.status === "applicable"; });
  var pending = results.filter(function (r) { return r.result.status === "pending"; });

  var latestMonth = null;
  for (var i = 0; i < employees.length; i++) {
    var records = listPayrollForEmployee_(employees[i].id);
    for (var j = 0; j < records.length; j++) {
      if (!latestMonth || records[j].month > latestMonth) latestMonth = records[j].month;
    }
  }

  return {
    employeeCount: employees.length,
    latestImportedMonth: latestMonth,
    applicableCount: applicable.length,
    pendingCount: pending.length,
    alerts: applicable.map(function (r) {
      return {
        employeeId: r.employee.id,
        employeeName: r.employee.name,
        changeMonth: r.result.changeMonth,
        currentGrade: r.result.currentGrade,
        newGrade: r.result.newGrade,
        gradeDiff: r.result.gradeDiff,
      };
    }),
  };
}

function handleEmployeesList_() {
  return listEmployees_().map(function (e) {
    var result = computeJudgment_(e);
    return {
      id: e.id,
      name: e.name,
      currentStandardAmount: e.currentStandardAmount,
      currentGrade: e.currentGrade,
      status: result.status,
    };
  });
}

function handleEmployeeDetail_(id) {
  var employees = listEmployees_();
  var employee = null;
  for (var i = 0; i < employees.length; i++) {
    if (employees[i].id === id) employee = employees[i];
  }
  if (!employee) return { error: "対象者が見つかりません" };

  var records = sortByMonth_(listPayrollForEmployee_(id));
  var result = computeJudgment_(employee);

  return {
    employee: employee,
    history: records.map(function (r) {
      return {
        month: r.month,
        base: r.base,
        roleAllowance: r.roleAllowance,
        skillAllowance: r.skillAllowance,
        housingAllowance: r.housingAllowance,
        overtime: r.overtime,
        commuting: r.commuting,
        fixedTotal: fixedTotal_(r),
        totalPay: totalPay_(r),
        isChangeMonth: r.month === result.changeMonth,
      };
    }),
    judgment: result,
  };
}

function handleUpdateEmployee_(body) {
  var rows = readTable_(SHEET_ID_EMPLOYEES);
  var grade = findGrade_(body.currentStandardAmount).grade;
  var existingIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].employee_id) === body.id) existingIndex = i;
  }
  var updatedRow = {
    employee_id: body.id,
    name: body.name || (existingIndex >= 0 ? rows[existingIndex].name : body.id),
    current_standard_amount: body.currentStandardAmount,
    current_grade: grade,
    memo: existingIndex >= 0 ? rows[existingIndex].memo || "" : "",
  };
  if (existingIndex >= 0) rows[existingIndex] = updatedRow;
  else rows.push(updatedRow);
  writeTable_(SHEET_ID_EMPLOYEES, EMPLOYEES_HEADER, rows);
  return updatedRow;
}

function handleUploadPayroll_(body) {
  var rows = parseCsv_(body.csvText);
  if (rows.length === 0) return { error: "CSVにデータ行がありません" };

  var required = ["employee_id", "month", "base", "role_allowance", "skill_allowance", "housing_allowance", "overtime", "commuting"];
  for (var i = 0; i < required.length; i++) {
    if (!(required[i] in rows[0])) return { error: "CSVに必須列 \"" + required[i] + "\" がありません" };
  }

  var payrollRows = readTable_(SHEET_ID_PAYROLL_RECORDS);
  var importedAt = new Date().toISOString();
  var months = {};

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var base = Number(row.base), role = Number(row.role_allowance), skill = Number(row.skill_allowance),
      housing = Number(row.housing_allowance), overtime = Number(row.overtime), commuting = Number(row.commuting);
    if ([base, role, skill, housing, overtime, commuting].some(function (n) { return isNaN(n); })) {
      return { error: "金額列に数値以外の値が含まれています(employee_id: " + row.employee_id + ")" };
    }
    months[row.month] = true;

    var existingIndex = -1;
    for (var i = 0; i < payrollRows.length; i++) {
      if (String(payrollRows[i].employee_id) === row.employee_id && String(payrollRows[i].month) === row.month) existingIndex = i;
    }
    var newRow = {
      record_id: existingIndex >= 0 ? payrollRows[existingIndex].record_id : Utilities.getUuid(),
      employee_id: row.employee_id,
      month: row.month,
      base: base, role_allowance: role, skill_allowance: skill, housing_allowance: housing,
      overtime: overtime, commuting: commuting, imported_at: importedAt,
    };
    if (existingIndex >= 0) payrollRows[existingIndex] = newRow;
    else payrollRows.push(newRow);
  }

  writeTable_(SHEET_ID_PAYROLL_RECORDS, PAYROLL_HEADER, payrollRows);

  var employees = listEmployees_();
  var summary = employees.map(function (e) {
    var result = computeJudgment_(e);
    recordJudgment_(e, result);
    return { employeeId: e.id, employeeName: e.name, status: result.status };
  });

  return { importedMonths: Object.keys(months), recordCount: rows.length, judgmentSummary: summary };
}

function handleJudgments_(statusFilter) {
  var employees = listEmployees_();
  var judgments = employees.map(function (e) {
    var result = computeJudgment_(e);
    return Object.assign({ employeeId: e.id, employeeName: e.name }, result);
  });
  if (statusFilter) judgments = judgments.filter(function (j) { return j.status === statusFilter; });
  return judgments;
}

function parseCsv_(text) {
  var lines = text.replace(/\r\n/g, "\n").split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
  if (lines.length === 0) return [];
  var header = lines[0].split(",").map(function (h) { return h.trim(); });
  return lines.slice(1).map(function (line) {
    var cells = line.split(",").map(function (c) { return c.trim(); });
    var row = {};
    for (var i = 0; i < header.length; i++) row[header[i]] = cells[i] !== undefined ? cells[i] : "";
    return row;
  });
}

// ==== Webアプリのエントリーポイント ====
function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var route = e.parameter.route;
  try {
    if (route === "dashboard") return jsonOutput_(handleDashboard_());
    if (route === "employees") return jsonOutput_(handleEmployeesList_());
    if (route === "employee") return jsonOutput_(handleEmployeeDetail_(e.parameter.id));
    if (route === "judgments") return jsonOutput_(handleJudgments_(e.parameter.status || null));
    return jsonOutput_({ error: "不明なroute: " + route });
  } catch (err) {
    return jsonOutput_({ error: String(err) });
  }
}

// POSTは text/plain でJSON文字列を送る(ブラウザのCORSプリフライトを避けるため)。
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.route === "update_employee") return jsonOutput_(handleUpdateEmployee_(body));
    if (body.route === "upload_payroll") return jsonOutput_(handleUploadPayroll_(body));
    return jsonOutput_({ error: "不明なroute: " + body.route });
  } catch (err) {
    return jsonOutput_({ error: String(err) });
  }
}
