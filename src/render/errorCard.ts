import {
  buildHeaderMarkup,
  buildSectionDivider,
  buildSvgDocument,
  buildSvgImageMarkdown,
  buildText,
  type DetailAppearance,
  DETAIL_FONT_WEIGHT,
  DETAIL_PALETTES,
  getPanelHeight,
  getSectionDividerY,
  getSectionTitleY,
  getTextBottomY,
  wrapText,
} from "./layout";

// The detail-panel card shown when a Provider's usage fetch failed.
export function buildProviderErrorMarkdown(
  title: string,
  error: Error,
  appearance: DetailAppearance = "light",
): string {
  const paragraphs = (error.message || "Unknown error")
    .split(/\r?\n[ \t]*(?:\r?\n)+/)
    .map((paragraph) => wrapText(paragraph, 64));
  const messageFontSize = 14;
  const messageLineAdvance = 24;
  const messageParagraphSpacing = 12;
  const palette = DETAIL_PALETTES[appearance];
  const header = buildHeaderMarkup(title, appearance);
  const markup = [
    ...header.markup,
    buildSectionDivider(getSectionDividerY(header.contentBottomY), palette.dividerStroke),
  ];
  let currentY = getSectionTitleY(header.contentBottomY);
  let lastLineY = currentY;

  for (const [paragraphIndex, lines] of paragraphs.entries()) {
    for (const line of lines) {
      markup.push(buildText(line, 0, currentY, "#FF6B6B", messageFontSize, DETAIL_FONT_WEIGHT.medium));
      lastLineY = currentY;
      currentY += messageLineAdvance;
    }

    if (paragraphIndex < paragraphs.length - 1) {
      currentY += messageParagraphSpacing;
    }
  }

  const height = getPanelHeight(getTextBottomY(lastLineY, messageFontSize));
  const svg = buildSvgDocument(markup, height);

  return buildSvgImageMarkdown(title, svg, height);
}
