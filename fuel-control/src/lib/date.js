// Returns YYYY-MM-DD in the browser's local timezone.
// IMPORTANT: don't use `new Date().toISOString().slice(0, 10)` for "today's
// date" anywhere in this app — toISOString() always converts to UTC first,
// which is wrong for Pakistan (UTC+5): any action taken between 12:00 AM
// and ~4:59 AM PKT gets stamped with YESTERDAY's date instead of today's.
// That silently misattributes shifts/expenses/prices/payments to the wrong
// day for any station open late or running a night shift.
export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysAgoString(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateString(d);
}
