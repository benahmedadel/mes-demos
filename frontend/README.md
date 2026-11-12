# frontend

Interface conversationnelle : Next.js 16 / React 19, sans dépendance UI, tout
le style dans `src/app/globals.css`. Elle interroge un backend de
questions-réponses par ses routes API internes et expose ses réponses avec
niveau de fiabilité, sources et extraits cités.

## Lancer

```bash
npm install
cp .env.example .env.local   # renseigner les variables
npm run dev                  # http://localhost:3004
```

## Configuration

Toutes les variables sont listées dans `.env.example`.

| Variable | Rôle |
| --- | --- |
| `BACKEND_CHAT_URL` | route de question-réponse du backend |
| `BACKEND_FEEDBACK_URL` | route d'avis sur une réponse |
| `BACKEND_SESSIONS_URL` | route des sessions (création, relecture) |
| `CHATBOT_CLIENT` | client du backend interrogé, fixé côté serveur |
| `AUTH_USER` / `AUTH_PASSWORD` | identifiants d'accès à l'interface |
| `AUTH_SECRET` | signature du cookie de session (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_BASE_PATH` | sous-chemin de publication, figé au build (ex. `/demo`) |

## Routes

Le navigateur ne parle jamais au backend directement : quatre routes Next
relaient vers lui en y ajoutant le client.

| Route | Backend |
| --- | --- |
| `POST /api/chat` | `BACKEND_CHAT_URL` |
| `POST /api/feedback` | `BACKEND_FEEDBACK_URL` |
| `POST /api/session` | `BACKEND_SESSIONS_URL` |
| `GET /api/session/[sessionId]` | `BACKEND_SESSIONS_URL/{id}` |

L'accès est protégé par identifiant et mot de passe (`src/proxy.ts`,
`src/lib/auth.ts`) : cookie de session signé HMAC, valable 12 h.

## Interface

Deux états, un seul squelette — en-tête, zone centrale, composeur fixé en bas :

- **Accueil** — accroche et questions suggérées ; en fond, `pixel-field.tsx`
  anime une mosaïque de carrés sur un canvas plein écran (arrêtée onglet
  caché, figée sous `prefers-reduced-motion`).
- **Conversation** — fil défilant, « nouvelle conversation » dans l'en-tête.
  Chaque réponse expose ce que le backend renvoie : niveau de fiabilité
  (`confidence`), sources numérotées, extraits cités (`citations`), copie et
  avis. À partir de 1100 px, un panneau latéral reprend fiabilité et sources
  de la dernière réponse, des thèmes cliquables et le bloc de contact.

**Langues** — français, anglais, allemand de Suisse et italien ; chaînes dans
`src/app/i18n.ts`, langue posée sur `<html lang>` et lue par
`useSyncExternalStore` comme le thème. Le front envoie la langue de l'interface
(`response_language`) et le backend répond dedans, sauf demande contraire dans
la conversation.

**Export** — PDF, Word, PowerPoint, Excel et Markdown, générés dans le
navigateur depuis l'état de la conversation (`src/app/export.ts`), sans appel
backend ; jspdf, docx, pptxgenjs et exceljs sont chargés à la demande par
`import()`. Ces bibliothèques référencent des modules Node derrière des gardes :
`next.config.ts` retire le schéma `node:` et les déclare absents côté client.

Raccourcis : `Entrée` envoie, `Maj+Entrée` passe à la ligne, `/` amène le
curseur dans le composeur. Le thème suit la préférence système au premier
chargement, puis le choix de l'utilisateur, posé sur `<html>` avant le premier
rendu.

## Style

Toutes les couleurs passent par des variables `--ac-*` définies dans
`globals.css`, redéfinies sous `html[data-theme="dark"]`. Deux teintes
d'accent cohabitent : l'une décorative (filets, aplats), l'autre plus foncée dès
que la couleur porte du texte, pour le contraste.

## Construire

`output: "standalone"` ; le `Dockerfile` produit une image `node:22-alpine`
minimale. Le sous-chemin est figé au build :

```bash
docker build --build-arg NEXT_PUBLIC_BASE_PATH=/demo -t frontend .
```
