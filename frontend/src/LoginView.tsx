import { FormEvent, useState } from "react";
import { appendEvent } from "./eventLog";

type LoginViewProps = {
  onLogin: (login: string) => void;
};

export default function LoginView({ onLogin }: LoginViewProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedLogin = login.trim();
    const trimmedPassword = password.trim();
    if (!trimmedLogin || !trimmedPassword) {
      appendEvent(
        "Попытка входа",
        "Отклонено: не заполнены логин или пароль"
      );
      setFormError("Введите логин и пароль.");
      return;
    }
    setFormError("");
    onLogin(trimmedLogin);
  };

  return (
    <div className="app-shell">
      <header className="login-hero">
        <div className="hero__brand-wrap">
          <img src="/logo.jpg" alt="Логотип ЛУКОЙЛ" className="hero__logo" />
        </div>
        <h1 className="login-hero__title">Вход в систему</h1>
        <p className="login-hero__lead">
          Укажите учётные данные для доступа к сервису.
        </p>
      </header>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login">
              Логин
            </label>
            <input
              id="login"
              className="login-input"
              type="text"
              name="username"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              className="login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {formError && <p className="login-form-error">{formError}</p>}
          <button className="login-submit" type="submit">
            Войти
          </button>
        </form>
      </main>
    </div>
  );
}
