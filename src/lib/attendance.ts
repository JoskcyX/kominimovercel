// Builds class attendance files (.xlsx and .csv) in the browser.
export type AttendanceRow = {
  name: string;
  identifier: string;
  status: string;
  minutes: number;
  percent: number;
  joinedAt: string | null;
  lastSeenAt: string | null;
  leftAt: string | null;
};

export type AttendanceExport = {
  platform: string;
  classTitle: string;
  subject: string;
  classCode: string;
  classDate: Date;
  idLabel: string;
  threshold: number;
  sessionMinutes: number;
  rows: AttendanceRow[];
};

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : "");
const longDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

function sheetData(o: AttendanceExport): (string | number)[][] {
  const attended = o.rows.filter((r) => r.status === "Attended").length;
  return [
    [`${o.platform} — Class attendance`],
    ["Class", o.classTitle],
    ...(o.subject ? [["Subject", o.subject]] : []),
    ["Class code", o.classCode],
    ["Date of class", longDate(o.classDate)],
    ["Class length (minutes)", o.sessionMinutes],
    ["Attended means", `In the live class for at least ${o.threshold}% of it`],
    ["Attended", `${attended} of ${o.rows.length}`],
    [],
    ["#", "Name", o.idLabel, "Status", "Minutes in class", "% of class", "Joined class", "Last seen live", "Left live class"],
    ...o.rows.map((r, i) => [i + 1, r.name, r.identifier, r.status, r.minutes, `${r.percent}%`, fmt(r.joinedAt), fmt(r.lastSeenAt), fmt(r.leftAt)]),
  ];
}

const HEADER_INDEX = (o: AttendanceExport) => (o.subject ? 9 : 8);

export async function buildAttendanceXlsx(o: AttendanceExport): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");
  sheetData(o).forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true, size: 14 };
  const header = ws.getRow(HEADER_INDEX(o) + 1);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7D9" } }; });
  [24, 28, 22, 18, 16, 12, 22, 22, 22].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildAttendanceCsv(o: AttendanceExport): string {
  return sheetData(o).map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
