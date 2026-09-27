# PDF Unicode fonts

These two regular faces are distributed under the SIL Open Font License 1.1.
CJK copyright: © 2014–2021 Adobe, with Reserved Font Name “Source”.
The derived Noto-named font retains that notice in its metadata.
See LICENSE (CJK) and NotoSans-LICENSE (Latin/Greek/Cyrillic). No other weights
or families are bundled.

- NotoSans-Regular.ttf: unmodified upstream font, revision
  ffebf8c1ee449e544955a7e813c54f9b73848eac:
  https://github.com/notofonts/noto-fonts/blob/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans/NotoSans-Regular.ttf
- NotoSansCJKsc-Regular.ttf: static weight-400 instance of upstream Sans2.004:
  https://github.com/notofonts/noto-cjk/blob/Sans2.004/Sans/Variable/TTF/NotoSansCJKsc-VF.ttf
  Generated once with fonttools 4.61.1:
  `python -m fontTools.varLib.instancer NotoSansCJKsc-VF.ttf wght=400 --output NotoSansCJKsc-Regular.ttf`
  TrueType is intentional: this pdf-lib/fontkit combination produced invalid
  CFF subsets from the upstream .otf. Do not substitute it without raster tests.
  Then align glyph records (outlines and character coverage are unchanged):
  ```python
  from fontTools.ttLib import TTFont
  font = TTFont("NotoSansCJKsc-Regular.ttf")
  font["glyf"].padding = 4
  font.save("NotoSansCJKsc-Regular.ttf")
  ```
  This padding is required because fontkit's subset writer can truncate odd
  glyph offsets when selecting the short `loca` format, producing blank glyphs.
  Fonttools is preparation tooling only, not an application/build dependency.

Helvetica/Helvetica Bold remain in use for WinAnsi text. Noto Sans covers
extended Latin, Greek (including accents) and Cyrillic; Noto Sans CJK covers
Chinese, Japanese and Korean. Runs use a font containing their entire grapheme
cluster. Unsupported code points/clusters raise an explicit error instead of
emitting missing-glyph boxes or '?'. This is not universal Unicode/emoji coverage
or a bidirectional/complex-script layout implementation. Fallback faces are
regular, including in otherwise bold headings.

Font bytes are loaded locally on demand and cached per process. Each PDF embeds
its own subset; mutable embedded fonts are never shared between documents. No
runtime font download occurs. next.config.ts traces this directory into both PDF
routes' standalone output and therefore the existing production Docker runner.

Regression tests use Poppler's pdftotext/pdftoppm when installed to check both
extraction and warning-free rasterization; the other PDF tests need only Node.

SHA-256 of bundled files:

```text
b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5  NotoSans-Regular.ttf
29c441e10606b3e41a4bace16234c57fb84ed667579f0647fabf64606addef3c  NotoSansCJKsc-Regular.ttf
```
