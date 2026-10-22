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

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const forwardPush = (event: MessageEvent<{ type?: string; notification?: unknown }>) => {
      if (event.data?.type === "vanscout-push") window.dispatchEvent(new CustomEvent("vanscout-push", { detail: event.data.notification }));
    };
    navigator.serviceWorker.addEventListener("message", forwardPush);
    return () => navigator.serviceWorker.removeEventListener("message", forwardPush);
  }, []);

  if (!mounted) return null;
  installSessionExpiryHandler();
  return <I18nProvider initialLanguage={initialLanguage}><App /></I18nProvider>;
}
