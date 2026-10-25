// Which devices the game runs on (doc/phone-notice.md).

/**
 * Whether a user agent belongs to a phone. Every phone browser puts "Mobi" in it; Chrome on iPad does too, but a
 * tablet is not a phone.
 */
export function isPhone(userAgent: string): boolean {
  return /Mobi/i.test(userAgent) && !/iPad/i.test(userAgent);
}
