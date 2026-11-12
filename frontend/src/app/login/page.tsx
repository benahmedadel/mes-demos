"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LOCALES, STRINGS, useLocale } from "../i18n";
import { PixelField } from "../pixel-field";
import { withBase } from "@/lib/base-path";

// La page de connexion reprend l'accueil : la mosaique en fond, le logo, le
// selecteur de langue, et une seule carte au centre.

function LoginForm() {
  const params = useSearchParams();
  const [locale, setLocale] = useLocale();
  const t = STRINGS[locale].login;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(withBase("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? t.invalid : t.unavailable);
        return;
      }
      // Seule une destination interne est suivie : un `next` externe serait
      // une redirection ouverte.
      const next = params.get("next") ?? "/";
      window.location.assign(withBase(next.startsWith("/") && !next.startsWith("//") ? next : "/"));
    } catch {
      setError(t.unavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ac-login">
      <PixelField active={isSubmitting} theme="light" />
      <header className="ac-login-top">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local servi tel quel */}
        <img src={withBase("/logo.svg")} alt="Arcantel SA" />
        <div className="ac-lang ac-lang--dark" role="group" aria-label={STRINGS[locale].language}>
          {LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === locale ? "is-active" : ""}
              aria-pressed={item.id === locale}
              title={item.name}
              lang={item.htmlLang}
              onClick={() => setLocale(item.id)}
            >
              {item.short}
            </button>
          ))}
        </div>
      </header>

      <main className="ac-login-main">
        <form className="ac-login-card" onSubmit={handleSubmit}>
          <p className="ac-kicker">{STRINGS[locale].kicker}</p>
          <h1>{t.title}</h1>
          <p className="ac-login-lead">{t.lead}</p>

          <label className="ac-field">
            <span>{t.username}</span>
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="ac-field">
            <span>{t.password}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <p className="ac-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="ac-login-submit" disabled={isSubmitting || !username || !password}>
            {isSubmitting ? t.submitting : t.submit}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
