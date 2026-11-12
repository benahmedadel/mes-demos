"use client";

import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isPublicUrl, sourceLabel } from "./conversation";
import type { ChatMessage, Citation, Confidence, FeedbackRating, MessageRole, Source } from "./conversation";
import { EXPORT_FORMATS, exportConversation } from "./export";
import type { ExportFormat } from "./export";
import { LOCALES, STRINGS, answerLanguageFor, useLocale } from "./i18n";
import type { Strings } from "./i18n";
import { PixelField } from "./pixel-field";
import { withBase } from "@/lib/base-path";

type ChatApiResponse = {
  session_id: string;
  answer: string;
  confidence: Confidence;
  citations: Citation[];
  sources: Source[];
  interaction_id?: number;
};

type SessionHistoryMessage = {
  role: MessageRole;
  content: string;
  created_at: string;
  interaction_id?: number | null;
  feedback?: FeedbackRating | null;
  // Restored with the message so a reloaded conversation keeps showing what
  // each answer was based on, instead of silently dropping every panel.
  citations?: Citation[];
  sources?: Source[];
};

type SessionHistoryResponse = {
  session_id: string;
  summary: string;
  messages: SessionHistoryMessage[];
};

type Connection = "init" | "online" | "busy" | "offline";

type Theme = "dark" | "light";

// Ce que la page affiche quand quelque chose echoue : une reponse qui ne vient
// pas (on peut reessayer) ou un export qui casse (on ne reessaie pas la
// question pour autant).
type Notice = { title: string; detail: string; canRetry: boolean };

function sourcePath(source: Source): string {
  try {
    const url = new URL(source.canonical_url);
    return url.pathname === "/" ? "accueil" : url.pathname.replace(/^\/|\/$/g, "");
  } catch {
    return "";
  }
}

const CHAT_API_URL = withBase("/api/chat");
const SESSION_API_URL = withBase("/api/session");
const FEEDBACK_API_URL = withBase("/api/feedback");
const SESSION_STORAGE_KEY = "ac_chat_session_id";
const THEME_STORAGE_KEY = "ac_theme";
const THEME_EVENT = "ac-theme-change";

// Quatre carres pleins pour une reponse sure, un seul pour une reponse fragile.
const CONFIDENCE_LEVEL: Record<Confidence, number> = { high: 4, medium: 2, low: 1 };

// Le panneau n'a pas de defilement propre : trois sources suffisent a situer
// une reponse, la liste complete reste sous le message.
const PANEL_SOURCE_LIMIT = 3;

// Le menu d'arcantel.ch, dans son ordre : l'assistant s'y presente comme une
// rubrique de plus, pas comme un site a part.
const SITE_NAV: { key: keyof Strings["nav"]; href: string }[] = [
  { key: "news", href: "https://www.arcantel.ch/actualites/" },
  { key: "services", href: "https://www.arcantel.ch/services/" },
  { key: "references", href: "https://www.arcantel.ch/references/" },
  { key: "company", href: "https://www.arcantel.ch/la-societe/a-notre-sujet/" },
  { key: "contact", href: "https://www.arcantel.ch/contact/" },
];

// Le texte du message d'accueil est pose au rendu, dans la langue courante :
// il change de langue avec l'interface sans toucher a l'etat.
const WELCOME_ID = "welcome";
const INITIAL_MESSAGE: ChatMessage = { id: WELCOME_ID, role: "assistant", text: "" };

// ---------------------------------------------------------------------------
// Theme : la valeur vit sur <html data-theme>, posee avant le premier rendu
// par le script du layout. Le composant s'y abonne au lieu de la dupliquer
// dans un state, ce qui evite a la fois le flash et le setState dans un effet.
// ---------------------------------------------------------------------------

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeTheme(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privee) : le theme vaut pour la page.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);
  return [theme, toggle];
}

// ---------------------------------------------------------------------------
// Icones
// ---------------------------------------------------------------------------

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.4 14.2A8.4 8.4 0 0 1 9.8 3.6a8.4 8.4 0 1 0 10.6 10.6z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconThumbUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v11" />
      <path d="M3 12v7a2 2 0 0 0 2 2h2V10H5a2 2 0 0 0-2 2z" />
      <path d="M7 10l4.2-7a2.1 2.1 0 0 1 2 2.6L12.5 9H19a2 2 0 0 1 1.9 2.6l-2 7a2 2 0 0 1-1.9 1.4H7" />
    </svg>
  );
}

function IconThumbDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V3" />
      <path d="M21 12V5a2 2 0 0 0-2-2h-2v11h2a2 2 0 0 0 2-2z" />
      <path d="M17 14l-4.2 7a2.1 2.1 0 0 1-2-2.6l.7-3.4H5a2 2 0 0 1-1.9-2.6l2-7A2 2 0 0 1 7 4h10" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M18 13l-6 6-6-6" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 8l5 4-5 4" />
      <path d="M20 12H9" />
    </svg>
  );
}

// Fin de session : le cookie est efface cote serveur, puis retour a la page
// de connexion. L'etat local (langue, theme) reste, il appartient au poste.
async function logout(): Promise<void> {
  try {
    await fetch(withBase("/api/auth/logout"), { method: "POST" });
  } finally {
    window.location.assign(withBase("/login"));
  }
}

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

// Les quatre carres du logo Arcantel : gris, cyan, vide, noir.
function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`ac-mark ${className}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connection, setConnection] = useState<Connection>("init");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<Notice | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [theme, toggleTheme] = useTheme();
  const [locale, setLocale] = useLocale();
  const t = STRINGS[locale];

  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const exportMenuRef = useRef<HTMLDetailsElement | null>(null);
  const isNearBottomRef = useRef(true);

  // L'accueil ne montre que le message de bienvenue ; des que la conversation
  // a un echange, la page bascule en mode fil de discussion.
  const hasConversation = messages.some((message) => message.role === "user");
  const mode = hasConversation ? "chat" : "empty";

  const displayMessages = useMemo(
    () => messages.map((message) => (message.id === WELCOME_ID ? { ...message, text: t.welcome } : message)),
    [messages, t],
  );

  const lastAssistant = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.sources && message.sources.length > 0),
    [messages],
  );

  const canSend = input.trim().length > 0 && !isLoading;

  const handleThreadScroll = useCallback(() => {
    const container = threadRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
    setShowScrollButton(distanceFromBottom > 320);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = threadRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  useEffect(() => {
    const container = threadRef.current;
    // L'accueil ne suit jamais le bas : sinon ce defilement et celui qui ramene
    // l'accroche en haut se disputent la meme image.
    if (!container || !isNearBottomRef.current || mode === "empty") {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, isLoading, mode]);

  // Au retour a l'accueil, la zone centrale garderait sinon la position de
  // defilement de la conversation precedente et montrerait l'accueil par son
  // pied. Apres le commit, quand le nouveau contenu est en place.
  useEffect(() => {
    if (mode === "empty") {
      threadRef.current?.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [mode]);

  useEffect(() => {
    void initializeSession(setSessionId, setMessages, setConnection);
  }, []);

  // "/" amene le curseur dans le composeur, comme sur la plupart des outils
  // de recherche, sans voler la frappe quand on ecrit deja quelque part.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      composerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Le menu d'export se referme quand on clique ailleurs, comme tout menu.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const menu = exportMenuRef.current;
      if (menu && menu.open && !menu.contains(event.target as Node)) {
        menu.open = false;
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const resizeComposer = useCallback(() => {
    const textarea = composerRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    // L'ascenseur n'apparait qu'une fois le plafond atteint ; avant, il ne
    // ferait que trahir le demi-pixel d'ecart entre rows=1 et le placeholder.
    textarea.style.overflowY = textarea.scrollHeight > 180 ? "auto" : "hidden";
  }, []);

  const sendMessage = useCallback(
    async (rawPrompt: string) => {
      const prompt = rawPrompt.trim();
      if (!prompt || isLoading) {
        return;
      }

      let activeSessionId = sessionId;
      if (!activeSessionId) {
        try {
          activeSessionId = await createSession();
          setSessionId(activeSessionId);
          persistSessionId(activeSessionId);
        } catch {
          setConnection("offline");
          setError({ title: t.errors.sendTitle, detail: t.errors.sendDetail, canRetry: true });
          return;
        }
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: prompt,
      };

      isNearBottomRef.current = true;
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setError(null);
      setLastPrompt(prompt);
      setIsLoading(true);
      setConnection("busy");
      window.requestAnimationFrame(resizeComposer);

      try {
        const response = await queryBackend(prompt, activeSessionId, answerLanguageFor(locale), t.errors);
        if (response.session_id !== activeSessionId) {
          setSessionId(response.session_id);
          persistSessionId(response.session_id);
        }

        const botMessageId = crypto.randomUUID();
        const botMessage: ChatMessage = {
          id: botMessageId,
          role: "assistant",
          text: "",
          confidence: response.confidence,
          citations: response.citations,
          sources: response.sources,
          interactionId: response.interaction_id,
          feedback: null,
        };

        setMessages((prev) => [...prev, botMessage]);
        await streamAssistantAnswer(botMessageId, response.answer, setMessages);
        setConnection("online");
      } catch (caught) {
        setError({
          title: t.errors.answerTitle,
          detail: caught instanceof Error && caught.message ? caught.message : t.errors.unexpected,
          canRetry: true,
        });
        setConnection("online");
      } finally {
        setIsLoading(false);
        composerRef.current?.focus();
      }
    },
    [isLoading, sessionId, resizeComposer, t, locale],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  const handleFeedback = useCallback(
    async (messageId: string, interactionId: number, rating: FeedbackRating) => {
      let nextRating: FeedbackRating | null = rating;

      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          // Clicking the active rating again withdraws the feedback.
          nextRating = message.feedback === rating ? null : rating;
          return { ...message, feedback: nextRating };
        }),
      );

      try {
        await sendFeedback(interactionId, nextRating);
      } catch {
        setMessages((prev) =>
          prev.map((message) => (message.id === messageId ? { ...message, feedback: null } : message)),
        );
      }
    },
    [],
  );

  async function resetConversation() {
    setError(null);
    setLastPrompt(null);
    try {
      const newSessionId = await createSession();
      setSessionId(newSessionId);
      persistSessionId(newSessionId);
      setConnection("online");
    } catch {
      setConnection("offline");
    }
    setMessages([INITIAL_MESSAGE]);
    composerRef.current?.focus();
  }

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (exportMenuRef.current) {
        exportMenuRef.current.open = false;
      }
      setExporting(format);
      try {
        await exportConversation(format, displayMessages, { strings: t, locale });
      } catch (caught) {
        setError({
          title: t.errors.exportTitle,
          detail: caught instanceof Error && caught.message ? caught.message : t.errors.unexpected,
          canRetry: false,
        });
      } finally {
        setExporting(null);
      }
    },
    [displayMessages, t, locale],
  );

  const askAboutArea = useCallback(
    (area: string) => {
      void sendMessage(t.areaQuestion(area));
    },
    [sendMessage, t],
  );

  return (
    <div className="ac-app" data-mode={mode}>
      <PixelField active={isLoading} theme={theme} />

      <header className="ac-top">
        <a className="ac-brand" href="https://www.arcantel.ch/" target="_blank" rel="noreferrer" title="arcantel.ch">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local servi tel quel */}
          <img src={withBase("/logo.svg")} alt="Arcantel SA" />
        </a>

        <nav className="ac-nav" aria-label="arcantel.ch">
          {SITE_NAV.map((item) => (
            <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
              {t.nav[item.key]}
            </a>
          ))}
          <span className="is-current" aria-current="page">
            {t.nav.assistant}
          </span>
        </nav>

        {/* L'onglet cyan suspendu au bord superieur, comme le bloc des reseaux
            sociaux d'arcantel.ch : il porte l'etat, la langue et le theme. */}
        <div className="ac-topcap">
          <span className={`ac-status ac-status--${connection}`} role="status">
            <i aria-hidden />
            <span>{t.status[connection]}</span>
          </span>
          <div className="ac-lang" role="group" aria-label={t.language}>
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
          <button
            type="button"
            className="ac-cap-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t.theme.toLight : t.theme.toDark}
            title={theme === "dark" ? t.theme.toLight : t.theme.toDark}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="ac-cap-btn"
            onClick={() => void logout()}
            aria-label={t.login.logout}
            title={t.login.logout}
          >
            <IconLogout />
          </button>
        </div>
      </header>

      <main className="ac-stage">
        <section className="ac-column">
          {/* Le squelette ne bouge pas entre l'accueil et la conversation : seul
              le contenu de cette zone change, le composeur reste a sa place. */}
          <div className="ac-thread" ref={threadRef} onScroll={handleThreadScroll} aria-live="polite">
            <div className="ac-thread-inner">
              {mode === "empty" ? (
                <>
                  <div className="ac-hero">
                    <p className="ac-kicker">
                      <LogoMark />
                      {t.kicker}
                    </p>
                    <h1>
                      {t.hero.line1}
                      <br />
                      <strong>{t.hero.line2}</strong>
                    </h1>
                    <p className="ac-lead">{t.hero.lead}</p>
                  </div>

                  <div className="ac-suggestions">
                    {t.quickPrompts.map((item) => (
                      <button
                        key={item.prompt}
                        type="button"
                        className="ac-suggestion"
                        disabled={isLoading}
                        onClick={() => void sendMessage(item.prompt)}
                      >
                        <span className="ac-suggestion-title">{item.title}</span>
                        <span className="ac-suggestion-hint">{item.hint}</span>
                        <span className="ac-suggestion-prompt">{item.prompt}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {displayMessages.map((message) => (
                    <MessageItem key={message.id} message={message} onFeedback={handleFeedback} t={t} />
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === "user" ? <ThinkingRow label={t.thinking} /> : null}
                </>
              )}
            </div>
          </div>

          <div className="ac-composer-zone">
            {mode === "chat" && showScrollButton ? (
              <button type="button" className="ac-scroll-btn" onClick={scrollToBottom} aria-label={t.actions.scrollToEnd}>
                <IconArrowDown />
              </button>
            ) : null}

            {error ? (
              <div className="ac-error" role="alert">
                <div>
                  <strong>{error.title}</strong>
                  <p>{error.detail}</p>
                </div>
                {error.canRetry && lastPrompt ? (
                  <button type="button" className="ac-btn-ghost" onClick={() => void sendMessage(lastPrompt)}>
                    {t.errors.retry}
                  </button>
                ) : null}
              </div>
            ) : null}

            <form className={`ac-composer ${isLoading ? "is-busy" : ""}`} onSubmit={handleSubmit}>
              <label className="ac-sr-only" htmlFor="user-message">
                {t.composer.label}
              </label>
              <textarea
                id="user-message"
                ref={composerRef}
                value={input}
                rows={1}
                onChange={(event) => {
                  setInput(event.target.value);
                  resizeComposer();
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder={t.composer.placeholder}
                autoComplete="off"
                suppressHydrationWarning
              />
              <button type="submit" className="ac-send" disabled={!canSend} aria-label={t.composer.send}>
                <IconSend />
              </button>
            </form>

            {mode === "chat" ? (
              <div className="ac-composer-tools">
                <button
                  type="button"
                  className="ac-new-chat"
                  onClick={() => void resetConversation()}
                  disabled={isLoading}
                >
                  <IconPlus />
                  {t.tools.newChat}
                </button>

                <details className="ac-export" ref={exportMenuRef}>
                  <summary aria-label={t.tools.export}>
                    <IconDownload />
                    {exporting ? t.tools.exporting : t.tools.export}
                  </summary>
                  <ul className="ac-export-menu" role="menu" aria-label={t.tools.formats}>
                    {EXPORT_FORMATS.map((format) => (
                      <li key={format.id} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={exporting !== null}
                          onClick={() => void handleExport(format.id)}
                        >
                          <span className="ac-export-label">{format.label}</span>
                          <span className="ac-export-hint">{t.formats[format.id]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="ac-panel" aria-label={t.panel.context}>
          <SidePanel lastAnswer={lastAssistant} onAskArea={askAboutArea} disabled={isLoading} t={t} />
        </aside>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau lateral
// ---------------------------------------------------------------------------

function SidePanel({
  lastAnswer,
  onAskArea,
  disabled,
  t,
}: {
  lastAnswer: ChatMessage | undefined;
  onAskArea: (area: string) => void;
  disabled: boolean;
  t: Strings;
}) {
  return (
    <>
      <section className="ac-card">
        <h2 className="ac-card-title">{t.panel.lastAnswer}</h2>
        {lastAnswer && lastAnswer.sources?.length ? (
          <>
            {lastAnswer.confidence ? <ConfidenceMeter level={lastAnswer.confidence} t={t} /> : null}
            <ol className="ac-source-list">
              {lastAnswer.sources.slice(0, PANEL_SOURCE_LIMIT).map((source, index) => {
                const isPublic = isPublicUrl(source.canonical_url);
                const body = (
                  <>
                    <span className="ac-source-index">{index + 1}</span>
                    <span className="ac-source-body">
                      <span className="ac-source-title">{sourceLabel(source)}</span>
                      <span className="ac-source-path">
                        {isPublic ? `arcantel.ch / ${sourcePath(source)}` : t.panel.authored}
                        {isPublic ? <IconExternal /> : null}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={source.source_id}>
                    {isPublic ? (
                      <a href={source.canonical_url} target="_blank" rel="noreferrer" className="ac-source-card">
                        {body}
                      </a>
                    ) : (
                      <span className="ac-source-card">{body}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="ac-card-empty">{t.panel.lastAnswerEmpty}</p>
        )}
      </section>

      <section className="ac-card">
        <h2 className="ac-card-title">{t.panel.domains}</h2>
        <div className="ac-tags">
          {t.areas.map((area) => (
            <button key={area} type="button" className="ac-tag" disabled={disabled} onClick={() => onAskArea(area)}>
              {area}
            </button>
          ))}
        </div>
      </section>

      <section className="ac-card ac-card--contact">
        <h2 className="ac-card-title">{t.panel.company}</h2>
        <p>
          Faubourg du Lac 12
          <br />
          2000 Neuchâtel
        </p>
        <p>
          <a href="tel:+41323540150">+41 32 354 01 50</a>
          <br />
          <a href="mailto:info@arcantel.ch">info@arcantel.ch</a>
        </p>
        <a className="ac-card-link" href="https://www.arcantel.ch/" target="_blank" rel="noreferrer">
          {t.panel.visit}
          <IconExternal />
        </a>
      </section>
    </>
  );
}

function ConfidenceMeter({ level, t }: { level: Confidence; t: Strings }) {
  const filled = CONFIDENCE_LEVEL[level];
  return (
    <div className={`ac-confidence ac-confidence--${level}`} title={t.confidence[level]}>
      <span className="ac-confidence-squares" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <i key={index} className={index < filled ? "on" : ""} />
        ))}
      </span>
      <span>{t.confidence[level]}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function ThinkingRow({ label }: { label: string }) {
  return (
    <article className="ac-msg ac-msg--assistant">
      <LogoMark className="ac-msg-avatar" />
      <div className="ac-msg-body">
        <div className="ac-thinking" aria-label={label}>
          <span className="ac-thinking-squares" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          {label}
        </div>
      </div>
    </article>
  );
}

type FeedbackHandler = (messageId: string, interactionId: number, rating: FeedbackRating) => Promise<void>;

const COPY_RESET_DELAY_MS = 1600;
const CLIPBOARD_TIMEOUT_MS = 500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("clipboard timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const CopyButton = memo(function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    let succeeded = false;

    if (navigator.clipboard?.writeText) {
      try {
        // Bounded: some automated/embedded contexts leave this promise
        // pending forever instead of rejecting, which would otherwise wedge
        // the button and never reach the execCommand fallback below.
        await withTimeout(navigator.clipboard.writeText(value), CLIPBOARD_TIMEOUT_MS);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }

    // Some browsers/embedded contexts reject the async Clipboard API even on
    // a genuine click (restrictive permissions policy, older Safari): fall
    // back to the legacy execCommand path rather than failing silently.
    if (!succeeded) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        succeeded = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        succeeded = false;
      }
    }

    if (succeeded) {
      setCopied(true);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
    }
  }, [text]);

  return (
    <button
      type="button"
      className={`ac-action ${copied ? "is-copied" : ""}`}
      title={copied ? copiedLabel : label}
      aria-label={label}
      onClick={() => void handleCopy()}
    >
      {copied ? <IconCheck /> : <IconCopy />}
    </button>
  );
});

const MessageItem = memo(function MessageItem({
  message,
  onFeedback,
  t,
}: {
  message: ChatMessage;
  onFeedback: FeedbackHandler;
  t: Strings;
}) {
  const isAssistant = message.role === "assistant";
  const sources = message.sources ?? [];
  const citations = (message.citations ?? []).filter((citation) => citation.quote.trim());
  const sourceIndex = new Map(sources.map((source, index) => [source.source_id, index + 1]));

  return (
    <article className={`ac-msg ac-msg--${message.role} ${message.kind === "memory-summary" ? "ac-msg--summary" : ""}`}>
      {isAssistant ? <LogoMark className="ac-msg-avatar" /> : null}
      <div className="ac-msg-body">
        {!isAssistant ? <span className="ac-msg-who">{t.you}</span> : null}
        <div className="ac-msg-bubble">
          <div className="ac-markdown">
            <MarkdownText text={message.text} />
          </div>

          {citations.length ? (
            <details className="ac-citations">
              <summary>
                {t.citations} ({citations.length})
              </summary>
              <ul>
                {citations.map((citation, index) => (
                  <li key={`${citation.source_id}-${index}`}>
                    {sourceIndex.has(citation.source_id) ? (
                      <span className="ac-source-index">{sourceIndex.get(citation.source_id)}</span>
                    ) : null}
                    <q>{citation.quote}</q>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {!isAssistant && message.text ? (
          <div className="ac-msg-actions">
            <CopyButton text={message.text} label={t.actions.copyQuestion} copiedLabel={t.actions.copied} />
          </div>
        ) : null}

        {isAssistant && message.text ? (
          <div className="ac-msg-meta">
            {message.confidence ? <ConfidenceMeter level={message.confidence} t={t} /> : null}

            {sources.length ? (
              <ul className="ac-source-chips" aria-label={t.export.sources}>
                {sources.map((source, index) => (
                  <li key={source.source_id}>
                    {isPublicUrl(source.canonical_url) ? (
                      <a href={source.canonical_url} target="_blank" rel="noreferrer" title={source.canonical_url}>
                        <span className="ac-source-index">{index + 1}</span>
                        {sourceLabel(source)}
                      </a>
                    ) : (
                      <span title={t.panel.authored}>
                        <span className="ac-source-index">{index + 1}</span>
                        {sourceLabel(source)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="ac-msg-actions">
              <CopyButton text={message.text} label={t.actions.copyAnswer} copiedLabel={t.actions.copied} />
              {message.interactionId ? (
                <>
                  <button
                    type="button"
                    className={`ac-action ${message.feedback === "like" ? "is-liked" : ""}`}
                    aria-pressed={message.feedback === "like"}
                    title={t.actions.useful}
                    aria-label={t.actions.useful}
                    onClick={() => void onFeedback(message.id, message.interactionId!, "like")}
                  >
                    <IconThumbUp />
                  </button>
                  <button
                    type="button"
                    className={`ac-action ${message.feedback === "dislike" ? "is-disliked" : ""}`}
                    aria-pressed={message.feedback === "dislike"}
                    title={t.actions.notUseful}
                    aria-label={t.actions.notUseful}
                    onClick={() => void onFeedback(message.id, message.interactionId!, "dislike")}
                  >
                    <IconThumbDown />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
});

// ---------------------------------------------------------------------------
// Streaming simule
// ---------------------------------------------------------------------------

type MessageSetter = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

async function streamAssistantAnswer(messageId: string, fullText: string, setMessages: MessageSetter): Promise<void> {
  const text = fullText.trim();
  if (!text) {
    return;
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, text } : message)));
    return;
  }

  const charsPerTick = 12;
  const delayMs = 24;

  for (let index = charsPerTick; index < text.length; index += charsPerTick) {
    const currentText = text.slice(0, index);
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, text: currentText } : message)),
    );

    await wait(delayMs);
  }

  setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, text } : message)));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return <>{blocks}</>;
});

function parseMarkdownBlocks(text: string): ReactNode[] {
  if (!text.trim()) {
    return [];
  }

  const lines = normalizeMarkdown(text).split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = Math.min(match[1].length, 6);
        const headingText = match[2].trim();
        const key = `h-${index}`;
        const Heading = `h${level}` as keyof React.JSX.IntrinsicElements;

        blocks.push(<Heading key={key}>{renderInlineMarkdown(headingText)}</Heading>);
        index += 1;
        continue;
      }
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1].trim();
      const src = imageMatch[2].trim();
      blocks.push(
        <figure key={`img-${index}`} className="ac-markdown-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- image distante citee par la reponse, hors optimisation Next */}
          <img src={src} alt={alt || "Illustration"} loading="lazy" />
        </figure>,
      );
      index += 1;
      continue;
    }

    // An enumeration with no inherent order. Without this branch the line fell
    // through to the paragraph case and rendered its "- " literally, which is
    // why the answer prompt used to forbid bullets outright and funnelled every
    // list -- ordered or not -- into "1. 2. 3.".
    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate) {
          index += 1;
          continue;
        }

        const match = candidate.match(/^[-*]\s+(.+)$/);
        if (!match) {
          break;
        }

        items.push(<li key={`ul-${index}`}>{renderInlineMarkdown(match[1])}</li>);
        index += 1;
      }

      blocks.push(<ul key={`unordered-${index}`}>{items}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate) {
          index += 1;
          continue;
        }

        const match = candidate.match(/^(\d+)\.\s+(.+)$/);
        if (!match) {
          break;
        }

        const number = Number.parseInt(match[1], 10);
        const content = match[2];
        items.push(
          <li key={`ol-${index}`} value={number}>
            {renderInlineMarkdown(content)}
          </li>,
        );
        index += 1;
      }

      blocks.push(<ol key={`ordered-${index}`}>{items}</ol>);
      continue;
    }

    // Des lignes consecutives sans ligne vide entre elles forment UN paragraphe
    // avec retours a la ligne : une adresse ou des coordonnees arrivaient
    // sinon comme autant de paragraphes isoles, espaces comme des sections.
    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || isBlockStart(candidate)) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`}>
        {paragraphLines.map((text, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(text)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return /^#{1,6}\s+/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) || isMarkdownImage(line);
}

function normalizeMarkdown(text: string): string {
  const lines = text.split("\n");
  const normalized: string[] = [];
  const seenHeaderImagePairs = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const currentRaw = lines[index];
    const current = currentRaw.trim();

    if (!current) {
      normalized.push(currentRaw);
      continue;
    }

    if (shouldDropBoilerplateLine(current)) {
      continue;
    }

    const nextRaw = lines[index + 1] ?? "";
    const next = nextRaw.trim();

    if (isMarkdownHeading(current) && isMarkdownImage(next)) {
      const pairKey = `${current}\n${next}`;
      if (seenHeaderImagePairs.has(pairKey)) {
        index += 1;
        continue;
      }

      seenHeaderImagePairs.add(pairKey);
      normalized.push(currentRaw, nextRaw);
      index += 1;
      continue;
    }

    const previous = normalized[normalized.length - 1]?.trim() ?? "";
    if (previous === current && (isMarkdownHeading(current) || isMarkdownImage(current))) {
      continue;
    }

    normalized.push(currentRaw);
  }

  return normalized.join("\n");
}

function isMarkdownHeading(line: string): boolean {
  return /^#{1,6}\s+.+/.test(line);
}

function isMarkdownImage(line: string): boolean {
  return /^!\[[^\]]*\]\([^)]+\)$/.test(line);
}

