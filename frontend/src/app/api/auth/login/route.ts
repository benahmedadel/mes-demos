import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, checkCredentials, createSessionToken, sessionCookieOptions } from "@/lib/auth";

type LoginBody = { username?: unknown; password?: unknown };

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ detail: "Payload JSON invalide" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    // Un echec coute une demi-seconde : assez pour decourager l'essai en
    // rafale, pas assez pour gener quelqu'un qui s'est trompe de touche.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({ detail: "Identifiant ou mot de passe incorrect" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username: username.trim() });
  response.cookies.set(AUTH_COOKIE, await createSessionToken(username.trim()), sessionCookieOptions());
  return response;
}
