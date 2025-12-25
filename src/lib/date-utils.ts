/**
 * Utility functions for formatting dates in Polish standard format (DD.MM.YYYY)
 */

/**
 * Format date to Polish standard: DD.MM.YYYY
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d
    .toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");
}

/**
 * Format time to Polish standard: HH:MM
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format time with seconds: HH:MM:SS
 */
export function formatTimeWithSeconds(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format date and time: DD.MM.YYYY HH:MM
 */
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Format date and time with seconds: DD.MM.YYYY HH:MM:SS
 */
export function formatDateTimeWithSeconds(date: Date | string): string {
  return `${formatDate(date)} ${formatTimeWithSeconds(date)}`;
}

/**
 * Format date in long format: 7 grudnia 2026
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
