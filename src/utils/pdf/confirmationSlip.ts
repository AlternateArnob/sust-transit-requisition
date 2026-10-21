import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  PDF_COLORS,
  drawFooter,
  drawHeader,
  drawInfoRows,
  drawSectionHeading,
  tableStyle,
} from "./pdfTheme";
import type { Requisition, Allocation, Vehicle, Driver } from "../../types";

export function generateConfirmationSlip(
  requisition: Requisition,
  allocations: Allocation[],
  vehicles: Vehicle[],
  driver: Driver[],
) {
  const doc = new jsPDF();

  let y = drawHeader(doc, "Confirmation Slip", requisition.id);

  y = drawSectionHeading(doc, "Requester Information", y);

  const infoLines: [string, string][] = [
    ["Requester", requisition.requesterName],
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

  y = drawInfoRows(doc, infoLines, y);
  y += 5;

  y = drawSectionHeading(doc, "Journey Details", y);

  const rows = requisition.trips.map((trip) => {
    const allocation = allocations.find((item) => item.tripId === trip.id);
    const vehicle = allocation
      ? vehicles.find((item) => item.id === allocation.vehicleId)
      : undefined;
    const assignedDriver = allocation?.driverId
      ? driver.find((item) => item.id === allocation.driverId)
      : undefined;

    return [
      trip.date,
      `${trip.startTime}–${trip.endTime}`,
      vehicle
        ? `${vehicle.registrationNumber}\n${vehicle.category}`
        : "Not allocated",
      assignedDriver ? `${assignedDriver.name}\n${assignedDriver.phone ?? ""}` : "—",
      trip.stoppageSequence.join(" -> ") || trip.route,
      trip.status === "Rejected"
        ? `Rejected\n${trip.rejectionReason ?? ""}${
            trip.rejectionRemarks ? `: ${trip.rejectionRemarks}` : ""
          }`
        : trip.status,
    ];
  });

  autoTable(doc, {
    ...tableStyle(),
    startY: y,
    head: [["Date", "Time", "Vehicle", "Driver", "Route", "Status"]],
    body: rows,
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      const status = String(data.cell.raw).split("\n")[0];
      if (status === "Approved") data.cell.styles.textColor = PDF_COLORS.success;
      if (status === "Rejected") data.cell.styles.textColor = PDF_COLORS.error;
    },
  });

  drawFooter(doc);

  doc.save(`confirmation-slip-${requisition.id}.pdf`);
}
