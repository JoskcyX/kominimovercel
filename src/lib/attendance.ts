// Builds the class attendance spreadsheet (.xlsx) in the browser.
export type AttendanceRow = {
  name: string;
  identifier: string;
  status: string;
  joinedAt: string | null;
  lastSeenAt: string | null;
  leftAt: string | null;
};

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : "");

export async function buildAttendanceXlsx(opts: {
  platform: string;
  classTitle: string;
  subject: string;
  classCode: string;
  classDate: Date;
  idLabel: string;
  rows: AttendanceRow[];
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");
  ws.addRow([`${opts.platform} — Class attendance`]).font = { bold: true, size: 14 };
  ws.addRow(["Class", opts.classTitle]);
  if (opts.subject) ws.addRow(["Subject", opts.subject]);
  ws.addRow(["Class code", opts.classCode]);
  ws.addRow(["Date of class", opts.classDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })]);
  ws.addRow(["Present", `${opts.rows.filter((r) => r.status === "Present").length} of ${opts.rows.length}`]);
  ws.addRow([]);
  const header = ws.addRow(["#", "Name", opts.idLabel, "Status", "Joined class", "Last seen live", "Left live class"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7D9" } }; });
  opts.rows.forEach((r, i) => ws.addRow([i + 1, r.name, r.identifier, r.status, fmt(r.joinedAt), fmt(r.lastSeenAt), fmt(r.leftAt)]));
  [6, 28, 22, 18, 22, 22, 22].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.getColumn(1).alignment = { horizontal: "left" };
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
