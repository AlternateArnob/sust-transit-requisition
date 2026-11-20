import type jsPDF from "jspdf";
import type { UserOptions } from "jspdf-autotable";

import sustLogo from "../../assets/sust-logo.png?inline";

/**
 * Shared look for the printable slips. Mirrors the requisition form on
 * screen: white page, logo + university name at the top left, bold
 * uppercase title with a rule under it, the application number at the
 * top right, uppercase section headings with a divider, and quiet
 * label/value rows. No large filled bands, so slips print cleanly and
 * don't burn ink.
 */
export const PDF_COLORS = {
  ink: [15, 23, 42] as [number, number, number], // #0F172A
  muted: [100, 116, 139] as [number, number, number], // #64748B
  rule: [226, 232, 240] as [number, number, number], // #E2E8F0
  field: [248, 250, 252] as [number, number, number], // #F8FAFC
  success: [21, 128, 61] as [number, number, number],
  error: [185, 28, 28] as [number, number, number],
};

const MARGIN = 14;

/** Logo height in mm; width follows the 250 x 272 source aspect ratio. */
const LOGO_H = 20;
const LOGO_W = (LOGO_H * 250) / 272;

/**
 * Letterhead. Returns the y position where body content should start.
 */
export function drawHeader(
  doc: jsPDF,
  title: string,
  applicationNo?: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.addImage(sustLogo, "PNG", MARGIN, 12, LOGO_W, LOGO_H);

  const textX = MARGIN + LOGO_W + 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(
    "Shahjalal University of Science and Technology  ·  Transport Wing",
    textX,
    18,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.ink);
  const upper = title.toUpperCase();
  doc.text(upper, textX, 27);

  // Dark rule directly under the title, same width as the text.
  const titleWidth = doc.getTextWidth(upper);
  doc.setDrawColor(...PDF_COLORS.ink);
  doc.setLineWidth(0.6);
  doc.line(textX, 29, textX + titleWidth, 29);

  if (applicationNo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("Application No.", pageWidth - MARGIN, 18, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(applicationNo, pageWidth - MARGIN, 25, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  doc.setLineWidth(0.2);
  return 44;
}

/** Uppercase bold section heading with a full-width light divider. */
export function drawSectionHeading(
  doc: jsPDF,
  text: string,
  y: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(text.toUpperCase(), MARGIN, y);

  doc.setDrawColor(...PDF_COLORS.rule);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 2.5, pageWidth - MARGIN, y + 2.5);

  doc.setFont("helvetica", "normal");
  return y + 9;
}

/** Muted label on the left, dark value on the right; wraps long values. */
export function drawInfoRows(
  doc: jsPDF,
  rows: [string, string][],
  y: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const valueX = MARGIN + 52;
  const valueWidth = pageWidth - MARGIN - valueX;

  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(label, MARGIN, y);

    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(value, valueWidth) as string[];
    doc.text(lines, valueX, y);
    y += Math.max(1, lines.length) * 4.6 + 1.6;
  }
  doc.setFont("helvetica", "normal");
  return y;
}

/** Table styling shared by both slips: light header, thin rules, ink text. */
export function tableStyle(): Partial<UserOptions> {
  return {
    theme: "grid",
    headStyles: {
      fillColor: PDF_COLORS.field,
      textColor: PDF_COLORS.ink,
      fontStyle: "bold",
      fontSize: 8,
      lineColor: PDF_COLORS.rule,
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: PDF_COLORS.ink,
      lineColor: PDF_COLORS.rule,
      lineWidth: 0.2,
    },
    styles: { cellPadding: 2.5, valign: "top" },
    margin: { left: MARGIN, right: MARGIN },
  };
}

/** Footer on every page: generated time on the left, page x of y on the right. */
export function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...PDF_COLORS.rule);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageHeight - 16, pageWidth - MARGIN, pageHeight - 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, pageHeight - 10);
    doc.text(`Page ${page} of ${total}`, pageWidth - MARGIN, pageHeight - 10, {
      align: "right",
    });
  }
}
