import { getAccessToken } from "./googleAuth";

export interface Env {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_KEY: string;
  SHEET_ID_EMPLOYEES: string;
  SHEET_ID_PAYROLL_RECORDS: string;
  SHEET_ID_JUDGMENT_RESULTS: string;
  SHEET_ID_GRADE_TABLE: string;
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function authHeaders(env: Env): Promise<HeadersInit> {
  const token = await getAccessToken(env);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Sheet1の全データを、1行目をヘッダーとしたオブジェクトの配列として読み込む。 */
export async function readTable(env: Env, spreadsheetId: string): Promise<Record<string, string>[]> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Sheet1`, {
    headers: await authHeaders(env),
  });
  if (!res.ok) {
    throw new Error(`スプレッドシートの読み込みに失敗しました(${spreadsheetId}): ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const [header, ...rows] = data.values ?? [[]];
  if (!header) return [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? "";
    });
    return obj;
  });
}

/** Sheet1の末尾に1行追記する(列の並びはheaderで指定した順序)。 */
export async function appendRow(env: Env, spreadsheetId: string, header: string[], row: Record<string, string | number>): Promise<void> {
  const values = [header.map((key) => String(row[key] ?? ""))];
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Sheet1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: await authHeaders(env),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`スプレッドシートへの追記に失敗しました(${spreadsheetId}): ${res.status} ${await res.text()}`);
  }
}

/** Sheet1全体(ヘッダー行含む)を指定した行データで置き換える。アップサート処理などで使う。 */
export async function overwriteTable(env: Env, spreadsheetId: string, header: string[], rows: Record<string, string | number>[]): Promise<void> {
  const values = [header, ...rows.map((row) => header.map((key) => String(row[key] ?? "")))];
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/Sheet1?valueInputOption=RAW`, {
    method: "PUT",
    headers: await authHeaders(env),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`スプレッドシートの更新に失敗しました(${spreadsheetId}): ${res.status} ${await res.text()}`);
  }
}
