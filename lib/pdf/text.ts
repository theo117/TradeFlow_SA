import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, StandardFonts } from "pdf-lib";

const fontFiles = ["NotoSans-Regular.ttf", "NotoSansCJKsc-Regular.ttf"] as const;
const fontBytes = new Map<string, Promise<Buffer>>();
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const clean = (value: string) => value.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
const covered = (value: string, charset: Set<number>) =>
  Array.from(value).every((char) => charset.has(char.codePointAt(0)!));

export async function createPdfText(pdf: PDFDocument, values: string[]) {
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = [{ font: regular, charset: new Set(regular.getCharacterSet()) }];
  let missing = Array.from(new Set(values.flatMap((value) => Array.from(clean(value).replace(/\n/g, "")))))
    .filter((char) => !covered(char, fonts[0].charset));
  for (const file of fontFiles) {
    if (!missing.length) break;
    pdf.registerFontkit(fontkit);
    if (!fontBytes.has(file)) {
      fontBytes.set(file, readFile(path.join(process.cwd(), "lib/pdf/fonts", file))
        .catch((error) => { fontBytes.delete(file); throw error; }));
    }
    const font = await pdf.embedFont(await fontBytes.get(file)!, { subset: true });
    const charset = new Set(font.getCharacterSet());
    fonts.push({ font, charset });
    missing = missing.filter((char) => !covered(char, charset));
  }
  if (missing.length) throw new Error(`PDF font does not support U+${missing[0].codePointAt(0)!.toString(16).toUpperCase()}`);
  function runs(value: string, strong = false) {
    if (covered(value, fonts[0].charset)) return value ? [{ value, font: strong ? bold : regular }] : [];
    const result: { value: string; font: PDFFont }[] = [];
    for (const { segment } of graphemes.segment(value)) {
      const selected = fonts.find(({ charset }) => covered(segment, charset));
      if (!selected) throw new Error("PDF font does not support this grapheme cluster");
      const font = selected.font === regular && strong ? bold : selected.font;
      const last = result.at(-1);
      if (last?.font === font) last.value += segment;
      else result.push({ value: segment, font });
    }
    return result;
  }
  function measure(value: string, size: number, strong = false) {
    return runs(value, strong).reduce((width, run) => width + run.font.widthOfTextAtSize(run.value, size), 0);
  }
  function wrap(value: string, width: number, size: number, strong = false): string[] {
    const lines: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let line = "";
      // Prefer word boundaries, but split long tokens/CJK by grapheme rather than
      // UTF-16 code unit so a surrogate pair or combining cluster stays intact.
      for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
        if (measure(line + token, size, strong) <= width) { line += token; continue; }
        if (line.trim()) { lines.push(line.trimEnd()); line = ""; }
        const word = token.trimStart();
        for (const { segment } of graphemes.segment(word)) {
          if (line && measure(line + segment, size, strong) > width) {
            lines.push(line); line = "";
          }
          if (measure(segment, size, strong) > width) throw new Error("PDF text column is too narrow");
          line += segment;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }
  return { runs, measure, wrap };
}
