// Les quatre langues de l'interface : francais (langue du site et du corpus),
// anglais, allemand de Suisse (pas de ß, vouvoiement, « E-Mail », « Telefon »)
// et italien. Les reponses du backend suivent la langue de la question, pas
// celle de l'interface : poser une question en allemand donne une reponse en
// allemand, quel que soit le reglage ici.

import { useCallback, useSyncExternalStore } from "react";

export type Locale = "fr" | "en" | "de" | "it";

// `answerLanguage` est le nom envoye au backend pour fixer la langue de la
// reponse ; il reprend les libelles que son planificateur connait deja.
export const LOCALES: { id: Locale; short: string; name: string; htmlLang: string; answerLanguage: string }[] = [
  { id: "fr", short: "FR", name: "Français", htmlLang: "fr-CH", answerLanguage: "Français" },
  { id: "en", short: "EN", name: "English", htmlLang: "en", answerLanguage: "English" },
  { id: "de", short: "DE", name: "Deutsch (Schweiz)", htmlLang: "de-CH", answerLanguage: "Deutsch" },
  { id: "it", short: "IT", name: "Italiano", htmlLang: "it-CH", answerLanguage: "Italiano" },
];

export function answerLanguageFor(locale: Locale): string {
  return (LOCALES.find((item) => item.id === locale) ?? LOCALES[0]).answerLanguage;
}

const LOCALE_STORAGE_KEY = "ac_lang";
const LOCALE_EVENT = "ac-locale-change";

export type QuickPrompt = { title: string; hint: string; prompt: string };

export type Strings = {
  nav: { news: string; services: string; references: string; company: string; contact: string; assistant: string };
  status: { init: string; online: string; busy: string; offline: string };
  theme: { toLight: string; toDark: string };
  language: string;
  kicker: string;
  hero: { line1: string; line2: string; lead: string };
  welcome: string;
  quickPrompts: QuickPrompt[];
  areas: string[];
  areaQuestion: (area: string) => string;
  composer: { label: string; placeholder: string; send: string };
  tools: { newChat: string; export: string; exporting: string; formats: string };
  formats: { pdf: string; docx: string; pptx: string; xlsx: string; markdown: string };
  thinking: string;
  you: string;
  actions: { copyAnswer: string; copyQuestion: string; copied: string; useful: string; notUseful: string; scrollToEnd: string };
  citations: string;
  confidence: { high: string; medium: string; low: string };
  panel: {
    lastAnswer: string;
    lastAnswerEmpty: string;
    domains: string;
    company: string;
    visit: string;
    authored: string;
    context: string;
  };
  errors: {
    sendTitle: string;
    sendDetail: string;
    answerTitle: string;
    exportTitle: string;
    unexpected: string;
    serviceStatus: (status: number) => string;
    emptyAnswer: string;
    emptyExport: string;
    retry: string;
  };
  login: {
    title: string;
    lead: string;
    username: string;
    password: string;
    submit: string;
    submitting: string;
    invalid: string;
    unavailable: string;
    logout: string;
  };
  export: {
    title: string;
    exportedAt: (date: string) => string;
    exchanges: (count: number) => string;
    answer: string;
    noAnswer: string;
    sources: string;
    citations: string;
    sheetConversation: string;
    sheetSources: string;
    sheetAbout: string;
    columns: { index: string; question: string; answer: string; confidence: string; sources: string; rank: string; title: string; url: string; score: string };
    about: { title: string; date: string; exchanges: string; site: string };
    footer: string;
  };
};

