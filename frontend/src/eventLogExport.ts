import * as XLSX from "xlsx";
import { formatEventTime, type SystemEvent } from "./eventLog";

/**
 * Сохраняет текущий журнал в .xlsx (открывается в Excel, LibreOffice и т.д.).
 */
export function downloadEventLogAsExcel(rows: SystemEvent[]): void {
  const header = ["Время", "Пользователь", "Действие", "Детали"];
  const aoa: (string | number)[][] = [
    header,
    ...rows.map((ev) => [
      formatEventTime(ev.ts),
      ev.user ?? "—",
      ev.action,
      (ev.detail ?? "—").replace(/\r\n/g, "\n")
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 20 }, { wch: 36 }, { wch: 40 }, { wch: 64 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "События");
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileName = `zhurnal_sobytiy_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
