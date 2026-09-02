import { useState } from "react";

import {
  REQUISITION_TYPES,
  APPLICANT_TYPES,
  VEHICLE_CATEGORIES,
  type Requisition,
  type RequisitionType,
  type ApplicantType,
  type ScheduleType,
  type VehicleCategory,
  type Trip,
} from "../types";

interface RequisitionFormProps {
  onSubmit: (requisition: Requisition) => void;
  onCancel: () => void;
}

// ---------- Flexible multi-trip fields (Club / Official) ----------

interface TripDraft {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  vehicleCategory: VehicleCategory | "";
  route: string;
  stops: string[];
  passengerGroups: string;
}

function emptyTrip(): TripDraft {
  return {
    key: crypto.randomUUID(),
    date: "",
    startTime: "",
    endTime: "",
    vehicleCategory: "",
    route: "",
    stops: [""],
    passengerGroups: "",
  };
}

export default function RequisitionForm({
  onSubmit,
  onCancel,
}: RequisitionFormProps) {
  const [requisitionType, setRequisitionType] =
    useState<RequisitionType>("Personal");

  const isPaperForm =
    requisitionType === "Personal" || requisitionType === "Departmental";

  // ---- Paper-form (Personal / Departmental) state ----
  const [requesterName, setRequesterName] = useState("");
  const [requesterMobile, setRequesterMobile] = useState("");
  const [designationDept, setDesignationDept] = useState("");
  const [sameAsRequester, setSameAsRequester] = useState(true);
  const [userName, setUserName] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [paperDate, setPaperDate] = useState("");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("12:00");
  const [destination, setDestination] = useState("");
  const [paperVehicleCategory, setPaperVehicleCategory] = useState<
    VehicleCategory | ""
  >("");
  const [reasonForRequisition, setReasonForRequisition] = useState("");

  // ---- Flexible form (Club / Official) state ----
  const [applicantType, setApplicantType] =
    useState<ApplicantType>("Individual");
  const [department, setDepartment] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("Single");
  const [trips, setTrips] = useState<TripDraft[]>([emptyTrip()]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateTrip(key: string, patch: Partial<TripDraft>) {
    setTrips((current) =>
      current.map((trip) => (trip.key === key ? { ...trip, ...patch } : trip)),
    );
  }

  function addTrip() {
    setTrips((current) => [...current, emptyTrip()]);
  }

  function removeTrip(key: string) {
    setTrips((current) => current.filter((trip) => trip.key !== key));
  }

  function updateStop(tripKey: string, index: number, value: string) {
    setTrips((current) =>
      current.map((trip) =>
        trip.key === tripKey
          ? {
              ...trip,
              stops: trip.stops.map((stop, stopIndex) =>
                stopIndex === index ? value : stop,
              ),
            }
          : trip,
      ),
    );
  }

  function addStop(tripKey: string) {
    setTrips((current) =>
      current.map((trip) =>
        trip.key === tripKey ? { ...trip, stops: [...trip.stops, ""] } : trip,
      ),
    );
  }

  function removeStop(tripKey: string, index: number) {
    setTrips((current) =>
      current.map((trip) =>
        trip.key === tripKey
          ? {
              ...trip,
              stops: trip.stops.filter((_, stopIndex) => stopIndex !== index),
            }
          : trip,
      ),
    );
  }

  const durationMinutes = (() => {
    if (!fromTime || !toTime) return 0;
    const [fromH, fromM] = fromTime.split(":").map(Number);
    const [toH, toM] = toTime.split(":").map(Number);

    const startInMinutes = fromH * 60 + fromM;
    const endInMinutes = toH * 60 + toM;

    return endInMinutes >= startInMinutes ? endInMinutes - startInMinutes : 0;
  })();

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (isPaperForm) {
      if (!requesterName.trim()) {
        newErrors.requesterName = "Requester name is required.";
      }

      if (!requesterMobile.trim()) {
        newErrors.requesterMobile = "Mobile number is required.";
      }

      if (!designationDept.trim()) {
        newErrors.designationDept =
          "Designation and Department/Office is required.";
      }

      if (!sameAsRequester && !userName.trim()) {
        newErrors.userName =
          "User's name is required, or check 'Same as requester'.";
      }

      if (!sameAsRequester && !userMobile.trim()) {
        newErrors.userMobile =
          "User's mobile number is required, or check 'Same as requester'.";
      }

      if (!paperDate) {
        newErrors.paperDate = "Date is required.";
      }

      if (!fromTime || !toTime) {
        newErrors.time = "Both Start and End times are required.";
      }

      if (!destination.trim()) {
        newErrors.destination = "Destination is required.";
      }

      if (!paperVehicleCategory) {
        newErrors.paperVehicleCategory = "Vehicle category is required.";
      }

      if (!reasonForRequisition.trim()) {
        newErrors.reasonForRequisition = "Reason is required.";
      }
    } else {
      if (!requesterName.trim()) {
        newErrors.requesterName = "Requester name is required.";
      }

      if (!purpose.trim()) {
        newErrors.purpose = "Purpose is required.";
      }

      if (!startDate) {
        newErrors.startDate = "Start date is required.";
      }

      if (!endDate) {
        newErrors.endDate = "End date is required.";
      } else if (startDate && endDate < startDate) {
        newErrors.endDate = "End date cannot be before start date.";
      }

      const validTrips = trips.filter(
        (trip) =>
          trip.date &&
          trip.startTime &&
          trip.endTime &&
          trip.vehicleCategory &&
          trip.route.trim(),
      );

      if (validTrips.length === 0) {
        newErrors.trips =
          "Add at least one complete trip (date, time, vehicle category, route).";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (isPaperForm) {
      const trip: Trip = {
        id: crypto.randomUUID(),
        date: paperDate,
        startTime: fromTime,
        endTime: toTime,
        vehicleCategory: paperVehicleCategory as VehicleCategory,
        route: `Campus to ${destination.trim()} and Return to Campus`,
        stoppageSequence: ["Campus", destination.trim(), "Campus"],
        passengerGroups: [],
        status: "Pending",
      };

      const requisition: Requisition = {
        id: crypto.randomUUID(),
        requesterId: crypto.randomUUID(),
        requesterName: requesterName.trim(),
        applicantType: "Individual",
        department: designationDept.trim(),
        contactNumber: requesterMobile.trim(),
        requisitionType,
        purpose: reasonForRequisition.trim(),
        startDate: paperDate,
        endDate: paperDate,
        scheduleType: "Single",
        status:
          requisitionType === "Personal" ? "Pending Approval" : "Recommended",
        createdAt: new Date().toISOString(),
        trips: [trip],
      };

      onSubmit(requisition);
      return;
    }

    const builtTrips: Trip[] = trips
      .filter(
        (trip) =>
          trip.date &&
          trip.startTime &&
          trip.endTime &&
          trip.vehicleCategory &&
          trip.route.trim(),
      )
      .map((trip) => ({
        id: crypto.randomUUID(),
        date: trip.date,
        startTime: trip.startTime,
        endTime: trip.endTime,
        vehicleCategory: trip.vehicleCategory as VehicleCategory,
        route: trip.route.trim(),
        stoppageSequence: trip.stops.map((stop) => stop.trim()).filter(Boolean),
        passengerGroups: trip.passengerGroups
          .split(",")
          .map((group) => group.trim())
          .filter(Boolean),
        status: "Pending",
      }));

    const requisition: Requisition = {
      id: crypto.randomUUID(),
      requesterId: crypto.randomUUID(),
      requesterName: requesterName.trim(),
      applicantType,
      department: department.trim() || undefined,
      contactNumber: contactNumber.trim() || undefined,
      requisitionType,
      purpose: purpose.trim(),
      startDate,
      endDate,
      scheduleType,
      status:
        requisitionType === "Personal" ? "Pending Approval" : "Recommended",
      createdAt: new Date().toISOString(),
      trips: builtTrips,
    };

    onSubmit(requisition);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs text-[#334E68]">
        This creates a requisition already at "Recommended" status — simulating
        one that already passed the recommender workflow, which this system
        doesn't implement.
      </p>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
          Requisition Type
        </label>

        <select
          value={requisitionType}
          onChange={(event) =>
            setRequisitionType(event.target.value as RequisitionType)
          }
          className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
        >
          {REQUISITION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {isPaperForm ? (
        <>
          {/* Requester Teacher/Officer */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Requester Teacher/Officer Name
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(event) => setRequesterName(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.requesterName && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {errors.requesterName}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Mobile No.
              </label>
              <input
                type="tel"
                value={requesterMobile}
                onChange={(event) => setRequesterMobile(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.requesterMobile && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {errors.requesterMobile}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Designation and Department/Office
              </label>
              <input
                type="text"
                value={designationDept}
                onChange={(event) => setDesignationDept(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.designationDept && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {errors.designationDept}
                </p>
              )}
            </div>
          </div>

          {/* User (if different from requester) */}
          <div>
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input
                type="checkbox"
                checked={sameAsRequester}
                onChange={(event) => setSameAsRequester(event.target.checked)}
              />
              User is the same as the requester above
            </label>
          </div>

          {!sameAsRequester && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                  User's Name and Designation
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                />
                {errors.userName && (
                  <p className="mt-1 text-xs text-[#B91C1C]">
                    {errors.userName}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                  User's Mobile No.
                </label>
                <input
                  type="tel"
                  value={userMobile}
                  onChange={(event) => setUserMobile(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                />
                {errors.userMobile && (
                  <p className="mt-1 text-xs text-[#B91C1C]">
                    {errors.userMobile}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Date + Time */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Date of Vehicle Requirement
            </label>
            <input
              type="date"
              value={paperDate}
              onChange={(event) => setPaperDate(event.target.value)}
              className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            />
            {errors.paperDate && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.paperDate}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Time (Vehicle must NOT be kept for more than 03 hours)
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  From Time
                </label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(event) => setFromTime(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#64748B]">
                  To Time
                </label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(event) => setToTime(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                />
              </div>
            </div>

            {errors.time && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.time}</p>
            )}

            {durationMinutes > 180 && (
              <p className="mt-1 text-xs text-[#B45309]">
                ⚠ This exceeds the 3-hour limit — admin can still approve, but
                flag it.
              </p>
            )}
          </div>

          {/* Destination */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Destination
            </label>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-sm text-[#64748B]">
                From Campus to
              </span>
              <input
                type="text"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              <span className="whitespace-nowrap text-sm text-[#64748B]">
                and Return to Campus
              </span>
            </div>
            {errors.destination && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {errors.destination}
              </p>
            )}
          </div>

          {/* Vehicle Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Vehicle Category
            </label>
            <select
              value={paperVehicleCategory}
              onChange={(event) =>
                setPaperVehicleCategory(event.target.value as VehicleCategory)
              }
              className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            >
              <option value="">Select category</option>
              {VEHICLE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#64748B]">
              For office reference — the admin can still pick any vehicle when
              approving.
            </p>
            {errors.paperVehicleCategory && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {errors.paperVehicleCategory}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Reason for Vehicle Requisition
            </label>
            <textarea
              value={reasonForRequisition}
              onChange={(event) => setReasonForRequisition(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            />
            {errors.reasonForRequisition && (
              <p className="mt-1 text-xs text-[#B91C1C]">
                {errors.reasonForRequisition}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Requester Name
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(event) => setRequesterName(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.requesterName && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {errors.requesterName}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Applicant Type
              </label>
              <div className="flex h-10 items-center gap-5">
                {APPLICANT_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 text-sm text-[#1E293B]"
                  >
                    <input
                      type="radio"
                      name="applicantType"
                      checked={applicantType === type}
                      onChange={() => setApplicantType(type)}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Department / Organization (optional)
              </label>
              <input
                type="text"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Contact Number (optional)
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Schedule Type
            </label>
            <div className="flex h-10 items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-[#1E293B]">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "Single"}
                  onChange={() => setScheduleType("Single")}
                />
                Single
              </label>
              <label className="flex items-center gap-2 text-sm text-[#1E293B]">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "Recurring"}
                  onChange={() => setScheduleType("Recurring")}
                />
                Recurring
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
              Purpose
            </label>
            <textarea
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              rows={2}
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
            />
            {errors.purpose && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.purpose}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-[#B91C1C]">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1E293B]">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-[#B91C1C]">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-[#1E293B]">
                Trip Requests
              </label>
              <button
                type="button"
                onClick={addTrip}
                className="text-sm font-medium text-[#334E68] hover:underline"
              >
                + Add Trip
              </button>
            </div>

            <div className="space-y-4">
              {trips.map((trip, tripIndex) => (
                <div
                  key={trip.key}
                  className="rounded-md border border-[#E2E8F0] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1E293B]">
                      Trip {tripIndex + 1}
                    </p>
                    {trips.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrip(trip.key)}
                        className="text-xs font-medium text-[#B91C1C] hover:underline"
                      >
                        Remove Trip
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Date
                      </label>
                      <input
                        type="date"
                        value={trip.date}
                        onChange={(event) =>
                          updateTrip(trip.key, { date: event.target.value })
                        }
                        className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Vehicle Category
                      </label>
                      <select
                        value={trip.vehicleCategory}
                        onChange={(event) =>
                          updateTrip(trip.key, {
                            vehicleCategory: event.target
                              .value as VehicleCategory,
                          })
                        }
                        className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      >
                        <option value="">Select category</option>
                        {VEHICLE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={trip.startTime}
                        onChange={(event) =>
                          updateTrip(trip.key, {
                            startTime: event.target.value,
                          })
                        }
                        className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={trip.endTime}
                        onChange={(event) =>
                          updateTrip(trip.key, { endTime: event.target.value })
                        }
                        className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Destination / Route
                      </label>
                      <input
                        type="text"
                        value={trip.route}
                        onChange={(event) =>
                          updateTrip(trip.key, { route: event.target.value })
                        }
                        placeholder="e.g. Campus to Osmani International Airport"
                        className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Passenger Groups (comma-separated, optional)
                      </label>
                      <input
                        type="text"
                        value={trip.passengerGroups}
                        onChange={(event) =>
                          updateTrip(trip.key, {
                            passengerGroups: event.target.value,
                          })
                        }
                        placeholder="e.g. Contestants, Judges and Guests"
                        className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-[#64748B]">
                      Stoppage Sequence
                    </label>
                    <div className="space-y-2">
                      {trip.stops.map((stop, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={stop}
                            onChange={(event) =>
                              updateStop(trip.key, index, event.target.value)
                            }
                            placeholder={`Stop ${index + 1}`}
                            className="h-9 w-full rounded-md border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#64748B] focus:border-[#334E68] focus:ring-1 focus:ring-[#334E68]"
                          />
                          {trip.stops.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStop(trip.key, index)}
                              className="h-9 rounded-md border border-[#E2E8F0] px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#F8FAFC]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addStop(trip.key)}
                      className="mt-2 text-xs font-medium text-[#334E68] hover:underline"
                    >
                      + Add Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {errors.trips && (
              <p className="mt-2 text-xs text-[#B91C1C]">{errors.trips}</p>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-md border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334E68] hover:bg-[#F8FAFC]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-10 rounded-md bg-[#0F2747] px-4 text-sm font-medium text-white hover:bg-[#334E68]"
        >
          Add Requisition
        </button>
      </div>
    </form>
  );
}
