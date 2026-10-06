"use client";

import { useEffect, useState } from "react";
import App from "../../App";
import { I18nProvider, type Language } from "../../i18n";
import { installSessionExpiryHandler } from "../../lib/client-auth";

export default function ClientPage({ initialLanguage }: { initialLanguage: Language }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  installSessionExpiryHandler();
  return <I18nProvider initialLanguage={initialLanguage}><App /></I18nProvider>;
}