const fr: Strings = {
  nav: { news: "Actualités", services: "Services", references: "Réalisations", company: "La société", contact: "Contact", assistant: "Assistant" },
  status: { init: "Connexion", online: "En ligne", busy: "Analyse en cours", offline: "Hors ligne" },
  theme: { toLight: "Activer le mode clair", toDark: "Activer le mode sombre" },
  language: "Langue",
  kicker: "Assistant IA · Arcantel SA · Neuchâtel",
  hero: {
    line1: "Une question sur Arcantel ?",
    line2: "Demandez, nous répondons.",
    lead: "Services, réalisations, technologies, équipe : chaque réponse s'appuie sur ce que nous publions — et vous montre d'où elle vient.",
  },
  welcome:
    "Bienvenue chez Arcantel SA. Je réponds à vos questions sur nos développements web et mobile sur mesure, l'intelligence artificielle, 2ia, SharePoint, la cyberadministration et l'infrastructure automatisée.",
  quickPrompts: [
    { title: "2ia Web", hint: "Gérer son site en dialoguant avec un agent IA", prompt: "Qu'est-ce que 2ia Web ?" },
    { title: "Vote électronique", hint: "Références e-voting pour les cantons suisses", prompt: "Avez-vous réalisé des projets de vote électronique ?" },
    { title: "Technologies", hint: "C# .NET, PHP Open Source, mobile iOS et Android", prompt: "Quelles technologies utilisez-vous pour le développement ?" },
    { title: "Nous contacter", hint: "Adresse à Neuchâtel, téléphone, e-mail", prompt: "Comment contacter Arcantel ?" },
  ],
  areas: [
    "Intelligence artificielle", "2ia Développement", "2ia Web", "2ia Infrastructure", "Développement sur mesure", "Application Internet",
    "Mobile", "SharePoint", "Infrastructure automatisée", "Cyberadministration", "Blockchain", "SoftAssist",
  ],
  areaQuestion: (area) => `Que propose Arcantel en matière de ${area} ?`,
  composer: { label: "Votre question", placeholder: "Posez votre question sur Arcantel…", send: "Envoyer" },
  tools: { newChat: "Nouvelle conversation", export: "Exporter", exporting: "Préparation…", formats: "Formats d'export" },
  formats: {
    pdf: "Document imprimable",
    docx: "Document éditable (.docx)",
    pptx: "Une diapositive par échange (.pptx)",
    xlsx: "Tableau des échanges et des sources (.xlsx)",
    markdown: "Texte brut structuré (.md)",
  },
  thinking: "Recherche dans la documentation Arcantel…",
  you: "Vous",
  actions: { copyAnswer: "Copier la réponse", copyQuestion: "Copier la question", copied: "Copié", useful: "Réponse utile", notUseful: "Réponse peu utile", scrollToEnd: "Aller à la fin" },
  citations: "Extraits cités",
  confidence: { high: "Fiabilité élevée", medium: "Fiabilité moyenne", low: "Fiabilité faible" },
  panel: {
    lastAnswer: "Dernière réponse",
    lastAnswerEmpty: "Le niveau de fiabilité et les pages d'arcantel.ch utilisées pour répondre s'afficheront ici.",
    domains: "Domaines couverts",
    company: "Arcantel SA",
    visit: "Visiter arcantel.ch",
    authored: "fiche rédigée par Arcantel",
    context: "Contexte de la réponse",
  },
  errors: {
    sendTitle: "La question n'a pas pu être envoyée.",
    sendDetail: "Impossible d'ouvrir une session : le service ne répond pas.",
    answerTitle: "La réponse n'a pas pu être générée.",
    exportTitle: "L'export n'a pas abouti.",
    unexpected: "Erreur inattendue.",
    serviceStatus: (status) => `Le service a répondu avec une erreur ${status}.`,
    emptyAnswer: "La réponse reçue est vide.",
    emptyExport: "Rien à exporter : la conversation est vide.",
    retry: "Réessayer",
  },
  login: {
    title: "Connexion",
    lead: "Accès réservé : identifiez-vous pour utiliser l'assistant.",
    username: "Identifiant",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion…",
    invalid: "Identifiant ou mot de passe incorrect.",
    unavailable: "Le service de connexion ne répond pas.",
    logout: "Se déconnecter",
  },
  export: {
    title: "Conversation avec l'assistant Arcantel",
    exportedAt: (date) => `Exportée le ${date} — arcantel.ch`,
    exchanges: (count) => `${count} échange${count > 1 ? "s" : ""}`,
    answer: "Réponse",
    noAnswer: "Sans réponse.",
    sources: "Sources",
    citations: "Extraits cités",
    sheetConversation: "Conversation",
    sheetSources: "Sources",
    sheetAbout: "À propos",
    columns: { index: "#", question: "Question", answer: "Réponse", confidence: "Fiabilité", sources: "Sources", rank: "Rang", title: "Titre", url: "URL", score: "Score" },
    about: { title: "Titre", date: "Exportée le", exchanges: "Échanges", site: "Site" },
    footer: "Arcantel SA — Faubourg du Lac 12, 2000 Neuchâtel — arcantel.ch",
  },
};