function shouldDropBoilerplateLine(line: string): boolean {
  const compact = line
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  // Les pages Hugo d'arcantel.ch repetent leur titre juste sous le titre de
  // section, ce qui ressort en doublon dans les reponses.
  return compact === "## arcantel sa" || compact === "votre partenaire developpement / mobile / internet / ia";
}

function renderInlineMarkdown(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={`code-${index}`}>{part.slice(1, -1)}</code>;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      // Answers are built from crawled documents, so a URL in one is untrusted
      // input: only http(s) becomes clickable, and anything else (javascript:,
      // data:, ...) degrades to its label as plain text.
      if (/^https?:\/\//i.test(href)) {
        return (
          <a key={`link-${index}`} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        );
      }

      return <Fragment key={`link-${index}`}>{label}</Fragment>;
    }

    return <Fragment key={`txt-${index}`}>{part}</Fragment>;
  });
}

// ---------------------------------------------------------------------------
// Appels reseau
// ---------------------------------------------------------------------------

async function queryBackend(
  prompt: string,
  session_id: string,
  response_language: string,
  errors: Strings["errors"],
): Promise<ChatApiResponse> {
  const response = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // La langue de l'interface est envoyee en clair : le backend repond dans
    // cette langue au lieu de la deviner d'apres une question de quatre mots.
    body: JSON.stringify({ question: prompt, top_k: 5, session_id, response_language }),
  });

  if (!response.ok) {
    // Le backend explique ses refus dans `detail` (service indisponible, quota,
    // question vide) : autant le montrer plutot qu'un code HTTP.
    let detail = errors.serviceStatus(response.status);
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail.trim()) {
        detail = body.detail;
      }
    } catch {
      // Corps non JSON : on garde le message generique.
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as Partial<ChatApiResponse>;

  if (typeof data.answer !== "string" || !data.answer.trim() || typeof data.session_id !== "string") {
    throw new Error(errors.emptyAnswer);
  }

  return {
    session_id: data.session_id,
    answer: data.answer.trim(),
    confidence: data.confidence ?? "low",
    citations: Array.isArray(data.citations) ? data.citations : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    interaction_id: typeof data.interaction_id === "number" ? data.interaction_id : undefined,
  };
}

