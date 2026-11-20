import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  drawFooter,
  drawHeader,
  drawInfoRows,
  drawSectionHeading,
  tableStyle,
} from "./pdfTheme";
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

  let y = drawHeader(doc, "Duty Slip", requisition.id);

  y = drawSectionHeading(doc, "Driver and Trip Information", y);

  const infoLines: [string, string][] = [
    ["Driver Name", driver.name],
    ["Designation", driver.designation],
    ["Trip Purpose", requisition.purpose],
  ];

  y = drawInfoRows(doc, infoLines, y);
  y += 5;

  y = drawSectionHeading(doc, "Journey Details", y);

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
    ...tableStyle(),
    startY: y,
    head: [
      ["Date", "Reporting Location", "Reporting Time", "Vehicle", "Route"],
    ],
    body: rows,
  });

  drawFooter(doc);

  doc.save(`duty-slip-${requisition.id}-${driver.id}.pdf`);
}
