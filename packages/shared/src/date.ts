/**
 * Business date utilities for restaurant and retail service shifts.
 *
 * Prevents mid-service ticket and order number resets for late-night venues
 * operating past midnight (e.g. up to 4-5 AM).
 */

/**
 * Returns the business date string (`YYYY-MM-DD`) for an outlet shift.
 *
 * @param date Current timestamp (defaults to `new Date()`)
 * @param timezone IANA timezone (defaults to `'Asia/Kolkata'`)
 * @param dayStartHour Hour of the day when a new business day begins (defaults to `5` for 05:00 AM)
 */
export function getBusinessDate(
  date = new Date(),
  timezone = 'Asia/Kolkata',
  dayStartHour = 5,
): string {
  // Shift date backwards by dayStartHour in milliseconds.
  // For instance, at 02:00 AM, subtracting 5 hours rolls the clock to 21:00 of the previous evening.
  const shifted = new Date(date.getTime() - dayStartHour * 60 * 60 * 1000);
  
  // Format as YYYY-MM-DD in the target outlet timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(shifted);
}
