import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servie sous un sous-chemin en production (ex. /demo) :
  // le basePath est fige au build par NEXT_PUBLIC_BASE_PATH, vide en dev.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Image Docker minimale : le serveur et ses seules dependances.
  output: "standalone",
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Les bibliotheques d'export (docx, pptxgenjs, jspdf, xlsx) sont
      // isomorphes : leur point d'entree reference des modules Node ("fs",
      // "https", parfois sous la forme "node:fs") derriere des gardes qui ne
      // s'executent jamais dans un navigateur. Webpack doit quand meme les
      // resoudre : on retire le schema "node:" puis on declare ces modules
      // absents, et le code navigateur de chaque bibliotheque suit son chemin.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        zlib: false,
        http: false,
        https: false,
        url: false,
        child_process: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
