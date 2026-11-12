"use client";

import { useEffect, useRef } from "react";

// La banniere d'arcantel.ch est une photo pixelisee en carres cyan et gris.
// Ce composant en fait un fond vivant : une grille de carres qui respirent
// lentement, plus dense en haut de page, et qui s'anime plus vite pendant
// qu'une reponse se prepare. Il ne capte aucun evenement et s'arrete quand
// l'onglet est cache ou que l'utilisateur prefere moins de mouvement.

type Theme = "light" | "dark";

type Cell = {
  x: number;
  y: number;
  phase: number;
  speed: number;
  weight: number;
  tone: 0 | 1 | 2;
};

const CELL = 26;
const GAP = 3;
const FRAME_MS = 1000 / 30;

const TONES: Record<Theme, [string, string, string]> = {
  light: ["0, 161, 198", "158, 159, 158", "26, 25, 25"],
  dark: ["53, 194, 228", "158, 159, 158", "255, 255, 255"],
};

const MAX_ALPHA: Record<Theme, number> = { light: 0.2, dark: 0.26 };

function buildGrid(width: number, height: number): Cell[] {
  const cells: Cell[] = [];
  const columns = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(height / CELL) + 1;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Densite decroissante vers le bas : la mosaique se dissout dans la page.
      const vertical = 1 - row / rows;
      const weight = Math.pow(vertical, 1.7);
      if (Math.random() > weight * 0.9) {
        continue;
      }

      const draw = Math.random();
      const tone: Cell["tone"] = draw < 0.52 ? 0 : draw < 0.9 ? 1 : 2;
      cells.push({
        x: column * CELL,
        y: row * CELL,
        phase: Math.random() * Math.PI * 2,
        speed: 0.35 + Math.random() * 0.55,
        weight,
        tone,
      });
    }
  }

  return cells;
}

export function PixelField({ active, theme }: { active: boolean; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  const themeRef = useRef(theme);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cells: Cell[] = [];
    let width = 0;
    let height = 0;
    let clock = 0;
    let lastFrame = 0;
    let frame = 0;

    const paint = (time: number) => {
      const currentTheme = themeRef.current;
      const [cyan, grey, ink] = TONES[currentTheme];
      const maxAlpha = MAX_ALPHA[currentTheme];

      context.clearRect(0, 0, width, height);
      for (const cell of cells) {
        const pulse = 0.5 + 0.5 * Math.sin(time * cell.speed + cell.phase);
        const alpha = maxAlpha * cell.weight * (0.25 + 0.75 * pulse);
        if (alpha < 0.012) {
          continue;
        }

        const tone = cell.tone === 0 ? cyan : cell.tone === 1 ? grey : ink;
        const scale = cell.tone === 2 ? 0.45 : 1;
        context.fillStyle = `rgba(${tone}, ${alpha * scale})`;
        context.fillRect(cell.x, cell.y, CELL - GAP, CELL - GAP);
      }
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      cells = buildGrid(width, height);
      paint(clock);
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (document.hidden) {
        return;
      }

      const elapsed = now - lastFrame;
      if (elapsed < FRAME_MS) {
        return;
      }

      lastFrame = now;
      // Le temps ne s'ecoule pas a vitesse constante : il accelere pendant la
      // recherche d'une reponse, et revient au calme ensuite.
      clock += (elapsed / 1000) * (activeRef.current ? 3.2 : 1);
      paint(clock);
    };

    resize();
    window.addEventListener("resize", resize);

    if (!reducedMotion.matches) {
      frame = window.requestAnimationFrame(tick);
    }

    const onMotionChange = () => {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) {
        paint(clock);
      } else {
        frame = window.requestAnimationFrame(tick);
      }
    };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  // Le theme change la palette mais pas la grille : on repeint sans rebatir.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // Un simple changement d'attribut suffit : la boucle d'animation lit
    // themeRef a chaque image. En mouvement reduit, aucune boucle ne tourne,
    // le prochain resize repeindra ; on force donc un evenement.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.dispatchEvent(new Event("resize"));
    }
  }, [theme]);

  return <canvas ref={canvasRef} className="ac-pixels" aria-hidden />;
}
