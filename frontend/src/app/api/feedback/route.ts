import { NextRequest, NextResponse } from "next/server";

const BACKEND_FEEDBACK_URL = process.env.BACKEND_FEEDBACK_URL ?? "http://127.0.0.1:8000/feedback";
const BACKEND_TIMEOUT_MS = 15_000;

type ProxyBody = {
  interaction_id?: number;
  rating?: "like" | "dislike" | null;
};

export async function POST(request: NextRequest) {
  let body: ProxyBody;

  try {
    body = (await request.json()) as ProxyBody;
  } catch {
    return NextResponse.json({ detail: "Payload JSON invalide" }, { status: 400 });
  }

  const interaction_id = typeof body.interaction_id === "number" ? body.interaction_id : undefined;
  const rating = body.rating === "like" || body.rating === "dislike" ? body.rating : null;

  if (!interaction_id || interaction_id < 1) {
    return NextResponse.json({ detail: "interaction_id manquant" }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(BACKEND_FEEDBACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ interaction_id, rating }),
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
