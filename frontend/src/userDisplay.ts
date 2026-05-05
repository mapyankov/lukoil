export const DISPLAY_USER_NAME = "Михаил Пьянков";

/** Ключ login в sessionStorage (должен совпадать с App при авторизации). */
export const AUTH_LOGIN_KEY = "lukoil_demo_login";

/** Подпись для журнала: ФИО и логин учётной записи, если сессия есть. */
export function getCurrentUserForEventLog(): string {
  if (typeof sessionStorage === "undefined") {
    return DISPLAY_USER_NAME;
  }
  const login = sessionStorage.getItem(AUTH_LOGIN_KEY);
  if (login && login.trim()) {
    return `${DISPLAY_USER_NAME} (${login})`;
  }
  return DISPLAY_USER_NAME;
}
