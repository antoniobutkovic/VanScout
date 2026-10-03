import { cookies, headers } from "next/headers";
import ClientPage from "./ClientPage";
import { isLanguage, languageFromAcceptLanguage, languageFromCountry } from "../../lib/language";

function countryFromHeaders(requestHeaders: Headers) {
  return requestHeaders.get("x-vercel-ip-country")
    ?? requestHeaders.get("cf-ipcountry")
    ?? requestHeaders.get("x-country-code");
}

export default async function Page() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const savedLanguage = cookieStore.get("vanscout-language")?.value;
  const initialLanguage = isLanguage(savedLanguage)
    ? savedLanguage
    : languageFromCountry(countryFromHeaders(requestHeaders))
      ?? languageFromAcceptLanguage(requestHeaders.get("accept-language"))
      ?? "en";

  return <ClientPage initialLanguage={initialLanguage} />;
}
