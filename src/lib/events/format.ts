const TIMEZONE = "America/New_York";

const eventDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const eventDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const eventTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function formatEventDateTime(date: string | Date): string {
  return eventDateTimeFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatEventDate(date: string | Date): string {
  return eventDateFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function formatEventTime(date: string | Date): string {
  return eventTimeFormatter.format(
    typeof date === "string" ? new Date(date) : date,
  );
}

export function isUpcoming(starts_at: string): boolean {
  return new Date(starts_at).getTime() >= Date.now();
}

/**
 * Convert a UTC timestamp to the string a `<input type="datetime-local">`
 * accepts ("YYYY-MM-DDTHH:MM"), in Eastern time. Used to pre-populate the
 * edit form for an existing event.
 */
export function easternDateInputValue(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convert a `<input type="datetime-local">` value (a string like
 * "2026-07-04T16:00", which has no inherent timezone) into a UTC ISO string,
 * interpreting the input as Eastern time. Handles DST by round-trip checking
 * both -4 (EDT) and -5 (EST) offsets.
 */
export function easternDateFromInput(inputString: string): string {
  const [datePart, timePart] = inputString.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);

  // Try EDT (UTC-4) first
  const guessEdt = new Date(Date.UTC(y, mo - 1, d, h + 4, mi));
  if (easternDateInputValue(guessEdt) === inputString) {
    return guessEdt.toISOString();
  }
  // Otherwise EST (UTC-5)
  const guessEst = new Date(Date.UTC(y, mo - 1, d, h + 5, mi));
  return guessEst.toISOString();
}
