import { NextRequest, NextResponse } from "next/server";

const BACKEND_SESSIONS_URL = process.env.BACKEND_SESSIONS_URL ?? "http://127.0.0.1:8000/sessions";
// Without a timeout, an unresponsive backend leaves this fetch pending
// forever instead of failing fast into the frontend's existing error state.
const BACKEND_TIMEOUT_MS = 15_000;

type SessionCreateBody = {
  session_id?: string;
};

export async function POST(request: NextRequest) {
  let body: SessionCreateBody = {};

  try {
    const parsed = (await request.json()) as SessionCreateBody;
    body = parsed ?? {};
  } catch {
    body = {};
  }

  const trimmedSessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const session_id = trimmedSessionId || undefined;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(BACKEND_SESSIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id }),
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
