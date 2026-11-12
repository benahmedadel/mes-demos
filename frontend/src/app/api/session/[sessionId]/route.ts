import { NextRequest, NextResponse } from "next/server";

const BACKEND_SESSIONS_URL = process.env.BACKEND_SESSIONS_URL ?? "http://127.0.0.1:8000/sessions";
const BACKEND_TIMEOUT_MS = 15_000;

type Params = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: NextRequest, context: Params) {
  const { sessionId } = await context.params;
  const normalizedId = (sessionId || "").trim();

  if (!normalizedId) {
    return NextResponse.json({ detail: "Session manquante" }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND_SESSIONS_URL}/${encodeURIComponent(normalizedId)}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json({ detail: "Backend injoignable" }, { status: 504 });
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
