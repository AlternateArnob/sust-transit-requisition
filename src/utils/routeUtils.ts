import type {
  RecurringRoute,
  VehicleOffDay,
  Weekday,
  RouteSlot,
} from "../types";

const WEEKDAY_INDEX: Weekday[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export function getWeekdayFromDate(dateString: string): Weekday {
  const date = new Date(`${dateString}T00:00:00`);
  return WEEKDAY_INDEX[date.getDay()];
}

export function getOffDayForVehicleOnDate(
  vehicleId: string,
  dateString: string,
  offDays: VehicleOffDay[],
): VehicleOffDay | undefined {
  const weekday = getWeekdayFromDate(dateString);

  return offDays.find((offDay) => {
    if (offDay.vehicleId !== vehicleId) {
      return false;
    }

    if (offDay.type === "One-time") {
      return offDay.date === dateString;
    }

    return offDay.weekday === weekday;
  });
}

export function isVehicleOnOffDay(
  vehicleId: string,
  dateString: string,
  offDays: VehicleOffDay[],
): boolean {
  return Boolean(getOffDayForVehicleOnDate(vehicleId, dateString, offDays));
}

export function isRouteVehicle(
  vehicleId: string,
  routes: RecurringRoute[],
): boolean {
  return routes.some(
    (route) => route.vehicleId === vehicleId && route.isActive,
  );
}

export function hasDuplicateRouteSlot(
  routes: RecurringRoute[],
  vehicleId: string,
  slot: RouteSlot,
  weekdays: Weekday[],
  excludeId?: string,
): boolean {
  return routes.some(
    (route) =>
      route.id !== excludeId &&
      route.vehicleId === vehicleId &&
      route.slot === slot &&
      route.isActive &&
      route.weekdays.some((day) => weekdays.includes(day)),
  );
}

export function getRouteTime(route: RecurringRoute): string | undefined {
  return route.campusDeparture ?? route.pointDeparture;
}

export function parseTimeToMinutes(time?: string): number {
  if (!time) {
    return Number.MAX_SAFE_INTEGER;
  }

  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) {
    hours += 12;
  }

  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

export function getRoutesForVehicleOnDate(
  vehicleId: string,
  dateString: string,
  routes: RecurringRoute[],
): RecurringRoute[] {
  const weekday = getWeekdayFromDate(dateString);

  return routes
    .filter(
      (route) =>
        route.vehicleId === vehicleId &&
        route.isActive &&
        route.weekdays.includes(weekday),
    )
    .sort(
      (a, b) =>
        parseTimeToMinutes(getRouteTime(a)) -
        parseTimeToMinutes(getRouteTime(b)),
    );
}
