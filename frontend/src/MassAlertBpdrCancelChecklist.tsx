import { useCallback, useId, useMemo, useState } from "react";

type CheckSection = {
  title: string;
  items: { id: string; lines: readonly string[] }[];
};

const CANCEL_SECTIONS: readonly CheckSection[] = [
  {
    title: "1. Подтверждение",
    items: [
      { id: "bpdc-1-1", lines: ["Установить источник"] },
      { id: "bpdc-1-2", lines: ["Проверить подлинность"] },
      { id: "bpdc-1-3", lines: ["Подтвердить по телефону"] }
    ]
  },
  {
    title: "2. Оповещение",
    items: [
      {
        id: "bpdc-2-1",
        lines: ["Запустить ЛСО:", "«ОТБОЙ УГРОЗЫ БПЛА»"]
      },
      {
        id: "bpdc-2-2",
        lines: ["Дать команду ЛУКОМ-А на отключение РЭБ"]
      },
      {
        id: "bpdc-2-3",
        lines: ["Дублировать оповещение (прил. №2)"]
      },
      {
        id: "bpdc-2-4",
        lines: ["Оповестить руководство (список Часть 1)"]
      },
      {
        id: "bpdc-2-5",
        lines: ["Сообщить в ДК «Нефтехимиков»"]
      }
    ]
  },
  {
    title: "3. Связь и уведомления",
    items: [
      {
        id: "bpdc-3-1",
        lines: [
          "Запустить:",
          "СМС",
          "мессенджер («Отбой угрозы»)"
        ]
      },
      {
        id: "bpdc-3-2",
        lines: ["Перевести радиостанцию на канал диспетчера"]
      }
    ]
  },
  {
    title: "4. Взаимодействие",
    items: [
      {
        id: "bpdc-4-1",
        lines: ["Сообщить во второй источник (ЦДУ / ЕДДС)"]
      },
      {
        id: "bpdc-4-2",
        lines: ["Сообщить в Т Плюс об отключении РЭБ"]
      }
    ]
  },
  {
    title: "5. Организационные действия",
    items: [
      {
        id: "bpdc-5-1",
        lines: [
          "Направить транспорт:",
          "доставка персонала ЦЗЛ (ЗСГО №7 → ТСП)"
        ]
      },
      {
        id: "bpdc-5-2",
        lines: ["Организовать сбор информации об обстановке"]
      },
      { id: "bpdc-5-3", lines: ["Доложить руководству"] }
    ]
  },
  {
    title: "6. Завершение",
    items: [
      {
        id: "bpdc-6-1",
        lines: ["Действовать по фактической обстановке"]
      },
      {
        id: "bpdc-6-2",
        lines: ["Восстановить нормальный режим работы"]
      }
    ]
  }
];

/** Чек-лист отмены угрозы БПЛА на экране «Отмена оповещения». */
export default function MassAlertBpdrCancelChecklist() {
  const baseId = useId();
  const allIds = useMemo(
    () => CANCEL_SECTIONS.flatMap((s) => s.items.map((i) => i.id)),
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
        ЧЕК-ЛИСТ ПРИ ОТМЕНЕ УГРОЗЫ БПЛА
      </h2>
      <div className="mass-bpdr-checklist__body">
        {CANCEL_SECTIONS.map((section) => (
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