async function sendFeedback(interaction_id: number, rating: FeedbackRating | null): Promise<void> {
  const response = await fetch(FEEDBACK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interaction_id, rating }),
  });

  if (!response.ok) {
    throw new Error(`Feedback error: ${response.status}`);
  }
}

async function initializeSession(
  setSessionId: (value: string) => void,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setConnection: (value: Connection) => void,
): Promise<void> {
  try {
    const existingSession = getStoredSessionId();
    const activeSessionId = await createSession(existingSession);
    setSessionId(activeSessionId);
    persistSessionId(activeSessionId);

    const history = await fetchSessionHistory(activeSessionId);
    if (history.messages.length > 0 || history.summary.trim()) {
      const restored: ChatMessage[] = [];
      if (history.summary.trim()) {
        restored.push({
          id: `summary-${history.session_id}`,
          role: "assistant",
          text: history.summary,
          kind: "memory-summary",
        });
      }

      restored.push(
        ...history.messages.map((message, index) => ({
          id: `${history.session_id}-${message.created_at}-${index}`,
          role: message.role,
          text: message.content,
          interactionId: message.interaction_id ?? undefined,
          feedback: message.feedback ?? null,
          citations: Array.isArray(message.citations) ? message.citations : [],
          sources: Array.isArray(message.sources) ? message.sources : [],
        })),
      );

      setMessages(restored);
      setConnection("online");
      return;
    }

    setMessages([INITIAL_MESSAGE]);
    setConnection("online");
  } catch {
    setMessages([INITIAL_MESSAGE]);
    setConnection("offline");
  }
}

