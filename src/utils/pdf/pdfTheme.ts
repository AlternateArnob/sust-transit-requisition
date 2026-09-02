import type jsPDF from "jspdf";

export const PDF_COLORS = {
  navy: [15, 39, 71] as [number, number, number],
  slate: [51, 78, 104] as [number, number, number],
  charcoal: [30, 41, 59] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  success: [21, 128, 61] as [number, number, number],
  warning: [180, 83, 9] as [number, number, number],
  error: [185, 28, 28] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export function drawHeader(doc: jsPDF, title: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "Shahjalal University of Science and Technology",
    pageWidth / 2,
    11,
    {
      align: "center",
    },
  );

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Transport Wing", pageWidth / 2, 17, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 24, { align: "center" });

  doc.setTextColor(...PDF_COLORS.charcoal);
  doc.setFont("helvetica", "normal");

  return 36;
}

export function drawFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...PDF_COLORS.border);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, pageHeight - 10);
}
