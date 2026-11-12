import { NextRequest, NextResponse } from "next/server";

const BACKEND_CHAT_URL = process.env.BACKEND_CHAT_URL ?? "http://127.0.0.1:8000/chat";
// Which chatbot_backend client (and therefore which Neo4j database) this
// frontend deployment talks to. Fixed server-side, never chosen by the browser.
const CHATBOT_CLIENT = process.env.CHATBOT_CLIENT ?? "arcantel";
// Without a timeout, an unresponsive/slow-starting backend leaves this fetch
// pending forever, which the browser sees as an endless loading spinner
// instead of a timely error (LLM answers are normally a few seconds; this
// bounds the worst case).
const BACKEND_TIMEOUT_MS = 45_000;

type ProxyBody = {
  question?: string;
  top_k?: number;
  session_id?: string;
  // Langue d'interface, nommee en clair ("Deutsch") : le backend l'applique
  // a la reponse au lieu de la deviner d'apres la question.
  response_language?: string;
};

export async function POST(request: NextRequest) {
  let body: ProxyBody;

  try {
    body = (await request.json()) as ProxyBody;
  } catch {
    return NextResponse.json({ detail: "Payload JSON invalide" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const top_k = typeof body.top_k === "number" ? body.top_k : undefined;
  const trimmedSessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const session_id = trimmedSessionId || undefined;
  const trimmedLanguage = typeof body.response_language === "string" ? body.response_language.trim().slice(0, 32) : "";
  const response_language = trimmedLanguage || undefined;

  if (!question) {
    return NextResponse.json({ detail: "Question manquante" }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(BACKEND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, top_k, session_id, response_language, client: CHATBOT_CLIENT }),
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "TimeoutError"
        ? "Le backend met trop de temps a repondre"
        : "Backend injoignable";
    return NextResponse.json({ detail }, { status: 504 });
  }

  const contentType = backendResponse.headers.get("content-type") ?? "application/json";
  const responseText = await backendResponse.text();

  return new NextResponse(responseText, {
    status: backendResponse.status,
    headers: {
      "content-type": contentType,
    },
  });
}