async function createSession(session_id?: string): Promise<string> {
  const response = await fetch(SESSION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id }),
  });

  if (!response.ok) {
    throw new Error(`Session create error: ${response.status}`);
  }

  const data = (await response.json()) as { session_id?: string };
  if (!data.session_id) {
    throw new Error("Session id missing");
  }

  return data.session_id;
}

async function fetchSessionHistory(sessionId: string): Promise<SessionHistoryResponse> {
  const response = await fetch(`${SESSION_API_URL}/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Session history error: ${response.status}`);
  }

  const data = (await response.json()) as Partial<SessionHistoryResponse>;
  if (typeof data.session_id !== "string") {
    throw new Error("Invalid session history payload");
  }

  return {
    session_id: data.session_id,
    summary: typeof data.summary === "string" ? data.summary : "",
    messages: Array.isArray(data.messages)
      ? data.messages
          .filter(
            (item): item is SessionHistoryMessage =>
              !!item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string" &&
              typeof item.created_at === "string",
          )
          .map((item) => ({
            ...item,
            interaction_id: typeof item.interaction_id === "number" ? item.interaction_id : undefined,
            feedback: item.feedback === "like" || item.feedback === "dislike" ? item.feedback : null,
          }))
      : [],
  };
}

function getStoredSessionId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
  const trimmed = value.trim();
  return trimmed || undefined;
}

function persistSessionId(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}
