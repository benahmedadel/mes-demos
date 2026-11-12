// Export d'une conversation dans cinq formats, genere dans le navigateur a
// partir de l'etat de la page, dans la langue de l'interface. Les
// bibliotheques lourdes (docx, pptxgenjs, xlsx, jspdf) sont chargees a la
// demande : la page ne les paie que quand quelqu'un exporte.

import { isPublicUrl, sourceLabel } from "./conversation";
import type { ChatMessage, Source } from "./conversation";
import type { Locale, Strings } from "./i18n";

export type ExportFormat = "markdown" | "pdf" | "docx" | "xlsx" | "pptx";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; extension: string }[] = [
  { id: "pdf", label: "PDF", extension: "pdf" },
  { id: "docx", label: "Word", extension: "docx" },
  { id: "pptx", label: "PowerPoint", extension: "pptx" },
  { id: "xlsx", label: "Excel", extension: "xlsx" },
  { id: "markdown", label: "Markdown", extension: "md" },
];

export type ExportOptions = { strings: Strings; locale: Locale };

const BRAND_CYAN = "00A1C6";
const BRAND_INK = "1F2426";
const BRAND_MUTED = "66717A";

const DATE_LOCALE: Record<Locale, string> = { fr: "fr-CH", en: "en-GB", de: "de-CH", it: "it-CH" };

// ---------------------------------------------------------------------------
// Du Markdown des reponses a des blocs simples, communs a tous les formats
// ---------------------------------------------------------------------------

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[] };

function inlineToPlain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) =>
      isPublicUrl(href) ? `${label} (${href})` : label,
    )
    .trim();
}

export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.map(inlineToPlain).join("\n") });
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: inlineToPlain(heading[1]) });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "bullets") {
        last.items.push(inlineToPlain(bullet[1]));
      } else {
        blocks.push({ kind: "bullets", items: [inlineToPlain(bullet[1])] });
      }
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "numbered") {
        last.items.push(inlineToPlain(numbered[1]));
      } else {
        blocks.push({ kind: "numbered", items: [inlineToPlain(numbered[1])] });
      }
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]+\)$/.test(line)) {
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return block.text.toUpperCase();
        case "paragraph":
          return block.text;
        case "bullets":
          return block.items.map((item) => `• ${item}`).join("\n");
        case "numbered":
          return block.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
      }
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Vue "echanges" : une question suivie de sa reponse
// ---------------------------------------------------------------------------

type Exchange = { index: number; question: ChatMessage | null; answer: ChatMessage | null };

function toExchanges(messages: ChatMessage[]): Exchange[] {
  const exchanges: Exchange[] = [];
  let current: Exchange | null = null;

  for (const message of messages) {
    if (message.id === "welcome" || message.kind === "memory-summary") {
      continue;
    }
    if (message.role === "user") {
      current = { index: exchanges.length + 1, question: message, answer: null };
      exchanges.push(current);
    } else if (current && !current.answer) {
      current.answer = message;
    } else {
      exchanges.push({ index: exchanges.length + 1, question: null, answer: message });
      current = null;
    }
  }

  return exchanges;
}

type Context = {
  s: Strings["export"];
  confidence: Strings["confidence"];
  you: string;
  date: string;
  stem: string;
};

function buildContext(options: ExportOptions): Context {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    s: options.strings.export,
    confidence: options.strings.confidence,
    you: options.strings.you,
    date: new Intl.DateTimeFormat(DATE_LOCALE[options.locale], { dateStyle: "long", timeStyle: "short" }).format(now),
    stem: `arcantel-conversation-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`,
  };
}

function sourceLine(source: Source, index: number): string {
  const label = sourceLabel(source);
  return isPublicUrl(source.canonical_url) ? `${index + 1}. ${label} — ${source.canonical_url}` : `${index + 1}. ${label}`;
}

