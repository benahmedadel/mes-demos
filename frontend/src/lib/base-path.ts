// L'application peut etre servie sous un sous-chemin (https://mes-demos.com/arcantel) :
// Next prefixe lui-meme ses routes, ses <Link> et ses assets statiques du
// `basePath`, mais pas les URL ecrites en dur dans le code (fetch, <img>,
// window.location). Celles-ci passent par ici. La valeur est figee au build
// (NEXT_PUBLIC_BASE_PATH), vide en developpement.

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
