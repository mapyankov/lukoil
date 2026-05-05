import { useCallback, useId, useMemo, useState } from "react";

type CheckSection = {
  title: string;
  items: { id: string; lines: readonly string[] }[];
};

const BPDR_SECTIONS: readonly CheckSection[] = [
  {
    title: "1. Получение информации",
    items: [
      {
        id: "bpdr-1-1",
        lines: ["Установить источник (ЦДУ ЛУКОЙЛ-Технологии / ЕДДС Кстовского МО)"]
      },
      { id: "bpdr-1-2", lines: ["Проверить подлинность информации"] },
      {
        id: "bpdr-1-3",
        lines: [
          "Подтвердить получение:",
          "ЦДУ: (495) 627-88-16 / 627-88-17",
          "ЕДДС: (9) 2-48-41 / 2-48-40"
        ]
      }
    ]
  },
  {
    title: "2. Немедленное оповещение",
    items: [
      {
        id: "bpdr-2-1",
        lines: [
          "Запустить ЛСО:",
          "Сигнал: «ВНИМАНИЕ ВСЕМ»",
          "Сообщение: «УГРОЗА ПРИМЕНЕНИЯ БПЛА… УКРЫТЬСЯ…»"
        ]
      },
      {
        id: "bpdr-2-2",
        lines: ["Дать команду ЛУКОМ-А на включение РЭБ (39-36, +79050110488)"]
      },
      {
        id: "bpdr-2-3",
        lines: ["Дублировать оповещение по телефону (список приложение №2)"]
      },
      {
        id: "bpdr-2-4",
        lines: [
          "Оповестить руководство (по телефону / мессенджеру):",
          "источник, время, ожидаемое время прилёта"
        ]
      },
      {
        id: "bpdr-2-5",
        lines: [
          "Запустить:",
          "СМС-оповещение",
          "сообщение в группе «Нестандартные ситуации»"
        ]
      },
      {
        id: "bpdr-2-6",
        lines: ["Перевести радиостанцию на канал «ГОЧС»"]
      }
    ]
  },
  {
    title: "3. Информирование сторонних организаций",
    items: [
      {
        id: "bpdr-3-1",
        lines: [
          "Сообщить во второй источник:",
          "если от ЕДДС → в ЦДУ",
          "если от ЦДУ → в ЕДДС"
        ]
      },
      {
        id: "bpdr-3-2",
        lines: [
          "Сообщить в Т Плюс о включении РЭБ:",
          "(9) 2-67-52 / 9-83-52 / 5-38-31"
        ]
      }
    ]
  },
  {
    title: "4. Координация и мониторинг",
    items: [
      {
        id: "bpdr-4-1",
        lines: [
          "Проверить связь с «РАДАР»:",
          "телефон 38-65",
          "радиоканал «ГОЧС»"
        ]
      },
      {
        id: "bpdr-4-2",
        lines: ["Получать обновления (не реже 1 раза в 30 мин)"]
      },
      {
        id: "bpdr-4-3",
        lines: [
          "Докладывать об ухудшении:",
          "дежурному руководителю",
          "дежурному от ИТР"
        ]
      }
    ]
  },
  {
    title: "5. Управление персоналом",
    items: [
      {
        id: "bpdr-5-1",
        lines: [
          "Организовать учет укрываемых:",
          "место",
          "подразделение",
          "количество"
        ]
      }
    ]
  },
  {
    title: "6. Управление технологией",
    items: [
      {
        id: "bpdr-6-1",
        lines: [
          "Определить критичные операции:",
          "слив/налив",
          "переключения",
          "пуск/останов",
          "СУГ/нефтепродукты"
        ]
      },
      { id: "bpdr-6-2", lines: ["Принять меры по снижению рисков"] },
      { id: "bpdr-6-3", lines: ["Доложить, если операции > 20 минут"] }
    ]
  },
  {
    title: "7. Постоянный контроль",
    items: [
      {
        id: "bpdr-7-1",
        lines: ["Вести мониторинг ситуации по предприятию"]
      },
      {
        id: "bpdr-7-2",
        lines: ["Докладывать при рисках срыва процессов"]
      }
    ]
  },
  {
    title: "8. Дополнительные действия",
    items: [
      {
        id: "bpdr-8-1",
        lines: ["В 06:00 сообщить в ДК «Нефтехимиков» (9-7-97-58)"]
      },
      {
        id: "bpdr-8-2",
        lines: [
          "Выполнять указания главного инженера (пусконаладка/срочные работы)"
        ]
      }
    ]
  }
];

/** Чек-лист для сценария «угроза применения БПЛА» на экране массового оповещения. */
export default function MassAlertBpdrChecklist() {
  const baseId = useId();
  const allIds = useMemo(
    () => BPDR_SECTIONS.flatMap((s) => s.items.map((i) => i.id)),
    []
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <section
      className="mass-bpdr-checklist"
      aria-labelledby={`${baseId}-title`}
    >
      <h2 className="mass-bpdr-checklist__title" id={`${baseId}-title`}>
        ЧЕК-ЛИСТ ДЕЙСТВИЙ ПРИ УГРОЗЕ ПРИМЕНЕНИЯ БПЛА
      </h2>
      <div className="mass-bpdr-checklist__body">
        {BPDR_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="mass-bpdr-checklist__group"
            aria-label={section.title}
          >
            <h3 className="mass-bpdr-checklist__group-title">{section.title}</h3>
            <ul className="mass-bpdr-checklist__list" role="list">
              {section.items.map((item) => {
                const cid = `${baseId}-${item.id}`;
                return (
                  <li key={item.id} className="mass-bpdr-checklist__item">
                    <label className="mass-bpdr-checklist__label" htmlFor={cid}>
                      <input
                        id={cid}
                        className="mass-bpdr-checklist__input"
                        type="checkbox"
                        checked={checked[item.id] ?? false}
                        onChange={() => toggle(item.id)}
                      />
                      <span className="mass-bpdr-checklist__text">
                        {item.lines.map((line, i) => (
                          <span
                            key={`${item.id}-${i}`}
                            className={
                              i === 0
                                ? "mass-bpdr-checklist__line mass-bpdr-checklist__line--main"
                                : "mass-bpdr-checklist__line mass-bpdr-checklist__line--sub"
                            }
                          >
                            {line}
                          </span>
                        ))}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mass-bpdr-checklist__footer" aria-live="polite">
        Отмечено: {allIds.filter((id) => checked[id]).length} из {allIds.length}
      </p>
    </section>
  );
}
