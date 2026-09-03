import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { PDF_COLORS, drawHeader, drawFooter } from "./pdfTheme";
import type {
  Requisition,
  Vehicle,
  Driver,
  Trip,
  Allocation,
} from "../../types";

export function generateDutySlipPdf(
  requisition: Requisition,
  driver: Driver,
  trips: { trip: Trip; allocation: Allocation }[],
  vehicles: Vehicle[],
) {
  const doc = new jsPDF();

  let y = drawHeader(doc, "Duty Slip");

  doc.setFontSize(9);

  const infoLines: [string, string][] = [
    ["Application Ref.", requisition.id],
    ["Driver Name", driver.name],
    ["Designation", driver.designation],
    ["Trip Purpose", requisition.purpose],
  ];

  infoLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y, { maxWidth: 130 });
    y += 6;
  });

  y += 4;

  const rows = trips.map(({ trip, allocation }) => {
    const vehicle = vehicles.find((item) => item.id === allocation.vehicleId);
    const reportingLocation = trip.stoppageSequence[0] ?? "Campus";

    return [
      trip.date,
      reportingLocation,
      trip.startTime,
      vehicle ? `${vehicle.registrationNumber}\n${vehicle.category}` : "—",
      trip.stoppageSequence.join(" -> ") || trip.route,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [
      ["Date", "Reporting Location", "Reporting Time", "Vehicle", "Route"],
    ],
    body: rows,
    headStyles: {
      fillColor: PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8, textColor: PDF_COLORS.charcoal },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { lineColor: PDF_COLORS.border, lineWidth: 0.1 },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);

  doc.save(`duty-slip-${requisition.id}-${driver.id}.pdf`);
}