const en: Strings = {
  nav: { news: "News", services: "Services", references: "Projects", company: "Company", contact: "Contact", assistant: "Assistant" },
  status: { init: "Connecting", online: "Online", busy: "Thinking", offline: "Offline" },
  theme: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
  language: "Language",
  kicker: "AI assistant · Arcantel SA · Neuchâtel",
  hero: {
    line1: "A question about Arcantel?",
    line2: "Ask — we answer.",
    lead: "Services, projects, technologies, team: every answer is grounded in what we publish — and shows you where it comes from.",
  },
  welcome:
    "Welcome to Arcantel SA. I answer your questions about our custom web and mobile development, artificial intelligence, 2ia, SharePoint, e-government and automated infrastructure.",
  quickPrompts: [
    { title: "2ia Web", hint: "Manage your website by talking to an AI agent", prompt: "What is 2ia Web?" },
    { title: "E-voting", hint: "Internet voting references for Swiss cantons", prompt: "Have you delivered electronic voting projects?" },
    { title: "Technologies", hint: "C# .NET, open-source PHP, iOS and Android", prompt: "Which technologies do you use for development?" },
    { title: "Contact us", hint: "Address in Neuchâtel, phone, e-mail", prompt: "How can I contact Arcantel?" },
  ],
  areas: [
    "Artificial intelligence", "2ia Development", "2ia Web", "2ia Infrastructure", "Custom development", "Web applications",
    "Mobile", "SharePoint", "Automated infrastructure", "E-government", "Blockchain", "SoftAssist",
  ],
  areaQuestion: (area) => `What does Arcantel offer in ${area}?`,
  composer: { label: "Your question", placeholder: "Ask your question about Arcantel…", send: "Send" },
  tools: { newChat: "New conversation", export: "Export", exporting: "Preparing…", formats: "Export formats" },
  formats: {
    pdf: "Printable document",
    docx: "Editable document (.docx)",
    pptx: "One slide per exchange (.pptx)",
    xlsx: "Table of exchanges and sources (.xlsx)",
    markdown: "Structured plain text (.md)",
  },
  thinking: "Searching the Arcantel documentation…",
  you: "You",
  actions: { copyAnswer: "Copy the answer", copyQuestion: "Copy the question", copied: "Copied", useful: "Helpful answer", notUseful: "Unhelpful answer", scrollToEnd: "Jump to the end" },
  citations: "Quoted excerpts",
  confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  panel: {
    lastAnswer: "Latest answer",
    lastAnswerEmpty: "The confidence level and the arcantel.ch pages used to answer will appear here.",
    domains: "Areas covered",
    company: "Arcantel SA",
    visit: "Visit arcantel.ch",
    authored: "written by Arcantel",
    context: "Answer context",
  },
  errors: {
    sendTitle: "The question could not be sent.",
    sendDetail: "Unable to open a session: the service is not responding.",
    answerTitle: "The answer could not be generated.",
    exportTitle: "The export did not complete.",
    unexpected: "Unexpected error.",
    serviceStatus: (status) => `The service responded with error ${status}.`,
    emptyAnswer: "The answer received is empty.",
    emptyExport: "Nothing to export: the conversation is empty.",
    retry: "Try again",
  },
  login: {
    title: "Sign in",
    lead: "Restricted access: sign in to use the assistant.",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    invalid: "Incorrect username or password.",
    unavailable: "The sign-in service is not responding.",
    logout: "Sign out",
  },
  export: {
    title: "Conversation with the Arcantel assistant",
    exportedAt: (date) => `Exported on ${date} — arcantel.ch`,
    exchanges: (count) => `${count} exchange${count > 1 ? "s" : ""}`,
    answer: "Answer",
    noAnswer: "No answer.",
    sources: "Sources",
    citations: "Quoted excerpts",
    sheetConversation: "Conversation",
    sheetSources: "Sources",
    sheetAbout: "About",
    columns: { index: "#", question: "Question", answer: "Answer", confidence: "Confidence", sources: "Sources", rank: "Rank", title: "Title", url: "URL", score: "Score" },
    about: { title: "Title", date: "Exported on", exchanges: "Exchanges", site: "Website" },
    footer: "Arcantel SA — Faubourg du Lac 12, 2000 Neuchâtel — arcantel.ch",
  },
};

