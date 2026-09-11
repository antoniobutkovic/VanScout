"use client";

import { useEffect, useState } from "react";
import App from "../../App";
import { I18nProvider } from "../../i18n";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <I18nProvider><App /></I18nProvider>;
}
