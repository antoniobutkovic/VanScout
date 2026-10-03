"use client";

import { useEffect, useState } from "react";
import App from "../../App";
import { I18nProvider, type Language } from "../../i18n";

export default function ClientPage({ initialLanguage }: { initialLanguage: Language }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <I18nProvider initialLanguage={initialLanguage}><App /></I18nProvider>;
}