const de: Strings = {
  nav: { news: "Aktuelles", services: "Dienstleistungen", references: "Referenzen", company: "Unternehmen", contact: "Kontakt", assistant: "Assistent" },
  status: { init: "Verbindung", online: "Online", busy: "Analyse läuft", offline: "Offline" },
  theme: { toLight: "Helles Design aktivieren", toDark: "Dunkles Design aktivieren" },
  language: "Sprache",
  kicker: "KI-Assistent · Arcantel SA · Neuenburg",
  hero: {
    line1: "Eine Frage zu Arcantel?",
    line2: "Fragen Sie – wir antworten.",
    lead: "Dienstleistungen, Referenzen, Technologien, Team: Jede Antwort stützt sich auf das, was wir veröffentlichen – und zeigt Ihnen, woher sie stammt.",
  },
  welcome:
    "Willkommen bei Arcantel SA. Ich beantworte Ihre Fragen zu unseren massgeschneiderten Web- und Mobile-Entwicklungen, künstlicher Intelligenz, 2ia, SharePoint, E-Government und automatisierter Infrastruktur.",
  quickPrompts: [
    { title: "2ia Web", hint: "Die eigene Website im Dialog mit einem KI-Agenten verwalten", prompt: "Was ist 2ia Web?" },
    { title: "E-Voting", hint: "Referenzen zur elektronischen Stimmabgabe in Schweizer Kantonen", prompt: "Haben Sie Projekte zur elektronischen Stimmabgabe umgesetzt?" },
    { title: "Technologien", hint: "C# .NET, Open-Source-PHP, iOS und Android", prompt: "Welche Technologien setzen Sie in der Entwicklung ein?" },
    { title: "Kontakt", hint: "Adresse in Neuenburg, Telefon, E-Mail", prompt: "Wie erreiche ich Arcantel?" },
  ],
  areas: [
    "Künstliche Intelligenz", "2ia Entwicklung", "2ia Web", "2ia Infrastruktur", "Individualentwicklung", "Webapplikationen",
    "Mobile", "SharePoint", "Automatisierte Infrastruktur", "E-Government", "Blockchain", "SoftAssist",
  ],
  areaQuestion: (area) => `Was bietet Arcantel im Bereich ${area} an?`,
  composer: { label: "Ihre Frage", placeholder: "Stellen Sie Ihre Frage zu Arcantel …", send: "Senden" },
  tools: { newChat: "Neues Gespräch", export: "Exportieren", exporting: "Wird vorbereitet …", formats: "Exportformate" },
  formats: {
    pdf: "Druckbares Dokument",
    docx: "Bearbeitbares Dokument (.docx)",
    pptx: "Eine Folie pro Austausch (.pptx)",
    xlsx: "Tabelle der Fragen, Antworten und Quellen (.xlsx)",
    markdown: "Strukturierter Text (.md)",
  },
  thinking: "Suche in der Arcantel-Dokumentation …",
  you: "Sie",
  actions: { copyAnswer: "Antwort kopieren", copyQuestion: "Frage kopieren", copied: "Kopiert", useful: "Hilfreiche Antwort", notUseful: "Wenig hilfreiche Antwort", scrollToEnd: "Zum Ende springen" },
  citations: "Zitierte Auszüge",
  confidence: { high: "Hohe Zuverlässigkeit", medium: "Mittlere Zuverlässigkeit", low: "Geringe Zuverlässigkeit" },
  panel: {
    lastAnswer: "Letzte Antwort",
    lastAnswerEmpty: "Die Zuverlässigkeit und die für die Antwort verwendeten Seiten von arcantel.ch erscheinen hier.",
    domains: "Abgedeckte Bereiche",
    company: "Arcantel SA",
    visit: "arcantel.ch besuchen",
    authored: "von Arcantel verfasst",
    context: "Kontext der Antwort",
  },
  errors: {
    sendTitle: "Die Frage konnte nicht gesendet werden.",
    sendDetail: "Es konnte keine Sitzung eröffnet werden: Der Dienst antwortet nicht.",
    answerTitle: "Die Antwort konnte nicht erstellt werden.",
    exportTitle: "Der Export ist fehlgeschlagen.",
    unexpected: "Unerwarteter Fehler.",
    serviceStatus: (status) => `Der Dienst hat mit Fehler ${status} geantwortet.`,
    emptyAnswer: "Die erhaltene Antwort ist leer.",
    emptyExport: "Nichts zu exportieren: Das Gespräch ist leer.",
    retry: "Erneut versuchen",
  },
  login: {
    title: "Anmelden",
    lead: "Zugang beschränkt: Melden Sie sich an, um den Assistenten zu nutzen.",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    submitting: "Anmeldung …",
    invalid: "Benutzername oder Passwort ist falsch.",
    unavailable: "Der Anmeldedienst antwortet nicht.",
    logout: "Abmelden",
  },
  export: {
    title: "Gespräch mit dem Arcantel-Assistenten",
    exportedAt: (date) => `Exportiert am ${date} – arcantel.ch`,
    exchanges: (count) => `${count} Austausch${count > 1 ? "e" : ""}`,
    answer: "Antwort",
    noAnswer: "Keine Antwort.",
    sources: "Quellen",
    citations: "Zitierte Auszüge",
    sheetConversation: "Gespräch",
    sheetSources: "Quellen",
    sheetAbout: "Info",
    columns: { index: "#", question: "Frage", answer: "Antwort", confidence: "Zuverlässigkeit", sources: "Quellen", rank: "Rang", title: "Titel", url: "URL", score: "Score" },
    about: { title: "Titel", date: "Exportiert am", exchanges: "Austausche", site: "Website" },
    footer: "Arcantel SA – Faubourg du Lac 12, 2000 Neuenburg – arcantel.ch",
  },
};

