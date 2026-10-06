/**
 * Contact details are kept in VanScout until both parties agree to a transport.
 * This deliberately recognises the common formats rather than trying to parse a
 * phone number for one country: the marketplace accepts users from many countries.
 */
export const CONTACT_DETAILS_RESTRICTED_MESSAGE = "Phone numbers, email addresses and web links can only be shared after the transport is agreed.";

function normaliseForContactDetection(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, character => String(character.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, character => String(character.charCodeAt(0) - 0x06f0))
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function digitsIn(value: string) {
  return value.replace(/\D/g, "");
}

function looksLikeDate(value: string) {
  return /^(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/.test(value.trim());
}

function hasPhoneNumber(value: string) {
  const text = normaliseForContactDetection(value);
  if (/(?:^|[^\d])\d{7,15}(?!\d)/.test(text)) return true;

  // Treat separators as cosmetic. People can otherwise evade a conventional
  // grouping matcher by splitting a number at arbitrary digit positions.
  const candidates = text.match(/(?:\+|00)?\s*\d(?:[\s()./-]*\d){6,14}/g) || [];
  return candidates.some(candidate => {
    const digitCount = digitsIn(candidate).length;
    return digitCount >= 7 && digitCount <= 15 && !looksLikeDate(candidate);
  });
}

export function hasRestrictedContactDetails(value: string) {
  const text = normaliseForContactDetection(value);
  return hasPhoneNumber(text)
    || /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/i.test(text)
    || /(?:https?:\/\/|www\.|(?:wa\.me|t\.me)\/)[^\s]+/i.test(text);
}

export class RestrictedContactDetailsError extends Error {
  constructor() {
    super(CONTACT_DETAILS_RESTRICTED_MESSAGE);
    this.name = "RestrictedContactDetailsError";
  }
}
