// Le modele d'une conversation, partage entre la page et l'export : ce que le
// backend renvoie (reponse, fiabilite, citations, sources) et ce que la page y
// ajoute (identifiant, avis donne).

export type MessageRole = "assistant" | "user";

export type Confidence = "high" | "medium" | "low";

export type Citation = {
  source_id: string;
  quote: string;
};

export type Source = {
  source_id: string;
  title: string;
  canonical_url: string;
  score: number;
  vector_score: number;
  bm25_score: number;
  text_snippet: string;
};

export type FeedbackRating = "like" | "dislike";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  confidence?: Confidence;
  citations?: Citation[];
  sources?: Source[];
  kind?: "memory-summary";
  interactionId?: number;
  feedback?: FeedbackRating | null;
};

export function sourceLabel(source: Source): string {
  const title = source.title.trim();
  if (title) {
    // Les titres Hugo d'arcantel.ch se terminent tous par " | Arcantel SA" :
    // dans une liste de sources, ce suffixe n'apporte rien.
    return title.replace(/\s*\|\s*Arcantel SA\s*$/i, "");
  }

  try {
    const url = new URL(source.canonical_url);
    const lastSegment = url.pathname.split("/").filter(Boolean).pop();
    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }
    return url.hostname;
  } catch {
    return source.canonical_url || "Document sans titre";
  }
}

// Une fiche redigee (OKF) sans page publique arrive avec une URI okf:// : elle
// reste une source a montrer, mais pas un lien a ouvrir.
export function isPublicUrl(url: string): boolean {
  return /^https?:\/\//i.test(url || "");
}