const it: Strings = {
  nav: { news: "Attualità", services: "Servizi", references: "Realizzazioni", company: "L'azienda", contact: "Contatto", assistant: "Assistente" },
  status: { init: "Connessione", online: "In linea", busy: "Analisi in corso", offline: "Non in linea" },
  theme: { toLight: "Attiva il tema chiaro", toDark: "Attiva il tema scuro" },
  language: "Lingua",
  kicker: "Assistente IA · Arcantel SA · Neuchâtel",
  hero: {
    line1: "Una domanda su Arcantel?",
    line2: "Chiedete, rispondiamo.",
    lead: "Servizi, realizzazioni, tecnologie, team: ogni risposta si basa su ciò che pubblichiamo — e vi mostra da dove proviene.",
  },
  welcome:
    "Benvenuti in Arcantel SA. Rispondo alle vostre domande sui nostri sviluppi web e mobile su misura, l'intelligenza artificiale, 2ia, SharePoint, l'e-government e l'infrastruttura automatizzata.",
  quickPrompts: [
    { title: "2ia Web", hint: "Gestire il proprio sito dialogando con un agente IA", prompt: "Che cos'è 2ia Web?" },
    { title: "Voto elettronico", hint: "Referenze e-voting per i cantoni svizzeri", prompt: "Avete realizzato progetti di voto elettronico?" },
    { title: "Tecnologie", hint: "C# .NET, PHP open source, iOS e Android", prompt: "Quali tecnologie utilizzate per lo sviluppo?" },
    { title: "Contattarci", hint: "Indirizzo a Neuchâtel, telefono, e-mail", prompt: "Come posso contattare Arcantel?" },
  ],
  areas: [
    "Intelligenza artificiale", "2ia Sviluppo", "2ia Web", "2ia Infrastruttura", "Sviluppo su misura", "Applicazioni web",
    "Mobile", "SharePoint", "Infrastruttura automatizzata", "E-government", "Blockchain", "SoftAssist",
  ],
  areaQuestion: (area) => `Cosa propone Arcantel nell'ambito ${area}?`,
  composer: { label: "La vostra domanda", placeholder: "Fate la vostra domanda su Arcantel…", send: "Invia" },
  tools: { newChat: "Nuova conversazione", export: "Esporta", exporting: "Preparazione…", formats: "Formati di esportazione" },
  formats: {
    pdf: "Documento stampabile",
    docx: "Documento modificabile (.docx)",
    pptx: "Una diapositiva per scambio (.pptx)",
    xlsx: "Tabella degli scambi e delle fonti (.xlsx)",
    markdown: "Testo strutturato (.md)",
  },
  thinking: "Ricerca nella documentazione Arcantel…",
  you: "Voi",
  actions: { copyAnswer: "Copia la risposta", copyQuestion: "Copia la domanda", copied: "Copiato", useful: "Risposta utile", notUseful: "Risposta poco utile", scrollToEnd: "Vai alla fine" },
  citations: "Estratti citati",
  confidence: { high: "Affidabilità elevata", medium: "Affidabilità media", low: "Affidabilità bassa" },
  panel: {
    lastAnswer: "Ultima risposta",
    lastAnswerEmpty: "Il livello di affidabilità e le pagine di arcantel.ch usate per rispondere appariranno qui.",
    domains: "Ambiti coperti",
    company: "Arcantel SA",
    visit: "Visita arcantel.ch",
    authored: "scheda redatta da Arcantel",
    context: "Contesto della risposta",
  },
  errors: {
    sendTitle: "La domanda non ha potuto essere inviata.",
    sendDetail: "Impossibile aprire una sessione: il servizio non risponde.",
    answerTitle: "La risposta non ha potuto essere generata.",
    exportTitle: "L'esportazione non è riuscita.",
    unexpected: "Errore imprevisto.",
    serviceStatus: (status) => `Il servizio ha risposto con l'errore ${status}.`,
    emptyAnswer: "La risposta ricevuta è vuota.",
    emptyExport: "Niente da esportare: la conversazione è vuota.",
    retry: "Riprova",
  },
  login: {
    title: "Accesso",
    lead: "Accesso riservato: identificatevi per usare l'assistente.",
    username: "Nome utente",
    password: "Password",
    submit: "Accedi",
    submitting: "Accesso in corso…",
    invalid: "Nome utente o password errati.",
    unavailable: "Il servizio di accesso non risponde.",
    logout: "Esci",
  },
  export: {
    title: "Conversazione con l'assistente Arcantel",
    exportedAt: (date) => `Esportata il ${date} — arcantel.ch`,
    exchanges: (count) => `${count} scambi${count === 1 ? "o" : ""}`,
    answer: "Risposta",
    noAnswer: "Senza risposta.",
    sources: "Fonti",
    citations: "Estratti citati",
    sheetConversation: "Conversazione",
    sheetSources: "Fonti",
    sheetAbout: "Informazioni",
    columns: { index: "#", question: "Domanda", answer: "Risposta", confidence: "Affidabilità", sources: "Fonti", rank: "Posizione", title: "Titolo", url: "URL", score: "Punteggio" },
    about: { title: "Titolo", date: "Esportata il", exchanges: "Scambi", site: "Sito" },
    footer: "Arcantel SA — Faubourg du Lac 12, 2000 Neuchâtel — arcantel.ch",
  },
};

export const STRINGS: Record<Locale, Strings> = { fr, en, de, it };

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en" || value === "de" || value === "it";
}

// ---------------------------------------------------------------------------
// La langue vit sur <html lang>, posee avant le premier rendu par le script du
// layout (preference enregistree, sinon langue du navigateur). Meme mecanisme
// que le theme : un store externe, pas un state duplique.
// ---------------------------------------------------------------------------

export function readLocale(): Locale {
  const lang = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase();
  return isLocale(lang) ? lang : "fr";
}

function subscribeLocale(callback: () => void): () => void {
  window.addEventListener(LOCALE_EVENT, callback);
  return () => window.removeEventListener(LOCALE_EVENT, callback);
}

export function useLocale(): [Locale, (next: Locale) => void] {
  const locale = useSyncExternalStore(subscribeLocale, readLocale, () => "fr" as Locale);
  const setLocale = useCallback((next: Locale) => {
    const entry = LOCALES.find((item) => item.id === next) ?? LOCALES[0];
    document.documentElement.lang = entry.htmlLang;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible : la langue vaut pour la page.
    }
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);
  return [locale, setLocale];
}
