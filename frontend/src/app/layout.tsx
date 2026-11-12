import type { Metadata } from "next";
import { Dosis, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// arcantel.ch ne sert qu'une seule famille, Dosis : elle habille l'interface
// (titres, menus, boutons, etiquettes). Condensee, elle fatigue vite sur un
// paragraphe de reponse ; le corps des reponses prend une humaniste large,
// Source Sans 3, faite pour la lecture suivie.
const dosis = Dosis({
  variable: "--font-dosis",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-reading",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Assistant Arcantel | Développement web, mobile et intelligence artificielle",
  description:
    "L'assistant conversationnel d'Arcantel SA, Neuchâtel : développement d'applications web et mobile sur mesure, intelligence artificielle, 2ia, SharePoint, cyberadministration et infrastructure automatisée.",
  // Le suffixe ?v= force les navigateurs qui ont memorise "pas d'icone"
  // (visite pendant la phase sans certificat valide) a la recharger.
  // src/app/favicon.ico (logo Arcantel, 16 et 32 px) est ajoute par Next.
  icons: {
    icon: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon-32x32.png?v=3`,
        type: "image/png",
        sizes: "32x32",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dosis.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <body>
        <Script
          id="ac-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            // Le theme est pose sur <html> avant le premier rendu : preference
            // enregistree, sinon celle du systeme. La page le lit ensuite via
            // useSyncExternalStore, sans jamais le dupliquer dans un state.
            // Meme chose pour la langue, sur <html lang> : preference
            // enregistree, sinon celle du navigateur parmi fr/en/de/it, sinon
            // le francais, langue du site.
            __html:
              'try{var t=localStorage.getItem("ac_theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light"}' +
              'try{var m={fr:"fr-CH",en:"en",de:"de-CH",it:"it-CH"};var l=localStorage.getItem("ac_lang");if(!m[l]){l=((navigator.language||"fr").slice(0,2).toLowerCase());if(!m[l])l="fr"}document.documentElement.lang=m[l];}catch(e){}',
          }}
        />
        {children}
      </body>
    </html>
  );
}
