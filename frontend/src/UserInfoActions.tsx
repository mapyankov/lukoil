import { useNavigate } from "react-router-dom";
import { appendEvent } from "./eventLog";

type UserInfoActionsProps = {
  onLogout: () => void;
  /** Скрыть блок кнопок (на отдельных экранах, например запись по нештатке). */
  hidden?: boolean;
};

/** Кнопки «Настройки» и «Выйти» в шапке (пиктограммы). */
export default function UserInfoActions({
  onLogout,
  hidden = false
}: UserInfoActionsProps) {
  const navigate = useNavigate();

  if (hidden) {
    return null;
  }

  return (
    <div className="user-info__actions">
      <button
        type="button"
        className="settings-icon-btn"
        onClick={() => {
          appendEvent("Переход к экрану", "Настройки");
          navigate("/settings");
        }}
        aria-label="Настройки"
        title="Настройки"
      >
        <svg
          className="settings-icon-btn__svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden={true}
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.8a.483.483 0 0 0-.48-.4h-3.84c-.24 0-.43.17-.48.4l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.08.48.12.64l2.03 1.58c-.05.3-.09.64-.09.97s.02.68.08.99l-2.03 1.59a.49.49 0 0 0-.12.6l1.92 3.32c.12.22.38.3.6.22l2.38-.95c.5.4 1.04.7 1.64.95l.36 2.55c.05.24.25.4.48.4h3.85c.24 0 .44-.16.5-.4l.36-2.55c.59-.25 1.12-.55 1.65-.95l2.38.95c.22.08.48 0 .6-.22l1.92-3.32a.488.488 0 0 0-.12-.6l-2.01-1.6zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"
          />
        </svg>
      </button>
      <button
        type="button"
        className="logout-btn logout-btn--icon"
        onClick={onLogout}
        aria-label="Выйти"
        title="Выйти"
      >
        <svg
          className="logout-btn__svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden={true}
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
          />
        </svg>
      </button>
    </div>
  );
}
