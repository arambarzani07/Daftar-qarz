import { CurrencyType } from '../types';

/**
 * Format currency amount cleanly.
 * Example:
 * formatMoney(46000, 'IQD') => "46,000 دینار"
 * formatMoney(1250, 'USD') => "$1,250"
 */
export function formatMoney(amount: number, currency: CurrencyType = 'IQD'): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat('en-US').format(rounded);

  if (currency === 'USD') {
    return `$${formatted}`;
  }
  return `${formatted} دینار`;
}

export function formatTimeOnly(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour '0' should be '12'

    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return isoString;
  }
}

/**
 * Format timestamp into Kurdish/English readable time and date.
 * Example: "22:17:24 2026-01-20"
 */
export function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds} ${year}-${month}-${day}`;
  } catch {
    return isoString;
  }
}

/**
 * Format short time ago or date
 */
export function formatShortDate(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
  } catch {
    return isoString;
  }
}
