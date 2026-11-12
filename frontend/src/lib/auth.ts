// Acces par identifiant et mot de passe, sans dependance : un cookie signe
// (HMAC-SHA256 via Web Crypto, donc utilisable dans le proxy Edge comme dans
// les routes Node), verifie a chaque requete par src/proxy.ts.
//
// Les identifiants viennent de l'environnement ; les valeurs par defaut sont
// celles de la demo (demo / demo20261103) et n'ont pas vocation a survivre a la
// mise en production -- AUTH_SECRET non plus, qui est derive du mot de passe
// quand il n'est pas fourni.

export const AUTH_COOKIE = "arcantel_auth";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

const DEMO_USER = "demo";
const DEMO_PASSWORD = "demo20261103";

function expectedUser(): string {
  return (process.env.AUTH_USER || DEMO_USER).trim();
}

function expectedPassword(): string {
  return process.env.AUTH_PASSWORD || DEMO_PASSWORD;
}

function secret(): string {
  return process.env.AUTH_SECRET || `dev-secret-${expectedPassword()}`;
}

// Comparaison a temps constant : la duree ne doit pas dire a quel caractere
// la tentative a echoue.
function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

export function checkCredentials(username: string, password: string): boolean {
  const userOk = safeEqual(username.trim(), expectedUser());
  const passwordOk = safeEqual(password, expectedPassword());
  return userOk && passwordOk;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(username: string): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })),
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<{ username: string } | null> {
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  if (!safeEqual(signature, await sign(payload))) {
    return null;
  }
  try {
    const data = JSON.parse(fromBase64Url(payload)) as { u?: unknown; exp?: unknown };
    if (typeof data.u !== "string" || typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { username: data.u };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
