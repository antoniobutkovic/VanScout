export const SUPPORTED_LANGUAGES = ["en", "hr"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "hr";
}

function languageFromLocale(locale: string): Language | undefined {
  const normalized = locale.trim().replace(/_/g, "-");
  if (!normalized || normalized === "*") return undefined;

  const [language, ...subtags] = normalized.split("-");
  if (language.toLowerCase() === "hr") return "hr";
  if (language.toLowerCase() === "en") return "en";

  // A browser can expose a regional locale such as de-HR even when Croatian
  // is not its interface language. Croatia is the only regional default this
  // two-language app currently supports.
  return subtags.some((subtag) => subtag.toUpperCase() === "HR") ? "hr" : undefined;
}

export function languageFromCountry(country: string | null | undefined): Language | undefined {
  return country?.trim().toUpperCase() === "HR" ? "hr" : undefined;
}

export function languageFromAcceptLanguage(header: string | null | undefined): Language | undefined {
  if (!header) return undefined;

  const candidates = header.split(",").map((entry, index) => {
    const [locale, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const parsedQuality = quality ? Number.parseFloat(quality.trim().slice(2)) : 1;
    return { locale, quality: Number.isFinite(parsedQuality) ? parsedQuality : 0, index };
  }).filter(({ quality }) => quality > 0).sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { locale } of candidates) {
    const language = languageFromLocale(locale);
    if (language) return language;
  }

  return undefined;
}

export function languageFromBrowser(locales: readonly string[] | undefined, fallbackLocale?: string): Language {
  for (const locale of [...(locales ?? []), fallbackLocale ?? ""]) {
    const language = languageFromLocale(locale);
    if (language) return language;
  }
  return "en";
}