function confidenceText(message: ChatMessage, ctx: Context): string {
  return message.confidence ? ctx.confidence[message.confidence] : "";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Laisser au navigateur le temps d'ouvrir le flux avant de revoquer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------
// Point d'entree
// ---------------------------------------------------------------------------

export async function exportConversation(
  format: ExportFormat,
  messages: ChatMessage[],
  options: ExportOptions,
): Promise<void> {
  const exchanges = toExchanges(messages);
  if (!exchanges.length) {
    throw new Error(options.strings.errors.emptyExport);
  }

  const ctx = buildContext(options);
  switch (format) {
    case "markdown":
      return exportMarkdown(exchanges, ctx);
    case "pdf":
      return exportPdf(exchanges, ctx);
    case "docx":
      return exportDocx(exchanges, ctx);
    case "xlsx":
      return exportXlsx(exchanges, ctx);
    case "pptx":
      return exportPptx(exchanges, ctx);
  }
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function exportMarkdown(exchanges: Exchange[], ctx: Context): void {
  const { s } = ctx;
  const lines: string[] = [`# ${s.title}`, "", `_${s.exportedAt(ctx.date)}_`, ""];

  for (const exchange of exchanges) {
    lines.push(`## ${exchange.index}. ${exchange.question ? inlineToPlain(exchange.question.text) : s.answer}`, "");
    if (exchange.answer) {
      lines.push(exchange.answer.text.trim(), "");
      const confidence = confidenceText(exchange.answer, ctx);
      if (confidence) {
        lines.push(`**${confidence}**`, "");
      }
      const sources = exchange.answer.sources ?? [];
      if (sources.length) {
        lines.push(`**${s.sources}**`, "");
        sources.forEach((source, index) => {
          const label = sourceLabel(source);
          lines.push(
            isPublicUrl(source.canonical_url)
              ? `${index + 1}. [${label}](${source.canonical_url})`
              : `${index + 1}. ${label}`,
          );
        });
        lines.push("");
      }
      const citations = (exchange.answer.citations ?? []).filter((citation) => citation.quote.trim());
      if (citations.length) {
        lines.push(`**${s.citations}**`, "");
        citations.forEach((citation) => lines.push(`> « ${citation.quote.trim()} »`));
        lines.push("");
      }
    } else {
      lines.push(`_${s.noAnswer}_`, "");
    }
    lines.push("---", "");
  }

  triggerDownload(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }), `${ctx.stem}.md`);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function exportPdf(exchanges: Exchange[], ctx: Context): Promise<void> {
  const { s } = ctx;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const width = pageWidth - margin * 2;
  let y = margin;

  const ensureRoom = (height: number) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (
    text: string,
    size: number,
    color: string,
    options: { bold?: boolean; indent?: number; gapAfter?: number } = {},
  ) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(`#${color}`);
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(text, width - indent) as string[];
    const lineHeight = size * 0.5;
    for (const line of lines) {
      ensureRoom(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += options.gapAfter ?? 1.5;
  };

  // Bandeau de titre aux couleurs de la marque.
  doc.setFillColor(`#${BRAND_CYAN}`);
  doc.rect(0, 0, pageWidth, 4, "F");
  y = margin + 2;
  writeLines(s.title, 18, BRAND_INK, { bold: true, gapAfter: 1 });
  writeLines(s.exportedAt(ctx.date), 9.5, BRAND_MUTED, { gapAfter: 6 });

  for (const exchange of exchanges) {
    ensureRoom(16);
    doc.setDrawColor(`#${BRAND_CYAN}`);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + 10, y);
    y += 5;

    if (exchange.question) {
      writeLines(ctx.you.toUpperCase(), 8, BRAND_CYAN, { bold: true, gapAfter: 0.5 });
      writeLines(inlineToPlain(exchange.question.text), 11.5, BRAND_INK, { bold: true, gapAfter: 4 });
    }

    if (exchange.answer) {
      writeLines("ARCANTEL", 8, BRAND_CYAN, { bold: true, gapAfter: 0.5 });
      for (const block of markdownToBlocks(exchange.answer.text)) {
        switch (block.kind) {
          case "heading":
            writeLines(block.text, 11.5, BRAND_INK, { bold: true, gapAfter: 1 });
            break;
          case "paragraph":
            writeLines(block.text, 10.5, BRAND_INK, { gapAfter: 2.5 });
            break;
          case "bullets":
            block.items.forEach((item) => writeLines(`•  ${item}`, 10.5, BRAND_INK, { indent: 3, gapAfter: 0.8 }));
            y += 1.5;
            break;
          case "numbered":
            block.items.forEach((item, index) =>
              writeLines(`${index + 1}.  ${item}`, 10.5, BRAND_INK, { indent: 3, gapAfter: 0.8 }),
            );
            y += 1.5;
            break;
        }
      }

      const confidence = confidenceText(exchange.answer, ctx);
      const sources = exchange.answer.sources ?? [];
      if (confidence || sources.length) {
        y += 1;
        if (confidence) {
          writeLines(confidence, 8.5, BRAND_MUTED, { bold: true, gapAfter: 1 });
        }
        sources.forEach((source, index) => writeLines(sourceLine(source, index), 8.5, BRAND_MUTED, { gapAfter: 0.6 }));
      }
    } else {
      writeLines(s.noAnswer, 10, BRAND_MUTED, { gapAfter: 2 });
    }

    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(`#${BRAND_MUTED}`);
    doc.text(`${s.footer} — ${page}/${pages}`, margin, pageHeight - 10);
  }

  doc.save(`${ctx.stem}.pdf`);
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

async function exportDocx(exchanges: Exchange[], ctx: Context): Promise<void> {
  const { s } = ctx;
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, AlignmentType } = docx;

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: s.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: s.exportedAt(ctx.date), color: BRAND_MUTED, size: 20 })],
      spacing: { after: 360 },
    }),
  ];

  for (const exchange of exchanges) {
    if (exchange.question) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `${exchange.index}. ${inlineToPlain(exchange.question.text)}`, color: BRAND_INK })],
          spacing: { before: 360, after: 160 },
        }),
      );
    }

    if (!exchange.answer) {
      children.push(new Paragraph({ children: [new TextRun({ text: s.noAnswer, italics: true, color: BRAND_MUTED })] }));
      continue;
    }

    for (const block of markdownToBlocks(exchange.answer.text)) {
      switch (block.kind) {
        case "heading":
          children.push(new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_3 }));
          break;
        case "paragraph":
          children.push(
            new Paragraph({
              children: block.text
                .split("\n")
                .flatMap((line, index) => (index === 0 ? [new TextRun(line)] : [new TextRun({ text: line, break: 1 })])),
              spacing: { after: 160 },
            }),
          );
          break;
        case "bullets":
          block.items.forEach((item) =>
            children.push(new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 60 } })),
          );
          break;
        case "numbered":
          block.items.forEach((item, index) =>
            children.push(new Paragraph({ text: `${index + 1}. ${item}`, indent: { left: 540 }, spacing: { after: 60 } })),
          );
          break;
      }
    }

    const confidence = confidenceText(exchange.answer, ctx);
    const sources = exchange.answer.sources ?? [];
    if (confidence || sources.length) {
      const meta: InstanceType<typeof TextRun>[] = [];
      if (confidence) {
        meta.push(new TextRun({ text: confidence, bold: true, color: BRAND_CYAN, size: 18 }));
      }
      children.push(new Paragraph({ children: meta, spacing: { before: 200, after: 80 } }));
      sources.forEach((source, index) => {
        const label = `${index + 1}. ${sourceLabel(source)}`;
        children.push(
          new Paragraph({
            children: isPublicUrl(source.canonical_url)
              ? [
                  new ExternalHyperlink({
                    link: source.canonical_url,
                    children: [new TextRun({ text: label, style: "Hyperlink", size: 18 })],
                  }),
                ]
              : [new TextRun({ text: label, color: BRAND_MUTED, size: 18 })],
            spacing: { after: 40 },
          }),
        );
      });
    }
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: s.footer, color: BRAND_MUTED, size: 16 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    }),
  );

  const document = new Document({
    creator: "Arcantel",
    title: s.title,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: BRAND_INK } } },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(document);
  triggerDownload(blob, `${ctx.stem}.docx`);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

