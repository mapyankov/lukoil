import * as XLSX from "xlsx";
import type { IncidentScenarioReport } from "./buildIncidentReport";
import { formatEventTime } from "./eventLog";

/**
 * Экспорт отфильтрованных инцидентов в .xlsx (Excel и совместимые программы).
 */
export function downloadIncidentReportsAsExcel(reports: IncidentScenarioReport[]): void {
  const header = ["Время начала", "Заголовок инцидента", "Этап", "Канал", "Детали"];
  const aoa: (string | number)[][] = [header];

  for (const r of reports) {
    const timeStr = formatEventTime(r.startedAt);
    for (const phase of r.phases) {
      for (const ch of phase.channels) {
        aoa.push([
          timeStr,
          r.title,
          phase.title,
          ch.title,
          String(ch.detail ?? "").replace(/\r\n/g, "\n")
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 20 }, { wch: 42 }, { wch: 38 }, { wch: 36 }, { wch: 72 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Инциденты");

  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileName = `otchet_incidenty_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
