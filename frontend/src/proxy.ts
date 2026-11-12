import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

// Tout passe par ici sauf la page de connexion, ses deux routes et les
// fichiers statiques (voir `matcher`). Sans cookie valide : une page renvoie
// vers /login en gardant la destination, une route API repond 401.
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  // Sous un basePath, Next presente le chemin sans son prefixe ; on le retire
  // quand meme s'il est la, pour ne dependre d'aucune version.
  const { search } = request.nextUrl;
  let pathname = request.nextUrl.pathname;
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    pathname = pathname.slice(BASE_PATH.length) || "/";
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "Authentification requise" }, { status: 401 });
  }

  const login = new URL(`${BASE_PATH}/login`, request.url);
  if (pathname !== "/") {
    login.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(login);
}

// Sous un basePath, Next prefixe chaque motif du prefixe : le second devient
// "/arcantel/(...)" et n'attrape pas la racine exacte "/arcantel" -- qui
// s'affichait alors sans connexion. Le premier motif, "/", y pourvoit.
export const config = {
  matcher: ["/", "/((?!_next/static|_next/image|favicon\\.ico|favicon-32x32\\.png|logo\\.svg|login|api/auth).*)"],
};
