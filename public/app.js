const yen = new Intl.NumberFormat("ja-JP");
const fmtYen = (n) => (n === null || n === undefined || n === "" ? "-" : `¥${yen.format(Math.round(Number(n)))}`);

const STATUS_LABEL = {
  applicable: "該当",
  not_applicable: "非該当",
  pending: "判定保留",
  no_change: "変動なし",
};

const STATUS_CLASS = {
  applicable: "bg-applicable-bg text-applicable border border-applicable-border",
  not_applicable: "bg-not-applicable-bg text-not-applicable border border-not-applicable-border",
  pending: "bg-pending-bg text-pending border border-pending-border",
  no_change: "bg-surface-container text-on-surface-variant border border-surface-border",
};

function statusPill(status) {
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.no_change;
  const label = STATUS_LABEL[status] ?? status;
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

function scriptUrl() {
  if (!window.APPS_SCRIPT_URL) {
    throw new Error("config.js に Google Apps Script の URL が設定されていません。");
  }
  return window.APPS_SCRIPT_URL;
}

async function apiGet(route, params) {
  const url = new URL(scriptUrl());
  url.searchParams.set("route", route);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// Content-Typeを明示的に指定しない(text/plainになる)ことで、ブラウザのCORSプリフライトを避ける。
async function apiPost(body) {
  const res = await fetch(scriptUrl(), { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ---- タブ切り替え ----
const TABS = ["dashboard", "upload", "employees", "results"];
let currentEmployeeId = null;

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("bg-primary-container", active);
    btn.classList.toggle("text-primary", active);
    btn.classList.toggle("text-on-surface-variant", !active);
  });
  document.querySelectorAll("[data-view]").forEach((el) => (el.hidden = true));
  const viewId = tab === "employee-detail" ? "view-employee-detail" : `view-${tab}`;
  document.getElementById(viewId).hidden = false;

  if (tab === "dashboard") renderDashboard();
  if (tab === "upload") renderUpload();
  if (tab === "employees") renderEmployeesList();
  if (tab === "results") renderResults();
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (btn) switchTab(btn.dataset.tab);
});

// ---- ダッシュボード ----
async function renderDashboard() {
  const el = document.getElementById("view-dashboard");
  el.innerHTML = `<p class="text-on-surface-variant">読み込み中...</p>`;
  const data = await apiGet("dashboard");

  const alertsHtml =
    data.alerts.length === 0
      ? `<div class="border border-dashed border-surface-border rounded-xl p-4 text-sm text-on-surface-variant">
           ${data.pendingCount > 0 ? "固定的賃金の変動を検知した対象者がいますが、判定に必要な3ヶ月分のデータがまだ揃っていません。" : "現在、月額変更(随時改定)に該当する対象者はいません。"}
         </div>`
      : `<div class="flex flex-col gap-2">
           ${data.alerts
             .map(
               (a) => `
             <div class="bg-applicable-bg border border-applicable-border rounded-xl p-4 flex items-center gap-4">
               <div class="flex-1">
                 <div class="font-bold">${a.employeeName}</div>
                 <div class="text-xs text-on-surface-variant mt-1">
                   ${a.changeMonth ?? ""} の固定的賃金の変動により、${a.currentGrade}等級 → ${a.newGrade}等級(${a.gradeDiff > 0 ? "+" : ""}${a.gradeDiff}等級差)
                 </div>
               </div>
               <button class="go-results shrink-0 text-xs font-semibold text-applicable border border-applicable-border rounded-lg px-3 py-1.5">判定結果を見る</button>
             </div>`
             )
             .join("")}
         </div>`;

  el.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-surface border border-surface-border rounded-xl p-4">
        <div class="text-xs text-on-surface-variant font-semibold">対象者数</div>
        <div class="text-3xl font-bold font-mono tabular-nums mt-2">${data.employeeCount}</div>
      </div>
      <div class="bg-surface border border-surface-border rounded-xl p-4">
        <div class="text-xs text-on-surface-variant font-semibold">取込済み最新月</div>
        <div class="text-2xl font-bold font-mono tabular-nums mt-2">${data.latestImportedMonth ?? "未取込"}</div>
      </div>
      <div class="bg-surface border border-surface-border rounded-xl p-4">
        <div class="text-xs text-on-surface-variant font-semibold">月額変更 該当者</div>
        <div class="text-3xl font-bold font-mono tabular-nums mt-2 ${data.applicableCount > 0 ? "text-applicable" : ""}">${data.applicableCount}</div>
      </div>
    </div>
    <h2 class="text-sm font-bold text-on-surface-variant mb-3">要対応アラート</h2>
    ${alertsHtml}
  `;

  el.querySelectorAll(".go-results").forEach((btn) => btn.addEventListener("click", () => switchTab("results")));
}

// ---- CSV取込 ----
async function renderUpload() {
  const el = document.getElementById("view-upload");
  const employees = await apiGet("employees");

  const monthSet = new Set();
  for (const emp of employees) {
    const detail = await apiGet("employee", { id: emp.id });
    detail.history.forEach((h) => monthSet.add(h.month));
  }
  const months = [...monthSet].sort();

  el.innerHTML = `
    <div class="mb-6">
      <h2 class="text-lg font-bold mb-1">給与CSV取込</h2>
      <p class="text-sm text-on-surface-variant">マネーフォワードクラウド給与から出力したCSVをアップロードします。</p>
    </div>
    <div class="bg-surface border-2 border-dashed border-surface-border rounded-xl p-8 text-center mb-6">
      <input type="file" id="csv-file" accept=".csv" class="block mx-auto mb-4 text-sm" />
      <button id="upload-btn" class="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg">アップロードして取込を実行</button>
      <div id="upload-message" class="mt-4 text-sm"></div>
    </div>
    <h2 class="text-sm font-bold text-on-surface-variant mb-3">取込済み月一覧</h2>
    <div class="bg-surface border border-surface-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface-container text-on-surface-variant text-xs">
          <tr><th class="text-left px-4 py-2">支給年月</th></tr>
        </thead>
        <tbody>
          ${months.length === 0 ? `<tr><td class="px-4 py-3 text-on-surface-variant">まだ取り込まれていません</td></tr>` : months.map((m) => `<tr class="border-t border-surface-border"><td class="px-4 py-2 font-mono tabular-nums">${m}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("upload-btn").addEventListener("click", async () => {
    const fileInput = document.getElementById("csv-file");
    const messageEl = document.getElementById("upload-message");
    if (!fileInput.files[0]) {
      messageEl.textContent = "CSVファイルを選択してください。";
      messageEl.className = "mt-4 text-sm text-applicable";
      return;
    }
    messageEl.textContent = "取込中...";
    messageEl.className = "mt-4 text-sm text-on-surface-variant";
    try {
      const csvText = await fileInput.files[0].text();
      const data = await apiPost({ route: "upload_payroll", csvText });
      const applicableCount = data.judgmentSummary.filter((s) => s.status === "applicable").length;
      messageEl.textContent = `取込完了: ${data.importedMonths.join(", ")} 分を取り込みました。該当者${applicableCount}名です。`;
      messageEl.className = "mt-4 text-sm text-not-applicable";
      renderUpload();
    } catch (err) {
      messageEl.textContent = err.message;
      messageEl.className = "mt-4 text-sm text-applicable";
    }
  });
}

// ---- 対象者一覧 ----
async function renderEmployeesList() {
  const el = document.getElementById("view-employees");
  const employees = await apiGet("employees");

  el.innerHTML = `
    <h2 class="text-lg font-bold mb-4">対象者一覧</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      ${employees
        .map(
          (e) => `
        <button class="employee-card text-left bg-surface border border-surface-border rounded-xl p-4" data-id="${e.id}">
          <div class="font-bold">${e.name}</div>
          <div class="flex items-baseline justify-between mt-2">
            <span class="font-mono tabular-nums">${fmtYen(e.currentStandardAmount)}(${e.currentGrade}等級)</span>
            ${statusPill(e.status)}
          </div>
        </button>`
        )
        .join("")}
      ${employees.length === 0 ? `<p class="text-sm text-on-surface-variant">まだ対象者が登録されていません。下のフォームから登録してください。</p>` : ""}
    </div>
    <details class="bg-surface border border-surface-border rounded-xl p-4">
      <summary class="text-sm font-bold cursor-pointer">対象者を登録・編集する</summary>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        <input id="emp-id" type="text" placeholder="対象者ID(例: emp1)" class="border border-surface-border rounded-lg px-3 py-2 text-sm" />
        <input id="emp-name" type="text" placeholder="氏名" class="border border-surface-border rounded-lg px-3 py-2 text-sm" />
        <input id="emp-amount" type="number" placeholder="現行の標準報酬月額(円)" class="border border-surface-border rounded-lg px-3 py-2 text-sm" />
        <button id="emp-save" class="bg-primary text-white text-sm font-semibold rounded-lg px-3 py-2">登録・更新</button>
      </div>
      <p class="text-xs text-on-surface-variant mt-2">既存の対象者IDを入力すると内容が上書きされます。等級はGradeTableから自動算出されます。</p>
      <div id="emp-message" class="mt-2 text-sm"></div>
    </details>
  `;

  el.querySelectorAll(".employee-card").forEach((card) =>
    card.addEventListener("click", () => {
      currentEmployeeId = card.dataset.id;
      switchTab("employee-detail");
      renderEmployeeDetail(currentEmployeeId);
    })
  );

  document.getElementById("emp-save").addEventListener("click", async () => {
    const id = document.getElementById("emp-id").value.trim();
    const name = document.getElementById("emp-name").value.trim();
    const amount = Number(document.getElementById("emp-amount").value);
    const messageEl = document.getElementById("emp-message");
    if (!id || !name || !amount) {
      messageEl.textContent = "対象者ID・氏名・標準報酬月額をすべて入力してください。";
      messageEl.className = "mt-2 text-sm text-applicable";
      return;
    }
    try {
      await apiPost({ route: "update_employee", id, name, currentStandardAmount: amount });
      messageEl.textContent = `${name} を登録しました。`;
      messageEl.className = "mt-2 text-sm text-not-applicable";
      renderEmployeesList();
    } catch (err) {
      messageEl.textContent = err.message;
      messageEl.className = "mt-2 text-sm text-applicable";
    }
  });
}

// ---- 対象者詳細 ----
async function renderEmployeeDetail(id) {
  const el = document.getElementById("view-employee-detail");
  const data = await apiGet("employee", { id });
  const { employee, history, judgment } = data;

  const maxFixed = Math.max(1, ...history.map((h) => h.fixedTotal));

  el.innerHTML = `
    <button id="back-to-list" class="text-sm font-semibold text-on-surface-variant mb-4">← 一覧に戻る</button>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-bold">${employee.name}</h2>
      ${statusPill(judgment.status)}
    </div>
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-surface border border-surface-border rounded-xl p-4">
        <div class="text-xs text-on-surface-variant">現行標準報酬月額</div>
        <div class="text-xl font-bold font-mono tabular-nums mt-1">${fmtYen(employee.currentStandardAmount)}</div>
      </div>
      <div class="bg-surface border border-surface-border rounded-xl p-4">
        <div class="text-xs text-on-surface-variant">現行等級</div>
        <div class="text-xl font-bold font-mono tabular-nums mt-1">${employee.currentGrade}等級</div>
      </div>
    </div>
    <h3 class="text-sm font-bold text-on-surface-variant mb-2">固定的賃金の推移</h3>
    <div class="bg-surface border border-surface-border rounded-xl p-4 mb-6 flex items-end gap-3 h-32">
      ${history
        .map(
          (h) => `
        <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div class="w-full max-w-[44px] rounded-t ${h.isChangeMonth ? "bg-applicable-bg border border-applicable" : "bg-primary-container border border-primary"}" style="height:${Math.max(8, Math.round((h.fixedTotal / maxFixed) * 100))}%"></div>
          <div class="text-[11px] text-on-surface-variant">${h.month}</div>
        </div>`
        )
        .join("")}
    </div>
    <div class="bg-surface border border-surface-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-surface-container text-on-surface-variant text-xs">
          <tr>
            <th class="text-left px-3 py-2">支給年月</th>
            <th class="text-right px-3 py-2">基本給</th>
            <th class="text-right px-3 py-2">職務給</th>
            <th class="text-right px-3 py-2">能力手当</th>
            <th class="text-right px-3 py-2">勤続住宅手当</th>
            <th class="text-right px-3 py-2">固定的賃金計</th>
            <th class="text-right px-3 py-2">総支給額</th>
          </tr>
        </thead>
        <tbody>
          ${history
            .map(
              (h) => `
            <tr class="border-t border-surface-border ${h.isChangeMonth ? "bg-applicable-bg" : ""}">
              <td class="px-3 py-2 font-mono tabular-nums">${h.month}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(h.base)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(h.roleAllowance)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(h.skillAllowance)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(h.housingAllowance)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums font-semibold">${fmtYen(h.fixedTotal)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(h.totalPay)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("back-to-list").addEventListener("click", () => switchTab("employees"));
}

// ---- 判定結果一覧 ----
async function renderResults() {
  const el = document.getElementById("view-results");
  const judgments = await apiGet("judgments");

  el.innerHTML = `
    <h2 class="text-lg font-bold mb-4">随時改定 判定結果一覧</h2>
    <div class="bg-surface border border-surface-border rounded-xl overflow-hidden mb-4">
      <table class="w-full text-sm">
        <thead class="bg-surface-container text-on-surface-variant text-xs">
          <tr>
            <th class="text-left px-3 py-2">対象者</th>
            <th class="text-left px-3 py-2">固定的賃金変動月</th>
            <th class="text-left px-3 py-2">対象3ヶ月</th>
            <th class="text-right px-3 py-2">3ヶ月平均総支給額</th>
            <th class="text-right px-3 py-2">現行等級</th>
            <th class="text-right px-3 py-2">新等級</th>
            <th class="text-right px-3 py-2">等級差</th>
            <th class="text-left px-3 py-2">判定</th>
          </tr>
        </thead>
        <tbody>
          ${judgments
            .map(
              (j) => `
            <tr class="border-t border-surface-border">
              <td class="px-3 py-2">${j.employeeName}</td>
              <td class="px-3 py-2 font-mono tabular-nums">${j.changeMonth ?? "-"}</td>
              <td class="px-3 py-2 font-mono tabular-nums">${(j.targetMonths ?? []).join(" / ") || "-"}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${fmtYen(j.avgTotalPay)}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${j.currentGrade ?? "-"}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${j.newGrade ?? "-"}</td>
              <td class="px-3 py-2 text-right font-mono tabular-nums">${j.gradeDiff ?? "-"}</td>
              <td class="px-3 py-2">${statusPill(j.status)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-on-surface-variant leading-relaxed">
      判定は「固定的賃金変動月から3ヶ月間の平均総支給額」と現行の標準報酬月額等級との差が2等級以上あるかどうかで行っています。対象者は月給者のため、支給基礎日数(17日以上)の条件は判定対象外としています。等級表は東京都情報サービス産業健康保険組合(TJK)令和8年度の健康保険 標準報酬月額等級表(全50等級)を使用しています。
    </p>
  `;
}

switchTab("dashboard");
