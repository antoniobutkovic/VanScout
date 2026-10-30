import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

/**
 * Turns a number entered in a selected country's national format into E.164.
 *
 * `isValid()` also verifies that a specific number block has been allocated in
 * libphonenumber's metadata. That metadata can lag new allocations, so using
 * it here can reject a real mobile number before Firebase has a chance to send
 * the SMS. We only require a possible number for the selected country; Firebase
 * remains the deliverability authority.
 */
export function normalizePhoneNumber(country: CountryCode, input: string, allowTestNumber: boolean) {
  const parsed = parsePhoneNumberFromString(input, country);
  if (parsed?.isPossible() && parsed.country === country) return parsed.number;

  if (!allowTestNumber) return null;

  // Firebase test mode accepts fictional numbers configured in the Firebase
  // console, which may not exist in libphonenumber metadata.
  const digits = input.replace(/\D/g, "");
  const dialCode = getCountryCallingCode(country);
  const international = digits.startsWith(dialCode) ? digits : `${dialCode}${digits}`;
  const e164 = `+${international}`;
  return E164_PHONE_NUMBER.test(e164) ? e164 : null;
}

export function isE164PhoneNumber(value: string) {
  return E164_PHONE_NUMBER.test(value);
}
