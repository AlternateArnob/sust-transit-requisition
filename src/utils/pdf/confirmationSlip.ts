import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { PDF_COLORS, drawHeader, drawFooter } from "./pdfTheme";
import type { Requisition, Allocation, Vehicle, Staff } from "../../types";

export function generateConfirmationSlip(
  requisition: Requisition,
  allocations: Allocation[],
  vehicles: Vehicle[],
  staff: Staff[],
) {
  const doc = new jsPDF();

  let y = drawHeader(doc, "Confirmation Slip");

  doc.setFontSize(9);

  const infoLines: [string, string][] = [
    ["Application Ref.", requisition.id],
    [
      "Requester",
      `${requisition.requesterName} (${requisition.applicantType})`,
    ],
    ["Department / Organization", requisition.department ?? "—"],
    ["Requisition Type", requisition.requisitionType],
    ["Purpose", requisition.purpose],
    ["Date Range", `${requisition.startDate} to ${requisition.endDate}`],
  ];

  const passengerGroups = [
    ...new Set(requisition.trips.flatMap((trip) => trip.passengerGroups)),
  ];

  if (passengerGroups.length > 0) {
    infoLines.push(["Target Passenger Group(s)", passengerGroups.join(", ")]);
  }

  infoLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y, { maxWidth: 130 });
    y += 6;
  });

  y += 4;

  const rows = requisition.trips.map((trip) => {
    const allocation = allocations.find((item) => item.tripId === trip.id);
    const vehicle = allocation
      ? vehicles.find((item) => item.id === allocation.vehicleId)
      : undefined;
    const driver = allocation?.driverId
      ? staff.find((item) => item.id === allocation.driverId)
      : undefined;

    return [
      trip.date,
      `${trip.startTime}–${trip.endTime}`,
      vehicle
        ? `${vehicle.registrationNumber}\n${vehicle.category}`
        : "Not allocated",
      driver ? `${driver.name}\n${driver.phone ?? ""}` : "—",
      trip.stoppageSequence.join(" -> ") || trip.route,
      trip.status === "Rejected"
        ? `Rejected\n${trip.rejectionReason ?? ""}${
            trip.rejectionRemarks ? `: ${trip.rejectionRemarks}` : ""
          }`
        : trip.status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Date", "Time", "Vehicle", "Driver", "Route", "Status"]],
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

  doc.save(`confirmation-slip-${requisition.id}.pdf`);
}