// exceljs plutot que xlsx : la version libre de xlsx n'ecrit aucun style, donc
// ni retour a la ligne dans les cellules (une reponse de 900 caracteres sur
// une seule ligne), ni en-tete, ni volet fige. Un tableur qu'on ne peut pas
// lire n'est pas un export.
async function exportXlsx(exchanges: Exchange[], ctx: Context): Promise<void> {
  const { s } = ctx;
  const mod = await import("exceljs");
  const ExcelJS = (mod.default ?? mod) as typeof import("exceljs");
  const c = s.columns;

  const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: `FF${BRAND_CYAN}` } };
  const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const BODY_FONT = { color: { argb: `FF${BRAND_INK}` }, size: 11 };
  const LINK_FONT = { color: { argb: "FF0081A1" }, underline: true, size: 11 };
  const ROW_BORDER = { bottom: { style: "hair" as const, color: { argb: "FFCFD4D8" } } };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Arcantel";
  workbook.created = new Date();

  const styleHeader = (sheet: import("exceljs").Worksheet) => {
    const header = sheet.getRow(1);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  };

  const styleBody = (sheet: import("exceljs").Worksheet) => {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = ROW_BORDER;
        if (!cell.font) {
          cell.font = BODY_FONT;
        }
      });
    });
  };

  // --- Conversation : une ligne par echange, texte renvoye a la ligne ------
  const conversation = workbook.addWorksheet(s.sheetConversation);
  conversation.columns = [
    { header: c.index, key: "index", width: 6 },
    { header: c.question, key: "question", width: 40 },
    { header: c.answer, key: "answer", width: 80 },
    { header: c.confidence, key: "confidence", width: 20 },
    { header: c.sources, key: "sources", width: 52 },
  ];

  for (const exchange of exchanges) {
    const answer = exchange.answer;
    const sources = answer?.sources ?? [];
    conversation.addRow({
      index: exchange.index,
      question: exchange.question ? inlineToPlain(exchange.question.text) : "",
      answer: answer ? blocksToPlainText(markdownToBlocks(answer.text)) : s.noAnswer,
      confidence: answer ? confidenceText(answer, ctx) : "",
      sources: sources
        .map((source, index) =>
          isPublicUrl(source.canonical_url)
            ? `${index + 1}. ${sourceLabel(source)}\n${source.canonical_url}`
            : `${index + 1}. ${sourceLabel(source)}`,
        )
        .join("\n"),
    });
  }
  styleHeader(conversation);
  styleBody(conversation);
  conversation.getColumn("index").alignment = { vertical: "top", horizontal: "center" };

  // --- Sources : une ligne par source, URL cliquable -----------------------
  const sourcesSheet = workbook.addWorksheet(s.sheetSources);
  sourcesSheet.columns = [
    { header: c.index, key: "index", width: 10 },
    { header: c.rank, key: "rank", width: 8 },
    { header: c.title, key: "title", width: 48 },
    { header: c.url, key: "url", width: 60 },
    { header: c.score, key: "score", width: 10 },
  ];
  for (const exchange of exchanges) {
    (exchange.answer?.sources ?? []).forEach((source, index) => {
      const row = sourcesSheet.addRow({
        index: exchange.index,
        rank: index + 1,
        title: sourceLabel(source),
        url: isPublicUrl(source.canonical_url) ? source.canonical_url : "",
        score: Number(source.score.toFixed(4)),
      });
      if (isPublicUrl(source.canonical_url)) {
        const cell = row.getCell("url");
        cell.value = { text: source.canonical_url, hyperlink: source.canonical_url };
        cell.font = LINK_FONT;
      }
    });
  }
  styleHeader(sourcesSheet);
  styleBody(sourcesSheet);

  // --- A propos ------------------------------------------------------------
  const about = workbook.addWorksheet(s.sheetAbout);
  about.columns = [
    { header: "", key: "label", width: 16 },
    { header: "", key: "value", width: 64 },
  ];
  about.addRow({ label: s.about.title, value: s.title });
  about.addRow({ label: s.about.date, value: ctx.date });
  about.addRow({ label: s.about.exchanges, value: exchanges.length });
  const site = about.addRow({ label: s.about.site, value: "https://www.arcantel.ch/" });
  site.getCell("value").value = { text: "https://www.arcantel.ch/", hyperlink: "https://www.arcantel.ch/" };
  site.getCell("value").font = LINK_FONT;
  about.spliceRows(1, 1);
  about.eachRow((row) => {
    row.getCell("label").font = { bold: true, color: { argb: `FF${BRAND_INK}` } };
    row.alignment = { vertical: "top", wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${ctx.stem}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// PowerPoint
// ---------------------------------------------------------------------------

async function exportPptx(exchanges: Exchange[], ctx: Context): Promise<void> {
  const { s } = ctx;
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = s.title;
  pptx.company = "Arcantel SA";

  const FONT = "Calibri";

  // Diapositive de titre : bandeau cyan, titre, date.
  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.35, fill: { color: BRAND_CYAN } });
  cover.addText("Arcantel SA · Neuchâtel", {
    x: 0.6, y: 1.5, w: 8.8, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: BRAND_CYAN, charSpacing: 2,
  });
  cover.addText(s.title, { x: 0.6, y: 1.95, w: 8.8, h: 1.2, fontFace: FONT, fontSize: 32, bold: true, color: BRAND_INK });
  cover.addText(`${s.exportedAt(ctx.date)} — ${s.exchanges(exchanges.length)}`, {
    x: 0.6, y: 3.2, w: 8.8, h: 0.4, fontFace: FONT, fontSize: 13, color: BRAND_MUTED,
  });
  cover.addText("arcantel.ch", { x: 0.6, y: 4.9, w: 4, h: 0.3, fontFace: FONT, fontSize: 11, color: BRAND_CYAN });

  for (const exchange of exchanges) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.35, fill: { color: BRAND_CYAN } });

    const question = exchange.question ? inlineToPlain(exchange.question.text) : s.answer;
    slide.addText(`${exchange.index}`, { x: 0.6, y: 0.55, w: 0.6, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: BRAND_CYAN });
    slide.addText(question, { x: 1.1, y: 0.5, w: 8.3, h: 0.7, fontFace: FONT, fontSize: 18, bold: true, color: BRAND_INK, fit: "shrink" });

    const runs: { text: string; options?: Record<string, unknown> }[] = [];
    if (exchange.answer) {
      for (const block of markdownToBlocks(exchange.answer.text)) {
        switch (block.kind) {
          case "heading":
            runs.push({ text: block.text, options: { bold: true, breakLine: true, paraSpaceBefore: 6 } });
            break;
          case "paragraph":
            runs.push({ text: block.text, options: { breakLine: true, paraSpaceAfter: 6 } });
            break;
          case "bullets":
            block.items.forEach((item) => runs.push({ text: item, options: { bullet: true, breakLine: true } }));
            break;
          case "numbered":
            block.items.forEach((item) => runs.push({ text: item, options: { bullet: { type: "number" }, breakLine: true } }));
            break;
        }
      }
    } else {
      runs.push({ text: s.noAnswer, options: { italic: true, color: BRAND_MUTED } });
    }

    slide.addText(runs, {
      x: 0.6, y: 1.35, w: 8.8, h: 3.3, fontFace: FONT, fontSize: 13, color: BRAND_INK, valign: "top", fit: "shrink", paraSpaceAfter: 4,
    });

    const footer: string[] = [];
    if (exchange.answer) {
      const confidence = confidenceText(exchange.answer, ctx);
      if (confidence) {
        footer.push(confidence);
      }
      (exchange.answer.sources ?? []).forEach((source, index) => footer.push(sourceLine(source, index)));
    }
    if (footer.length) {
      slide.addText(footer.join("\n"), {
        x: 0.6, y: 4.75, w: 8.8, h: 0.7, fontFace: FONT, fontSize: 9, color: BRAND_MUTED, valign: "top", fit: "shrink",
      });
    }
  }

  await pptx.writeFile({ fileName: `${ctx.stem}.pptx` });
}
