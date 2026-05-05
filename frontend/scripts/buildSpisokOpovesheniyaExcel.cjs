/* Генерация .xlsx по форме «Список оповещения дежурного персонала…» (Приложение №2). */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "..", "exports");
const outFile = path.join(
  outDir,
  "Spisok_opovesheniya_dejurnogo_personala.xlsx"
);

const mainTitle =
  "СПИСОК оповещения дежурного (сменного) персонала предприятия и сервисных организаций начальниками смен ЦУП";
const appendix =
  "Приложение №2 к Инструкции по действиям работников при объявлении ракетной опасности и получении информации об угрозе и в условиях угрозы применения БПЛА";
const footerNote = "+ операторная тех. объектов.";

const rows = [
  { section: "Начальник смены ЦУП (ПМТ)", no: 1, title: "Начальник смены ЦЗЛ", phone: "48-10" },
  { section: "Начальник смены ЦУП (ПМТ)", no: 2, title: "Диспетчер ГСО", phone: "39-37, 31-43" },
  { section: "Начальник смены ЦУП (ПМТ)", no: 3, title: "Мастер ПОТУ", phone: "39-35" },
  {
    section: "Начальник смены ЦУП (ПМТ)",
    no: 4,
    title: "Диспетчер ЦППС ФГБУ 3 ОФПС",
    phone: "39-39"
  },
  {
    section: "Начальник смены ЦУП (ПКК)",
    no: 5,
    title: "Дежурный фельдшер ООО «МЕДИС»",
    phone: "39-33, 8-920-050-09-35"
  },
  {
    section: "Начальник смены ЦУП (ПКК)",
    no: 6,
    title:
      "Начальник смены цеха оперативно-технологического управления энергоснабжением",
    phone: "39-11, 32-32"
  },
  {
    section: "Начальник смены ЦУП (ПКК)",
    no: 7,
    title:
      "Начальник смены ОДС цеха №3 теплоснабжения Кстовское ТПУ ООО «Инфраструктура ТК»",
    phone: "39-12"
  },
  { section: "Начальник смены ЦУП (ПКК)", no: 8, title: "Диспетчер ООО «ЭКОИН-НОРСИ»", phone: "39-13" },
  { section: "Начальник смены ЦУП (отгрузка)", no: 9, title: "Диспетчер ООО «ЛУКОЙЛ-Транс»", phone: "39-94" },
  { section: "Начальник смены ЦУП (отгрузка)", no: 10, title: "Диспетчер ООО «СГК»", phone: "37-58" },
  {
    section: "Начальник смены ЦУП (отгрузка)",
    no: 11,
    title: "Диспетчер Центра отгрузки (ст. Зелецино)",
    phone: "32-29"
  },
  {
    section: "Начальник смены ЦУП (отгрузка)",
    no: 12,
    title: "Дежурный ООО «Инфраструктура ТК»",
    phone: "55-29 (АСУТП), 31-90 (КИП)"
  },
  {
    section: "Начальник смены ЦУП (отгрузка)",
    no: 13,
    title: "Дежурный пост ООО «СНЭМА-СЕРВИС»",
    phone: "8-902-712-54-70"
  }
];

const aoa = [
  [mainTitle],
  [appendix],
  [],
  ["Раздел", "№ п/п", "Должностное лицо", "Номер телефона"],
  ...rows.map((r) => [r.section, r.no, r.title, r.phone]),
  [],
  [footerNote]
];

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = [{ wch: 38 }, { wch: 8 }, { wch: 56 }, { wch: 36 }];

if (!ws["!merges"]) {
  ws["!merges"] = [];
}
ws["!merges"].push(
  { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }
);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Список");

fs.mkdirSync(outDir, { recursive: true });
XLSX.writeFile(wb, outFile);
console.log("Wrote", outFile);
