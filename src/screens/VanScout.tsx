import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";
import Image from "next/image";
import { Realtime, type TokenRequest } from "ably";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, type Auth, type ConfirmationResult } from "firebase/auth";
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { IMAGES } from "../assets/images";
import { LanguagePicker, useLanguage } from "../i18n";
import { Picker } from "../components/Picker";
import { AddressPicker } from "../components/AddressPicker";
import { LegalDocumentContent } from "../components/LegalDocumentContent";
import { getFirebasePhoneAuth, type FirebasePhoneConfig } from "../lib/firebase-phone";
import { clearAuthSession, dashboardPath, fetchSessionUser, getAuthToken } from "../lib/client-auth";
import { clearPendingRequestImages, loadPendingRequestImages, MAX_REQUEST_IMAGE_BYTES, MAX_REQUEST_IMAGES, pendingImagesFromFiles, savePendingRequestImages, syncPendingRequestImages, type PendingRequestImage } from "../lib/request-image-drafts";
import { offerPriceFromEnteredAmount, offerPriceFromTotal } from "../lib/offer-pricing";
import type { AddressLocation } from "../lib/location";
import type { TransportRequest, TransportStatus } from "../lib/transport-types";
import type { CarrierProfile as CarrierProfileData, ChatMessage, Conversation, CreditAccount, MarketplaceTransport, TransportOffer } from "../lib/marketplace-types";

type Offer = { name: string; price: string; rating: string; jobs: string; vehicle: string; time: string; note: string; initials: string; tone: string };
type AuthRole = "requester" | "transporter";
const EMAIL_RESEND_COOLDOWN_SECONDS = 60;
const OFFERS: Offer[] = [
  { name: "Mario M.", price: "€32", rating: "4.9", jobs: "127 jobs", vehicle: "Renault Master", time: "Today, 17:00–19:00", note: "I’m already collecting another order near IKEA this afternoon.", initials: "MM", tone: "mario" },
  { name: "Luka P.", price: "€28", rating: "4.8", jobs: "81 jobs", vehicle: "Ford Transit", time: "Tomorrow, 10:00–12:00", note: "I can collect this on my morning route through Trešnjevka.", initials: "LP", tone: "luka" },
  { name: "Nikola R.", price: "€37", rating: "5.0", jobs: "42 jobs", vehicle: "Mercedes Sprinter", time: "Friday, 14:00–16:00", note: "Two-person pickup available if you need a hand with the load.", initials: "NR", tone: "nikola" },
];
const CATEGORIES = ["Furniture", "Appliances", "Store purchase", "Motorcycle", "Boxes / pallets", "Other"];
const WIZARD_STEPS = ["Item", "Photos", "Pickup", "Delivery", "Timing", "Review"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Arrow() { return null; }
function Mark() { return <Link className="brand" to="/" aria-label="VanScout home"><Image src="/vanscout-logo.png" alt="VanScout" width={2172} height={724} /></Link>; }
function RouteLine({ small = false }: { small?: boolean }) { return <span className={`route-line ${small ? "small" : ""}`}><i /><b /><i /></span>; }
function TransportRoute({ from, to, short = true, className = "" }: { from: string; to: string; short?: boolean; className?: string }) {
  const { t } = useLanguage();
  const displayedFrom = short ? formatShortAddress(from) : from;
  const displayedTo = short ? formatShortAddress(to) : to;
  return <div className={`transport-route ${className}`.trim()} role="group" aria-label={t("Route")} title={`${from} → ${to}`}><div><span>{t("From")}:</span><b>{displayedFrom}</b></div><div><span>{t("To")}:</span><b>{displayedTo}</b></div></div>;
}
function Avatar({ offer, large = false }: { offer?: Offer; large?: boolean }) { const identity = offer ?? OFFERS[0]; return <span className={`avatar ${identity.tone} ${large ? "large" : ""}`}>{large && identity.name === "Mario M." ? <img src={IMAGES.CARRIER_DOT_PROFILE} alt={identity.name} /> : identity.initials}</span>; }
function PasswordControl(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return <span className="password-control"><input {...props} type={visible ? "text" : "password"} /><button type="button" className="password-toggle" aria-label={t(visible ? "Hide password" : "Show password")} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{t(visible ? "Hide" : "Show")}</button></span>;
}
function RoleIcon({ role }: { role: AuthRole }) { return role === "transporter" ? <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 9.5h15v12H4zM19 14h5l4 4v3.5h-9zM8 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM24 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M19 17.5h8M7 9.5V7h8" /></svg> : <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 10 12-5 12 5-12 5L4 10Z" /><path d="M7 12.5V21l9 4 9-4v-8.5M12 13.5v8M20 13.5v8" /></svg>; }
function RolePicker({ value, onChange }: { value: AuthRole; onChange: (value: AuthRole) => void }) { const { t } = useLanguage(); const options: { value: AuthRole; label: string }[] = [{ value: "requester", label: t("Requester") }, { value: "transporter", label: t("Transporter") }]; return <fieldset className="auth-role-picker"><div className="role-picker-options" role="radiogroup" aria-label={t("How will you use VanScout?")}>{options.map(option => <button type="button" role="radio" aria-checked={value === option.value} className={`role-option ${value === option.value ? "selected" : ""}`} key={option.value} onClick={() => onChange(option.value)}><span className="role-option-icon"><RoleIcon role={option.value} /></span><span>{option.label}</span></button>)}</div></fieldset>; }
function useEmailResendCooldown(initiallyActive = false) {
  const [remaining, setRemaining] = useState(initiallyActive ? EMAIL_RESEND_COOLDOWN_SECONDS : 0);
  useEffect(() => {
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setRemaining(current => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [remaining]);
  return { remaining, start: () => setRemaining(EMAIL_RESEND_COOLDOWN_SECONDS) };
}
type AuthenticatedUser = { role: AuthRole; phoneVerified?: boolean };
type GoogleRegistration = { token: string; profile: { email: string; firstName: string; lastName: string } };
type AuthConfig = {
  firebase?: ({ enabled: false; testMode: boolean } | ({ enabled: true } & FirebasePhoneConfig));
};

function firebasePhoneError(error: unknown, translate: (key: string) => string, action: "send" | "verify") {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Enter a valid mobile number for the selected country",
    "auth/missing-phone-number": "Enter a valid mobile number for the selected country",
    "auth/invalid-verification-code": "The verification code is incorrect",
    "auth/invalid-credential": "The verification code is invalid or expired. Request a new code and try again.",
    "auth/code-expired": "The verification code has expired. Send a new code.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes before trying again.",
  };
  if (messages[code]) return translate(messages[code]);
  // Firebase setup, quota, security-check, and unknown errors are intentionally
  // kept out of the UI. Detailed diagnostics belong in server/client logs.
  return translate(action === "send"
    ? "We couldn't send a verification code right now. Please try again in a moment."
    : "We couldn't verify your phone number right now. Please try again in a moment.");
}

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

function GoogleSignInButton({ role, onAuthenticated, onRegistrationRequired }: { role?: AuthRole; onAuthenticated: (user: AuthenticatedUser) => void; onRegistrationRequired: (registration: GoogleRegistration) => void }) {
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onRegistrationRequiredRef = useRef(onRegistrationRequired);
  const credentialHandlerRef = useRef<(response: google.accounts.id.CredentialResponse) => void>(() => undefined);

  useEffect(() => { onAuthenticatedRef.current = onAuthenticated; }, [onAuthenticated]);
  useEffect(() => { onRegistrationRequiredRef.current = onRegistrationRequired; }, [onRegistrationRequired]);
  credentialHandlerRef.current = response => {
    setError("");
    setIsSigningIn(true);
    void (async () => {
      try {
        const authResponse = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: response.credential, ...(role ? { role } : {}) }),
        });
        const payload = await authResponse.json() as { token?: string; user?: AuthenticatedUser; requiresRegistration?: boolean; registrationToken?: string; profile?: GoogleRegistration["profile"]; error?: string };
        if (!authResponse.ok) throw new Error(payload.error || t("Google sign-in failed"));
        if (payload.requiresRegistration && payload.registrationToken && payload.profile) {
          onRegistrationRequiredRef.current({ token: payload.registrationToken, profile: payload.profile });
          return;
        }
        if (!payload.user) throw new Error(payload.error || t("Google sign-in failed"));
        onAuthenticatedRef.current(payload.user);
      } catch (authError) {
        setIsSigningIn(false);
        setError(authError instanceof Error ? authError.message : t("Google sign-in failed"));
      }
    })();
  };

  useEffect(() => {
    let cancelled = false;
    const loadGoogleButton = async () => {
      try {
        const configResponse = await fetch("/api/auth/config", { cache: "no-store" });
        const config = await configResponse.json() as { google?: { enabled?: boolean; clientId?: string | null } };
        if (!config.google?.enabled || !config.google.clientId) {
          return;
        }
        if (!window.google) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]');
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Google Identity Services failed to load")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.dataset.googleIdentity = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Google Identity Services failed to load"));
            document.head.appendChild(script);
          });
        }
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: config.google.clientId,
          callback: response => credentialHandlerRef.current(response),
          ux_mode: "popup",
          use_fedcm_for_button: false,
        });
        setGoogleReady(true);
      } catch {
        setError(t("Google sign-in failed"));
      }
    };
    void loadGoogleButton();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!googleReady || !window.google || !buttonContainerRef.current) return;
    const container = buttonContainerRef.current;
    container.replaceChildren();
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: Math.min(400, container.clientWidth || 400),
      locale: language,
    });
  }, [googleReady, language]);

  return <div className={`google-sign-in ${isSigningIn ? "is-loading" : ""}`} aria-busy={isSigningIn}><div ref={buttonContainerRef} />{error && <p className="google-auth-error">{error}</p>}</div>;
}

function OtpInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useLanguage();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || "");
  const update = (index: number, nextValue: string) => {
    const digit = nextValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange(next.join(""));
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  };
  return <div className="otp" onPaste={event => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }}>{digits.map((digit, index) => <input ref={element => { inputs.current[index] = element; }} key={index} aria-label={`${t("Digit")} ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} pattern="[0-9]*" maxLength={1} value={digit} disabled={disabled} onChange={event => update(index, event.target.value)} onKeyDown={event => handleKeyDown(event, index)} />)}</div>;
}

const COUNTRIES = getCountries();
function PhoneNumberField({ country, localNumber, onCountryChange, onNumberChange, error }: { country: CountryCode; localNumber: string; onCountryChange: (country: CountryCode) => void; onNumberChange: (number: string) => void; error?: string }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const names = useMemo(() => new Intl.DisplayNames([language], { type: "region" }), [language]);
  const options = useMemo(() => COUNTRIES.map(code => ({ code, name: names.of(code) || code, dial: getCountryCallingCode(code) })).sort((a, b) => a.name.localeCompare(b.name, language)), [language, names]);
  const filtered = options.filter(option => `${option.name} ${option.code} +${option.dial}`.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)));
  const selected = options.find(option => option.code === country)!;
  return <div className="phone-field"><span className="picker-label">{t("Phone number")}</span><div className="phone-input-row"><div className="country-combobox"><button type="button" className="country-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{country}</span><b>+{selected.dial}</b><i>⌄</i></button>{open && <div className="country-menu"><input value={query} autoFocus onChange={event => setQuery(event.target.value)} placeholder={t("Search country")} aria-label={t("Search country")} /><div role="listbox" aria-label={t("Country")}>{filtered.map(option => <button type="button" role="option" aria-selected={option.code === country} key={option.code} onClick={() => { onCountryChange(option.code); setOpen(false); setQuery(""); }}><span>{option.name}</span><b>+{option.dial}</b></button>)}{filtered.length === 0 && <p>{t("No countries found")}</p>}</div></div>}</div><input className="phone-number-input" type="tel" inputMode="tel" autoComplete="tel-national" value={localNumber} aria-invalid={Boolean(error)} onChange={event => {
    const raw = event.target.value.replace(/[^\d\s()-]/g, "");
    const digitsOnly = raw.replace(/\D/g, "");
    onNumberChange(new AsYouType(country).input(digitsOnly));
  }} placeholder={t("91 234 5678")} /></div>{error && <span className="field-error" role="alert">{error}</span>}</div>;
}

function normalizedPhoneNumber(country: CountryCode, input: string) {
  const parsed = parsePhoneNumberFromString(input, country);
  const type = parsed?.getType();
  if (parsed?.isValid() && parsed.country === country && (!type || type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE")) {
    return parsed.number;
  }

  // Keep the E.164 structure check here, but let Firebase be authoritative
  // about whether the number is a whitelisted fictional number or a real
  // mobile range. This prevents libphonenumber metadata from rejecting a
  // Firebase test number such as +38500000000.
  const digits = input.replace(/\D/g, "");
  const dialCode = getCountryCallingCode(country);
  const international = digits.startsWith(dialCode) ? digits : `${dialCode}${digits}`;
  const e164 = `+${international}`;
  return e164.startsWith(`+${dialCode}`) && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

function HeaderActions({ kind }: { kind?: "customer" | "carrier" }) {
  const { t } = useLanguage();
  const nav = useNavigate();
  const logout = async () => {
    await clearAuthSession();
    nav("/", { replace: true });
  };
  return <div className="nav-actions">{kind ? <>{kind === "customer" && <Link className="button dark short" to="/create-request" state={{ returnTo: "/customer" }}>{t("New request")}</Link>}<LanguagePicker /><button type="button" className="logout-button" onClick={() => void logout()}>{t("Log out")}</button></> : <><LanguagePicker /><Link className="sign-in" to="/auth">{t("Sign in")}</Link></>}</div>;
}

function useHasMessages(kind?: "customer" | "carrier") {
  const [hasMessages, setHasMessages] = useState(false);
  useEffect(() => {
    if (!kind) {
      setHasMessages(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) setHasMessages(false);
        return;
      }
      try {
        const response = await fetch("/api/conversations", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json() as { conversations?: Conversation[] };
        if (!cancelled && response.ok) setHasMessages((payload.conversations || []).some(conversation => conversation.hasUnreadMessages));
      } catch {
        // Preserve the current indicator during a temporary connection failure.
      }
    };
    void load();
    const handleMessagesRead = () => void load();
    window.addEventListener("vanscout-messages-read", handleMessagesRead);
    const timer = window.setInterval(() => void load(), 3000);
    return () => { cancelled = true; window.removeEventListener("vanscout-messages-read", handleMessagesRead); window.clearInterval(timer); };
  }, [kind]);
  return hasMessages;
}

function useHasUnreadOffers(enabled: boolean) {
  const [hasUnreadOffers, setHasUnreadOffers] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setHasUnreadOffers(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) setHasUnreadOffers(false);
        return;
      }
      try {
        const response = await fetch("/api/transports?status=all", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json() as { transports?: TransportRequest[] };
        if (!cancelled && response.ok) setHasUnreadOffers((payload.transports || []).some(transport => transport.hasUnreadOffers));
      } catch {
        // Keep the last known dot state during temporary connection failures.
      }
    };
    void load();
    const handleOffersRead = () => void load();
    window.addEventListener("vanscout-offers-read", handleOffersRead);
    const timer = window.setInterval(() => void load(), 3000);
    return () => { cancelled = true; window.removeEventListener("vanscout-offers-read", handleOffersRead); window.clearInterval(timer); };
  }, [enabled]);
  return hasUnreadOffers;
}

function Topbar({ kind, active }: { kind?: "customer" | "carrier"; active?: string }) {
  const { t } = useLanguage();
  const hasMessages = useHasMessages(kind);
  const hasUnreadOffers = useHasUnreadOffers(kind === "customer");
  const carrierLinks = [["jobs", "Find jobs", "/carrier"], ["offers", "My offers", "/carrier/offers"], ["active", "Active", "/carrier/active"], ["messages", "Messages", "/carrier/messages"], ["credits", "Credits", "/carrier/credits"], ["profile", "Profile", "/carrier/profile"]];
  return <header className={`topbar ${kind ? "app-topbar" : ""}`}><Mark />{kind === "carrier" ? <nav>{carrierLinks.map(([key, label, href]) => <Link className={active === key ? "active" : ""} key={key} to={href}>{t(label)}{key === "messages" && hasMessages && <span className="notification-indicator" aria-hidden="true" />}</Link>)}</nav> : kind === "customer" ? <nav><Link className={active === "requests" ? "active" : ""} to="/customer">{t("Requests")}{hasUnreadOffers && <span className="notification-indicator" aria-hidden="true" />}</Link><Link className={active === "messages" ? "active" : ""} to="/customer/messages">{t("Messages")}{hasMessages && <span className="notification-indicator" aria-hidden="true" />}</Link></nav> : null}<HeaderActions kind={kind} /></header>;
}
function Footer() { const { t } = useLanguage(); return <footer className="footer"><div className="footer-brand"><Mark /><strong>Contact</strong><a href="mailto:info@van-scout.com">info@van-scout.com</a></div><div className="footer-legal"><strong>{t("Legal information")}</strong><Link to="/politika-privatnosti">{t("Privacy policy")}</Link><Link to="/politika-o-kolacicima">{t("Cookie policy")}</Link><Link to="/uvjeti-koristenja">{t("Terms of use")}</Link><Link to="/impressum">{t("Impressum")}</Link></div><small className="footer-copyright">{t("© 2026 VanScout. All rights reserved.")}</small></footer>; }
function ItemImage({ type = "bed", label }: { type?: "bed" | "photo"; label?: string }) { const { t } = useLanguage(); return <div className={`item-image ${type}`}><span>{label || (type === "bed" ? <>{t("Bed")}<br />{t("slats")}</> : t("Photo"))}</span></div>; }
function PrivateImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [objectUrl, setObjectUrl] = useState("");
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const controller = new AbortController();
    let createdUrl = "";
    void fetch(src, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }).then(response => response.ok ? response.blob() : Promise.reject()).then(blob => {
      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    }).catch(() => undefined);
    return () => { controller.abort(); if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [src]);
  return objectUrl ? <img className={className} src={objectUrl} alt={alt} /> : <span className={className} aria-label={alt} />;
}
function FilePreview({ file, className, alt = "" }: { file: File; className?: string; alt?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { const url = URL.createObjectURL(file); setSrc(url); return () => URL.revokeObjectURL(url); }, [file]);
  return src ? <img className={className} src={src} alt={alt} /> : null;
}
function TransportImage({ request }: { request: Pick<TransportRequest, "id" | "itemName" | "imageIds"> }) { return request.imageIds[0] ? <PrivateImage className="transport-item-image" src={`/api/transports/${request.id}/images/${request.imageIds[0]}`} alt={request.itemName} /> : <ItemImage label={request.itemName} />; }

function JobDetailImageGallery({ transportId, itemName, imageIds }: { transportId: string; itemName: string; imageIds: string[] }) {
  const { t } = useLanguage();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedImageId) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImageId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImageId]);
  const imageUrl = (imageId: string) => `/api/transports/${transportId}/images/${imageId}`;
  return <>
    <div className="job-detail-images" role="group" aria-label={itemName}>
      {imageIds.map((imageId, index) => <button type="button" key={imageId} aria-label={`${t("View image")} ${index + 1}`} onClick={() => setSelectedImageId(imageId)}><PrivateImage className="job-detail-photo" src={imageUrl(imageId)} alt={itemName} /></button>)}
    </div>
    {selectedImageId && <div className="image-lightbox" onClick={() => setSelectedImageId(null)}><div className="image-lightbox-content" role="dialog" aria-modal="true" aria-label={itemName} onClick={event => event.stopPropagation()}><button type="button" className="image-lightbox-close" aria-label={t("Close image")} onClick={() => setSelectedImageId(null)}>×</button><PrivateImage className="image-lightbox-image" src={imageUrl(selectedImageId)} alt={itemName} /></div></div>}
  </>;
}

function TransportDetailHeader({ request }: { request: TransportRequest }) {
  const { t } = useLanguage();
  const statusTone = transportStatusClass(request.status, request.preferredDateFrom, request.preferredDateTo);
  return <header><div><p className="eyebrow">{t(request.category)}</p><h1>{request.itemName}</h1></div><span className={`status large ${statusTone}`}>{t(transportStatusLabel(request.status, request.preferredDateFrom, request.preferredDateTo))}</span></header>;
}

function TransportDetails({ request, customerName }: { request: TransportRequest; customerName?: string }) {
  const { language, t } = useLanguage();
  return <section className="transport-detail-content"><h2>{t("Transport details")}</h2>{request.description && <p>{request.description}</p>}<dl className="real-job-facts">{customerName && <div><dt>{t("Customer")}</dt><dd>{customerName}</dd></div>}<div><dt>{t("Dimensions")}</dt><dd>{formatTransportMeasurements(request, language)}</dd></div><TransportRoute from={request.pickup.formatted} to={request.delivery.formatted} short /><div><dt>{t("Date")}</dt><dd>{request.preferredDateFrom ? formatTransportDates(request.preferredDateFrom, request.preferredDateTo, language) : t(request.timing)}</dd></div><div><dt>{t("Distance")}</dt><dd>{request.distanceKm} km</dd></div></dl>{request.imageIds.length > 0 && <JobDetailImageGallery transportId={request.id} itemName={request.itemName} imageIds={request.imageIds} />}</section>;
}

type LegalDocument = "privacy" | "cookies" | "terms" | "impressum";
const LEGAL_DOCUMENTS: Record<LegalDocument, { title: string; introduction: string }> = {
  privacy: { title: "Privacy policy", introduction: "Privacy policy introduction" },
  cookies: { title: "Cookie policy", introduction: "Cookie policy introduction" },
  terms: { title: "Terms of use", introduction: "Terms of use introduction" },
  impressum: { title: "Impressum", introduction: "Impressum introduction" },
};

export function LegalPage({ document }: { document: LegalDocument }) {
  const { language, t } = useLanguage();
  const page = LEGAL_DOCUMENTS[document];
  return <div className="site"><Topbar /><main className="legal-page"><section className="legal-intro"><p className="eyebrow">{t("Legal information")}</p><h1>{t(page.title)}</h1><p>{t(page.introduction)}</p></section><LegalDocumentContent document={document} language={language} /></main><Footer /></div>;
}

export function Home() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetchSessionUser(controller.signal)
      .then(user => {
        if (user) nav(dashboardPath(user.role), { replace: true });
        else setCheckingSession(false);
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCheckingSession(false);
      });
    return () => controller.abort();
  }, [nav]);
  if (checkingSession) return <div className="session-loading" aria-busy="true" />;
  const workflows = [{ audience: "For requesters", steps: [["01", "Describe the item and route", "Add the details carriers need to make a clear offer."], ["02", "Compare offers", "Review price, vehicle and availability in one place."], ["03", "Book with confidence", "Choose the carrier that fits and follow the transport to delivery."]] }, { audience: "For carriers", steps: [["01", "Find a job that fits", "Browse routes, items and timing before you make an offer."], ["02", "Make a clear offer.", "Set your price and availability in minutes."], ["03", "Complete the transport", "Keep the customer updated, then build your review history."]] }];
  return <div className="site"><Topbar /><main><section className="home-hero"><div className="home-copy"><h1>{t("Request or offer transport services without the hassle.")}</h1><div className="actions"><Link className="button moss" to="/create-request">{t("Request transport")} <Arrow /></Link><Link className="quiet-link" to="/auth?role=transporter">{t("I'm a carrier")}</Link></div></div><div className="hero-image"><img src={IMAGES.HOME_DOT_HERO} alt={t("Furniture and boxes being loaded into a cargo van.")} /><div className="hero-sticker"><span>{t("Today")}</span><RouteLine small /><TransportRoute from="IKEA Zagreb" to="Trešnjevka" /></div></div></section><section className="steps"><div className="workflow-rows">{workflows.map(({ audience, steps }) => <section className="workflow-row" key={audience}><h2>{t(audience)}</h2><div>{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{t(title)}</h3><p>{t(copy)}</p></article>)}</div></section>)}</div></section><section className="trust"><div><h2>{t("Choose with confidence.")}</h2></div><ul><li>{t("Verified phone numbers")}</li><li>{t("Carrier profiles and vehicles")}</li><li>{t("Real reviews after every job")}</li></ul></section></main><Footer /></div>;
}

export function CreateRequest() {
  const { language, t } = useLanguage();
  const nav = useNavigate();
  const loc = useLocation();
  const returnTo = (loc.state as { returnTo?: string } | null)?.returnTo === "/customer" ? "/customer" : "/";
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("Furniture");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [timing, setTiming] = useState("Choose a date");
  const [preferredDateFrom, setPreferredDateFrom] = useState("");
  const [preferredDateTo, setPreferredDateTo] = useState("");
  const [dateRange, setDateRange] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<AddressLocation | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<AddressLocation | null>(null);
  const [dimensions, setDimensions] = useState({ length: "", width: "", weight: "" });
  const [photos, setPhotos] = useState<PendingRequestImage[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<Array<PendingRequestImage & { url: string }>>([]);
  const [photoError, setPhotoError] = useState("");
  const [stepError, setStepError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const dimensionsComplete = Object.values(dimensions).every(value => Number(value) > 0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const next = async () => {
    setStepError("");
    if (step === 0) {
      if (!itemName.trim()) return setStepError(t("Enter the item name"));
      if (!dimensionsComplete) return setStepError(t("Enter a valid length, width and weight"));
    }
    if (step === 2 && !pickupLocation) return setStepError(t("Choose a pickup location to continue"));
    if (step === 3 && !deliveryLocation) return setStepError(t("Choose a delivery location to continue"));
    if (step === 4 && timing === "Choose a date") {
      if (!preferredDateFrom) return setStepError(t("Choose a transport date to continue"));
      if (dateRange && !preferredDateTo) return setStepError(t("Choose an end date to continue"));
      if (dateRange && preferredDateTo < preferredDateFrom) return setStepError(t("End date must be on or after start date"));
    }
    if (step !== WIZARD_STEPS.length - 1) return setStep(step + 1);
    const token = getAuthToken();
    if (!token) return nav("/auth");
    if (!pickupLocation || !deliveryLocation) return;
    setPublishing(true);
    setPublishError("");
    try {
      const response = await fetch("/api/transports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category,
          itemName,
          description,
          lengthCm: Number(dimensions.length),
          widthCm: Number(dimensions.width),
          weightKg: Number(dimensions.weight),
          pickup: pickupLocation,
          delivery: deliveryLocation,
          timing,
          preferredDateFrom: timing === "Choose a date" && preferredDateFrom ? preferredDateFrom : null,
          preferredDateTo: timing === "Choose a date" && dateRange && preferredDateTo ? preferredDateTo : null,
        }),
      });
      const payload = await response.json() as { transport?: TransportRequest; error?: string };
      if (response.status === 401) {
        clearAuthSession();
        return nav("/auth");
      }
      if (!response.ok) throw new Error(payload.error || t("Unable to publish transport"));
      await syncPendingRequestImages(token, payload.transport?.id).catch(() => false);
      await clearPendingRequestImages().catch(() => undefined);
      setPhotos([]);
      nav("/customer");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : t("Unable to publish transport"));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    void loadPendingRequestImages().then(setPhotos).catch(() => setPhotoError(t("Unable to load saved photos")));
  }, [t]);

  useEffect(() => {
    const previews = photos.map(photo => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
    setPhotoPreviews(previews);
    return () => previews.forEach(photo => URL.revokeObjectURL(photo.url));
  }, [photos]);

  const addPhotos = async (files: File[]) => {
    setPhotoError("");
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    const valid = files.filter(file => allowedTypes.has(file.type) && file.size > 0 && file.size <= MAX_REQUEST_IMAGE_BYTES);
    if (valid.length !== files.length) setPhotoError(t("Choose image files up to 10 MB each"));
    const available = MAX_REQUEST_IMAGES - photos.length;
    if (valid.length > available) setPhotoError(t("You can add up to 3 photos"));
    const nextPhotos = [...photos, ...pendingImagesFromFiles(valid.slice(0, available))];
    setPhotos(nextPhotos);
    try {
      await savePendingRequestImages(nextPhotos);
    } catch {
      setPhotoError(t("Unable to save photos on this device"));
    }
  };

  const choosePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    void addPhotos(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const dropPhotos = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addPhotos(Array.from(event.dataTransfer.files));
  };

  const removePhoto = async (id: string) => {
    const nextPhotos = photos.filter(photo => photo.id !== id);
    setPhotos(nextPhotos);
    setPhotoError("");
    try {
      await savePendingRequestImages(nextPhotos);
    } catch {
      setPhotoError(t("Unable to save photos on this device"));
    }
  };

  const reviewTiming = timing === "Choose a date" && preferredDateFrom
    ? formatTransportDates(preferredDateFrom, dateRange ? preferredDateTo : null, language)
    : t(timing);

  return <div className="wizard"><header><Mark /><div className="wizard-header-actions"><span>{step + 1} / {WIZARD_STEPS.length}</span><LanguagePicker /><Link to={returnTo}>×</Link></div></header><div className="wizard-progress"><b style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }} />{WIZARD_STEPS.map((label, index) => <span className={index === step ? "current" : ""} key={label}>{t(label)}</span>)}</div><main>
    {step === 0 && <section><h1>{t("What are you moving?")}</h1><div className="choices">{CATEGORIES.map(item => <button type="button" className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{t(item)}</button>)}</div><label>{t("Item name")}<input value={itemName} onChange={event => { setItemName(event.target.value); setStepError(""); }} placeholder={t("Bed slats")} /></label><div className="inline-inputs"><label>{t("Length")}<input type="number" min="0.01" step="any" value={dimensions.length} onChange={event => { setDimensions({ ...dimensions, length: event.target.value }); setStepError(""); }} placeholder="cm" /></label><label>{t("Width")}<input type="number" min="0.01" step="any" value={dimensions.width} onChange={event => { setDimensions({ ...dimensions, width: event.target.value }); setStepError(""); }} placeholder="cm" /></label><label>{t("Weight")}<input type="number" min="0.01" step="any" value={dimensions.weight} onChange={event => { setDimensions({ ...dimensions, weight: event.target.value }); setStepError(""); }} placeholder="kg" /></label></div><label><span className="field-label">{t("Description")} <em>({t("Optional")})</em></span><textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={t("Anything carriers should know about the item?")} /></label></section>}
    {step === 1 && <section className="visual-step"><h1>{t("Show carriers what they’re moving.")}</h1><div className={`drop ${photoPreviews.length ? "has-photos" : ""}`} onDragOver={event => event.preventDefault()} onDrop={dropPhotos}><input ref={photoInput} className="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={choosePhotos} />{photoPreviews.length > 0 && <div className="photo-previews">{photoPreviews.map((photo, index) => <figure key={photo.id}><img src={photo.url} alt={`${t("Selected photo")} ${index + 1}`} /><button type="button" aria-label={t("Remove photo")} onClick={() => void removePhoto(photo.id)}>×</button></figure>)}</div>}<span>{t("Choose photos from your device or drop them here")}</span><button type="button" className="button dark short" disabled={photos.length >= MAX_REQUEST_IMAGES} onClick={() => photoInput.current?.click()}>{t("Choose photos")}</button></div>{photoError && <p className="field-error photo-error" role="alert">{photoError}</p>}<p className="help">{t("Photos help carriers give you a more accurate price.")} {t("Up to 3 photos.")}</p></section>}
    {step === 2 && <AddressStep label={t("Where should it be picked up?")} kind="pickup" location={pickupLocation} onLocationChange={location => { setPickupLocation(location); setStepError(""); }} />}
    {step === 3 && <AddressStep label={t("Where is it going?")} kind="delivery" location={deliveryLocation} onLocationChange={location => { setDeliveryLocation(location); setStepError(""); }} />}
    {step === 4 && <section><h1>{t("When should it be moved?")}</h1><div className="timing">{["Choose a date", "I’m flexible"].map(item => <button type="button" className={timing === item ? "selected" : ""} key={item} onClick={() => { setTiming(item); setStepError(""); }}><b>{t(item)}</b>{item === "I’m flexible" && <span>{t("Flexible jobs can often receive cheaper offers because carriers can combine them with existing routes.")}</span>}</button>)}</div>{timing === "Choose a date" && (dateRange ? <div className="date-range"><label>{t("From")}<input type="date" value={preferredDateFrom} onChange={event => { setPreferredDateFrom(event.target.value); setStepError(""); }} /></label><label>{t("To")}<input type="date" min={preferredDateFrom || undefined} value={preferredDateTo} onChange={event => { setPreferredDateTo(event.target.value); setStepError(""); }} /></label><button type="button" className="date-range-toggle" onClick={() => { setDateRange(false); setPreferredDateTo(""); setStepError(""); }}>{t("Use a single date")}</button>{preferredDateFrom && preferredDateTo && preferredDateTo < preferredDateFrom && <p className="field-error" role="alert">{t("End date must be on or after start date")}</p>}</div> : <div className="date-single"><label>{t("Transport date")}<input type="date" value={preferredDateFrom} onChange={event => { setPreferredDateFrom(event.target.value); setStepError(""); }} /></label><button type="button" className="date-range-toggle" onClick={() => { setDateRange(true); setStepError(""); }}>+ {t("Add date range")}</button></div>)}</section>}
    {step === 5 && <section className="review-request"><h1>{t("Ready to publish?")}</h1><article>{photoPreviews[0] ? <img className="request-review-image" src={photoPreviews[0].url} alt={`${t("Selected photo")} 1`} /> : <ItemImage label={itemName} />}<div><span>{t(category)}</span><h2>{itemName}</h2><TransportRoute from={pickupLocation?.formatted || t("Pickup location")} to={deliveryLocation?.formatted || t("Delivery location")} /><small>{reviewTiming}</small></div></article>{publishError && <p className="auth-message error" role="alert">{publishError}</p>}</section>}
    {stepError && <p className="field-error wizard-step-error" role="alert">{stepError}</p>}</main><footer><button type="button" className="button ghost" disabled={step === 0 || publishing} onClick={() => { setStepError(""); setStep(Math.max(0, step - 1)); }}>{t("Back")}</button><button type="button" className="button dark" disabled={publishing} onClick={() => void next()}>{t(step === WIZARD_STEPS.length - 1 ? "Publish request" : "Continue")} <Arrow /></button></footer></div>;
}

function AddressStep({ label, kind, location, onLocationChange }: { label: string; kind: "pickup" | "delivery"; location: AddressLocation | null; onLocationChange: (location: AddressLocation | null) => void }) { const { t } = useLanguage(); const isPickup = kind === "pickup"; return <section><h1>{label}</h1><AddressPicker label={t(isPickup ? "Pickup location" : "Delivery location")} placeholder={t("Search for an address, business or landmark")} value={location} onChange={onLocationChange} precisionHint={isPickup ? undefined : t("Move the pin to the exact delivery point.")} /><div className="details"><Picker label={t("Floor")} defaultValue="ground" options={[{ value: "ground", label: t("Ground floor") }, { value: "first", label: t("1st floor") }, { value: "upper", label: t("2nd floor+") }]} ariaLabel={t("Floor")} /><label><input type="checkbox" /> {t("Elevator available")}</label><label><input type="checkbox" /> {t("Help needed")}</label><label>{t("Instructions")}<textarea placeholder={t("Parking, access, entrance…")} /></label></div></section>; }
export function Registration() {
  const { language, t } = useLanguage();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  type AuthStage = "login" | "role" | "profile" | "email-code" | "phone" | "phone-code";
  const requestedMode = searchParams.get("mode");
  const verificationEmail = searchParams.get("verifyEmail") || "";
  const [stage, setStage] = useState<AuthStage>(verificationEmail ? "email-code" : requestedMode === "register" ? "role" : "login");
  const [role, setRole] = useState<AuthRole>(() => searchParams.get("role") === "transporter" ? "transporter" : "requester");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(verificationEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordConfirmationError, setPasswordConfirmationError] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [country, setCountry] = useState<CountryCode>("HR");
  const [localNumber, setLocalNumber] = useState("");
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [message, setMessage] = useState("");
  const [googleRegistrationToken, setGoogleRegistrationToken] = useState("");
  const emailResendCooldown = useEmailResendCooldown(Boolean(verificationEmail));
  const confirmationResult = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const firebaseAuth = useRef<Auth | null>(null);

  useEffect(() => () => {
    recaptchaVerifier.current?.clear();
    recaptchaVerifier.current = null;
  }, []);

  useEffect(() => {
    setStage(verificationEmail ? "email-code" : requestedMode === "register" ? "role" : "login");
    if (verificationEmail) setEmail(verificationEmail);
    setGoogleRegistrationToken("");
    setAuthError("");
    setMessage("");
  }, [requestedMode, verificationEmail]);

  const syncPhotosAndNavigate = async (token: string, user: AuthenticatedUser) => {
    await syncPendingRequestImages(token).catch(() => false);
    nav(user.role === "transporter" ? "/carrier" : "/customer");
  };

  const validatePasswords = () => {
    if (stage !== "profile" || googleRegistrationToken) return true;
    const nextPasswordError = password.length < 12 ? t("Password must be at least 12 characters") : "";
    const nextConfirmationError = password !== passwordConfirmation ? t("Passwords do not match") : "";
    setPasswordError(nextPasswordError);
    setPasswordConfirmationError(nextConfirmationError);
    return !nextPasswordError && !nextConfirmationError;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage === "login") {
      if (!email.trim()) return setAuthError(t("Enter your email address"));
      if (!isValidEmail(email)) return setAuthError(t("Enter a valid email address"));
      if (!password) return setAuthError(t("Enter your password"));
    }
    if (stage === "profile") {
      if (!firstName.trim() || !lastName.trim()) return setAuthError(t("Enter your first and last name"));
      if (!googleRegistrationToken && !isValidEmail(email)) return setAuthError(t("Enter a valid email address"));
    }
    if (!validatePasswords()) return;
    if (stage === "profile" && googleRegistrationToken) {
      setAuthError("");
      setStage("phone");
      return;
    }
    setSubmitting(true);
    setAuthError("");
    try {
      const response = await fetch(stage === "profile" ? "/api/auth/password/register" : "/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password, passwordConfirmation, role }),
      });
      const payload = await response.json() as { token?: string; email?: string; user?: AuthenticatedUser; error?: string; code?: string };
      if (!response.ok) {
        if (payload.code === "EMAIL_NOT_VERIFIED") {
          await fetch("/api/auth/email/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
          setStage("email-code");
          emailResendCooldown.start();
          return;
        }
        throw new Error(payload.error || t(stage === "profile" ? "Unable to create account" : "Unable to sign in"));
      }
      if (stage === "profile") {
        setEmail(payload.email || email);
        setStage("email-code");
        emailResendCooldown.start();
        return;
      }
      if (!payload.user) throw new Error(t("Unable to sign in"));
      setRole(payload.user.role);
      if (!payload.user.phoneVerified) {
        setStage("phone");
        return;
      }
      await syncPhotosAndNavigate(getAuthToken(), payload.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t(stage === "profile" ? "Unable to create account" : "Unable to sign in"));
    } finally {
      setSubmitting(false);
    }
  };

  const authenticated = (user: AuthenticatedUser) => {
    window.localStorage.removeItem("auth_token");
    setGoogleRegistrationToken("");
    setRole(user.role);
    if (user.phoneVerified) void syncPhotosAndNavigate(getAuthToken(), user);
    else setStage("phone");
  };

  const beginGoogleRegistration = ({ token, profile }: GoogleRegistration) => {
    window.localStorage.removeItem("auth_token");
    setGoogleRegistrationToken(token);
    setEmail(profile.email);
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPassword("");
    setPasswordConfirmation("");
    setAuthError("");
    setStage("role");
  };

  const backToLogin = () => {
    setGoogleRegistrationToken("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setStage("login");
    nav("/auth");
  };

  const verifyEmailCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emailCode.length !== 6) return setAuthError(t("Enter the complete six-digit code"));
    setSubmitting(true); setAuthError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: emailCode }) });
      const payload = await response.json() as { token?: string; user?: AuthenticatedUser; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || t("Unable to verify your email"));
      window.localStorage.removeItem("auth_token");
      setRole(payload.user.role);
      setStage("phone");
    } catch (error) { setAuthError(error instanceof Error ? error.message : t("Unable to verify your email")); }
    finally { setSubmitting(false); }
  };

  const resendEmailCode = async () => {
    if (submitting || emailResendCooldown.remaining > 0) return;
    setSubmitting(true); setAuthError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to send verification email"));
      emailResendCooldown.start();
    } catch (error) { setAuthError(error instanceof Error ? error.message : t("Unable to send verification email")); }
    finally { setSubmitting(false); }
  };

  const sendPhoneCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setPhoneError(""); setAuthError(""); setMessage("");
    try {
      const authorizationToken = googleRegistrationToken || getAuthToken();
      const configResponse = await fetch("/api/auth/config", { cache: "no-store" });
      const configPayload = await configResponse.json() as AuthConfig;
      if (!configResponse.ok || !configPayload.firebase?.enabled) throw new Error("Phone verification unavailable");
      const phoneNumber = normalizedPhoneNumber(country, localNumber);
      if (!phoneNumber) return setPhoneError(t("Enter a valid mobile number for the selected country"));

      const validationResponse = await fetch("/api/auth/phone/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authorizationToken}` }, body: JSON.stringify({ phoneNumber }) });
      if (!validationResponse.ok) throw new Error("Phone verification unavailable");

      const auth = getFirebasePhoneAuth(configPayload.firebase);
      auth.languageCode = language;
      firebaseAuth.current = auth;

      recaptchaVerifier.current?.clear();
      const verifier = new RecaptchaVerifier(auth, "firebase-phone-recaptcha", { size: "invisible" });
      recaptchaVerifier.current = verifier;
      confirmationResult.current = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setPendingPhoneNumber(phoneNumber);
      setStage("phone-code");
      setMessage(configPayload.firebase.testMode ? "" : t("We sent a six-digit code to your phone."));
    } catch (error) {
      setAuthError(firebasePhoneError(error, t, "send"));
      confirmationResult.current = null;
    } finally {
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = null;
      setSubmitting(false);
    }
  };

  const verifyPhoneCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingPhoneNumber || phoneCode.length !== 6) return setAuthError(t("Enter the complete six-digit code"));
    if (!confirmationResult.current) return setAuthError(t("Send a new verification code before continuing."));
    setSubmitting(true); setAuthError("");
    try {
      const credential = await confirmationResult.current.confirm(phoneCode);
      const firebaseIdToken = await credential.user.getIdToken();
      const authorizationToken = googleRegistrationToken || getAuthToken();
      const response = await fetch("/api/auth/phone/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authorizationToken}` }, body: JSON.stringify({ firebaseIdToken, ...(googleRegistrationToken ? { role, firstName, lastName } : {}) }) });
      const payload = await response.json() as { token?: string; user?: AuthenticatedUser };
      if (response.status === 409) {
        setAuthError(t("This phone number is already linked to an account."));
        return;
      }
      if (!response.ok || !payload.user) throw new Error("Phone verification unavailable");
      const sessionToken = getAuthToken();
      window.localStorage.removeItem("auth_token");
      if (firebaseAuth.current) await signOut(firebaseAuth.current);
      confirmationResult.current = null;
      setGoogleRegistrationToken("");
      await syncPhotosAndNavigate(sessionToken, payload.user);
    } catch (error) { setAuthError(firebasePhoneError(error, t, "verify")); }
    finally { setSubmitting(false); }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main>
    {stage === "login" && <><h1>{t("Login or create new account")}</h1><GoogleSignInButton onAuthenticated={authenticated} onRegistrationRequired={beginGoogleRegistration} /><div className="or">{t("or")}</div><form className="auth-form" noValidate onSubmit={handleSubmit}><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label><div className="password-field"><label>{t("Password")}<PasswordControl value={password} onChange={event => setPassword(event.target.value)} placeholder={t("Password")} autoComplete="current-password" /></label><Link className="forgot-password" to="/auth/forgot-password">{t("Forgot your password?")}</Link></div>{authError && <p className="auth-error" role="alert">{authError}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Sign in")} <Arrow /></button></form><p className="auth-signup-prompt">{t("Don't have an account?")} <Link to="/auth?mode=register">{t("Create one here")}</Link></p></>}
    {stage === "role" && <><h1>{t("How will you use VanScout?")}</h1><RolePicker value={role} onChange={setRole} /><button type="button" className="button dark full" onClick={() => setStage("profile")}>{t("Continue")} <Arrow /></button><button className="quiet-link auth-back" type="button" onClick={backToLogin}>← {t("Back")}</button></>}
    {stage === "profile" && <><h1>{t("Create your account")}</h1><form className="auth-form" noValidate onSubmit={handleSubmit}><div className="name-fields"><label>{t("First name")}<input value={firstName} onChange={event => setFirstName(event.target.value)} placeholder={t("e.g. Ana")} autoComplete="given-name" /></label><label>{t("Last name")}<input value={lastName} onChange={event => setLastName(event.target.value)} placeholder={t("e.g. Novak")} autoComplete="family-name" /></label></div>{!googleRegistrationToken && <><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label><div className="password-field"><label>{t("Password")}<PasswordControl value={password} onChange={event => { const value = event.target.value; setPassword(value); setPasswordError(value.length > 0 && value.length < 12 ? t("Password must be at least 12 characters") : ""); setPasswordConfirmationError(passwordConfirmation && value !== passwordConfirmation ? t("Passwords do not match") : ""); }} placeholder={t("Create a password")} autoComplete="new-password" aria-invalid={Boolean(passwordError)} />{passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label><label className="password-confirmation"><span>{t("Confirm password")}</span><PasswordControl value={passwordConfirmation} onChange={event => { const value = event.target.value; setPasswordConfirmation(value); setPasswordConfirmationError(value && value !== password ? t("Passwords do not match") : ""); }} placeholder={t("Repeat your password")} autoComplete="new-password" aria-invalid={Boolean(passwordConfirmationError)} />{passwordConfirmationError && <span className="field-error" role="alert">{passwordConfirmationError}</span>}</label></div></>}{authError && <p className="auth-error" role="alert">{authError}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Confirm and continue")} <Arrow /></button></form><button type="button" className="quiet-link auth-back" onClick={() => setStage("role")}>← {t("Back")}</button></>}
    {stage === "email-code" && <><h1>{t("Enter your email code")}</h1><p>{t("We sent a six-digit verification code to")} <strong>{email}</strong>.</p><form noValidate onSubmit={verifyEmailCode}><OtpInput value={emailCode} onChange={setEmailCode} disabled={submitting} />{authError && <p className="auth-message error" role="alert">{authError}</p>}<button className="button dark full" type="submit" disabled={submitting || emailCode.length !== 6}>{t("Verify email")} <Arrow /></button></form><button className="quiet-link center" type="button" onClick={() => void resendEmailCode()} disabled={submitting || emailResendCooldown.remaining > 0}>{emailResendCooldown.remaining > 0 ? t("Send a new code in {seconds}s", { seconds: emailResendCooldown.remaining }) : t("Send a new code")}</button></>}
    {stage === "phone" && <><h1>{t("Verify your phone.")}</h1><div className="security-note"><b>{t("Why we verify your phone")}</b><p>{t("Once a transport is agreed, VanScout shares phone contacts between both people. A verified number makes coordination easier and helps show that each person is genuine, adding an important layer of safety.")}</p></div><form noValidate onSubmit={sendPhoneCode}><PhoneNumberField country={country} localNumber={localNumber} onCountryChange={value => { setCountry(value); setLocalNumber(""); setPhoneError(""); }} onNumberChange={value => { setLocalNumber(value); setPhoneError(""); }} error={phoneError} />{authError && <p className="auth-message error" role="alert">{authError}</p>}<button className="button dark full auth-create-button" type="submit" disabled={submitting}>{t("Send verification code")} <Arrow /></button></form></>}
    {stage === "phone-code" && <><h1>{t("Enter your phone code")}</h1><p>{t("Enter the code sent to")} <strong>{parsePhoneNumberFromString(pendingPhoneNumber)?.formatInternational() || pendingPhoneNumber}</strong>.</p><form noValidate onSubmit={verifyPhoneCode}><OtpInput value={phoneCode} onChange={setPhoneCode} disabled={submitting} />{message && <p className="auth-message success">{message}</p>}{authError && <p className="auth-message error" role="alert">{authError}</p>}<button className="button dark full" type="submit" disabled={submitting || phoneCode.length !== 6}>{t("Verify and continue")} <Arrow /></button></form><button className="quiet-link center" type="button" onClick={() => { setStage("phone"); setPhoneCode(""); setPendingPhoneNumber(""); confirmationResult.current = null; }}>{t("Send a new code or change phone number")}</button></>}
    <div id="firebase-phone-recaptcha" />
  </main></div>;
}

export function CheckEmail() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const emailResendCooldown = useEmailResendCooldown(true);

  const resend = async () => {
    if (submitting || emailResendCooldown.remaining > 0) return;
    if (!email.trim()) {
      setError(t("Enter your email address"));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t("Enter a valid email address"));
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to send verification email"));
      setMessage(payload.message || t("Verification email sent"));
      emailResendCooldown.start();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t("Unable to send verification email"));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><h1>{t("Check your email")}</h1><p>{t("We sent a six-digit verification code to")} <strong>{email}</strong>.</p><label>{t("Email")}<input type="email" value={email} onChange={event => { setEmail(event.target.value); setError(""); }} autoComplete="email" /></label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error" role="alert">{error}</p>}<Link className="button dark full auth-create-button" to={`/auth?verifyEmail=${encodeURIComponent(email)}`} onClick={event => { if (!email.trim()) { event.preventDefault(); setError(t("Enter your email address")); } else if (!isValidEmail(email)) { event.preventDefault(); setError(t("Enter a valid email address")); } }}>{t("Continue verification")}</Link><button className="quiet-link center" type="button" onClick={() => void resend()} disabled={submitting || emailResendCooldown.remaining > 0}>{emailResendCooldown.remaining > 0 ? t("Send a new code in {seconds}s", { seconds: emailResendCooldown.remaining }) : t("Send a new code")}</button><Link className="quiet-link auth-back" to="/auth">{t("Back to sign in")}</Link></main></div>;
}

export function VerifyEmail() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    void fetch("/api/auth/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(response => {
      setStatus(response.ok ? "success" : "error");
      window.history.replaceState({}, "", "/auth/verify-email");
    }).catch(() => setStatus("error"));
  }, [token]);

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><h1>{status === "loading" ? t("Confirming your email…") : status === "success" ? t("Email verified") : t("Unable to verify your email")}</h1><p>{status === "success" ? t("Your email has been verified. You can now sign in.") : status === "error" ? t("This verification link is invalid or expired") : t("Please wait while we confirm your email.")}</p><Link className="button dark full auth-create-button" to="/auth">{t("Back to sign in")}</Link></main></div>;
}

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError(t("Enter your email address"));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t("Enter a valid email address"));
      return;
    }
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to send the reset email"));
      setMessage(payload.message || t("If an account exists for this email, a reset link has been sent."));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("Unable to send the reset email"));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><h1>{t("Reset password")}</h1><form className="auth-form" noValidate onSubmit={handleSubmit}><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error" role="alert">{error}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Send reset link")} <Arrow /></button></form><Link className="quiet-link auth-back" to="/auth">← {t("Back")}</Link></main></div>;
}

export function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordConfirmationError, setPasswordConfirmationError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validatePasswords = () => {
    const nextPasswordError = password.length < 12 ? t("Password must be at least 12 characters") : "";
    const nextConfirmationError = password !== passwordConfirmation ? t("Passwords do not match") : "";
    setPasswordError(nextPasswordError);
    setPasswordConfirmationError(nextConfirmationError);
    return !nextPasswordError && !nextConfirmationError;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePasswords()) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirmation }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to reset password"));
      setMessage(payload.message || t("Password reset successfully"));
      setPassword("");
      setPasswordConfirmation("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("Unable to reset password"));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main>{!token ? <p className="auth-message error">{t("This reset link is invalid or expired")}</p> : <form className="auth-form" noValidate onSubmit={handleSubmit}><label>{t("New password")}<PasswordControl value={password} onChange={event => { const value = event.target.value; setPassword(value); setPasswordError(value.length > 0 && value.length < 12 ? t("Password must be at least 12 characters") : ""); setPasswordConfirmationError(passwordConfirmation && value !== passwordConfirmation ? t("Passwords do not match") : ""); }} autoComplete="new-password" aria-describedby="reset-password-hint" aria-invalid={Boolean(passwordError)} /><span className="field-hint" id="reset-password-hint">{t("Use at least 12 characters")}</span>{passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label><label className="password-confirmation">{t("Confirm password")}<PasswordControl value={passwordConfirmation} onChange={event => { const value = event.target.value; setPasswordConfirmation(value); setPasswordConfirmationError(value && value !== password ? t("Passwords do not match") : ""); }} placeholder={t("Repeat your password")} autoComplete="new-password" aria-invalid={Boolean(passwordConfirmationError)} />{passwordConfirmationError && <span className="field-error" role="alert">{passwordConfirmationError}</span>}</label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error" role="alert">{error}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Reset password")} <Arrow /></button></form>}<Link className="quiet-link auth-back" to="/auth">{t("Back to sign in")}</Link></main></div>;
}

function isTransportOverdue(status: TransportStatus, preferredDateFrom: string | null, preferredDateTo: string | null) {
  if (status === "completed") return false;
  const dueDate = preferredDateTo || preferredDateFrom;
  if (!dueDate) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return dueDate < today;
}

function transportStatusLabel(status: TransportStatus, preferredDateFrom: string | null = null, preferredDateTo: string | null = null) {
  if (status === "completed") return "Done";
  if (isTransportOverdue(status, preferredDateFrom, preferredDateTo)) return "Overdue";
  return status === "carrier_booked" ? "Transport agreed" : "Searching for carrier";
}

function transportStatusClass(status: TransportStatus, preferredDateFrom: string | null = null, preferredDateTo: string | null = null) {
  if (status === "completed") return "done";
  if (isTransportOverdue(status, preferredDateFrom, preferredDateTo)) return "overdue";
  return status === "carrier_booked" ? "booked" : "";
}

function formatTransportDates(from: string, to: string | null, language: "en" | "hr") {
  const formatter = new Intl.DateTimeFormat(language === "hr" ? "hr-HR" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const format = (value: string) => {
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isNaN(parsed.getTime()) ? value : formatter.format(parsed);
  };
  return to ? `${format(from)} – ${format(to)}` : format(from);
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function OfferPrice({ priceCents, vatIncluded, className = "" }: { priceCents: number; vatIncluded: boolean; className?: string }) {
  const { t } = useLanguage();
  const { netCents, vatCents, totalCents } = offerPriceFromTotal(priceCents);
  return <span className={`offer-price-breakdown ${className}`.trim()}>
    <strong>{vatIncluded ? formatEuro(totalCents) : `${formatEuro(netCents)} + ${formatEuro(vatCents)} ${t("VAT")}`}</strong>
    <small>{vatIncluded ? t("({amount} VAT included)", { amount: formatEuro(vatCents) }) : t("Total: {amount}", { amount: formatEuro(totalCents) })}</small>
  </span>;
}

function formatTransportMeasurements(request: Pick<TransportRequest, "lengthCm" | "widthCm" | "weightKg">, language: "en" | "hr", weightFirst = false) {
  const formatter = new Intl.NumberFormat(language === "hr" ? "hr-HR" : "en-GB", { maximumFractionDigits: 2 });
  const length = `${formatter.format(request.lengthCm)}\u00a0cm`;
  const width = `${formatter.format(request.widthCm)}\u00a0cm`;
  const weight = `${formatter.format(request.weightKg)}\u00a0kg`;
  return weightFirst ? `${weight} · ${length} × ${width}` : `${length} × ${width} · ${weight}`;
}

function formatShortAddress(address: string) {
  const parts = address.split(",").map(part => part.trim()).filter(Boolean);
  if (/^(croatia|hrvatska)$/i.test(parts.at(-1) || "")) parts.pop();
  if (parts.length > 1) {
    parts[parts.length - 1] = parts[parts.length - 1]
      .replace(/^\d{4,6}\s+/, "")
      .replace(/^(city of|grad)\s+/i, "");
  }
  return (parts.length > 2 ? parts.slice(0, 2) : parts).join(", ");
}

function RequestRow({ request, onClick }: { request: TransportRequest; onClick: () => void }) {
  const { language, t } = useLanguage();
  const statusTone = transportStatusClass(request.status, request.preferredDateFrom, request.preferredDateTo);
  return <article className="request-row"><TransportImage request={request} /><div><h3>{request.itemName}</h3><TransportRoute from={request.pickup.formatted} to={request.delivery.formatted} short /><span className={`status ${statusTone}`}>{t(transportStatusLabel(request.status, request.preferredDateFrom, request.preferredDateTo))}</span></div><div className="request-meta"><b>{request.distanceKm} km</b><span>{request.preferredDateFrom ? formatTransportDates(request.preferredDateFrom, request.preferredDateTo, language) : t(request.timing)}</span></div><button className="button dark short" onClick={onClick}>{t("Open transport")}</button></article>;
}

export function CustomerWorkspace() {
  const { t } = useLanguage();
  const loc = useLocation();
  const nav = useNavigate();
  const [view, setView] = useState(loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("profile") ? "profile" : "requests");
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [transports, setTransports] = useState<TransportRequest[]>([]);
  const [selectedTransport, setSelectedTransport] = useState<TransportRequest | null>(null);
  const [loadingTransports, setLoadingTransports] = useState(true);
  const [transportError, setTransportError] = useState("");
  const go = (next: string, offerId?: string) => { setView(next); nav(next === "messages" ? `/customer/messages${offerId ? `?offer=${offerId}` : ""}` : next === "profile" ? "/customer/profile" : "/customer"); };

  useEffect(() => {
    setView(loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("profile") ? "profile" : "requests");
    setSelectedTransport(null);
  }, [loc.pathname]);

  useEffect(() => {
    const controller = new AbortController();
    const token = getAuthToken();
    setLoadingTransports(true);
    setTransportError("");
    setTransports([]);
    if (!token) {
      setLoadingTransports(false);
      nav("/auth", { replace: true });
      return () => controller.abort();
    }
    void fetch(`/api/transports?status=${filter}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        const payload = await response.json() as { transports?: TransportRequest[]; error?: string };
        if (response.status === 401) {
          clearAuthSession();
          nav("/auth", { replace: true });
          return;
        }
        if (!response.ok) throw new Error(payload.error || t("Unable to load transports"));
        setTransports(payload.transports || []);
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setTransportError(error instanceof Error ? error.message : t("Unable to load transports"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingTransports(false); });
    return () => controller.abort();
  }, [filter, nav, t]);

  return <div className="app"><Topbar kind="customer" active={view === "requests" ? "requests" : view} /><main className="workspace">{view === "requests" && !selectedTransport && <section className="requests"><div className="workspace-title"><div><h1>{t("Your transports")}</h1></div><div className="tabs" role="group" aria-label={t("Filter transports")}><button className={filter === "active" ? "selected" : ""} aria-pressed={filter === "active"} onClick={() => setFilter("active")}>{t("Active")}</button><button className={filter === "completed" ? "selected" : ""} aria-pressed={filter === "completed"} onClick={() => setFilter("completed")}>{t("Completed")}</button></div></div>{loadingTransports ? <p className="transport-list-message" role="status">{t("Loading transports…")}</p> : transportError ? <p className="transport-list-message error" role="alert">{transportError}</p> : transports.length ? <div className="rows">{transports.map(request => <RequestRow request={request} onClick={() => setSelectedTransport(request)} key={request.id} />)}</div> : <div className="empty-transports"><h2>{t(filter === "completed" ? "No completed transports" : "No active transports")}</h2><p>{t(filter === "completed" ? "Your completed transports will appear here." : "Publish a request to start receiving offers from carriers.")}</p>{filter === "active" && <Link className="button moss" to="/create-request" state={{ returnTo: "/customer" }}>{t("Create a request")}</Link>}</div>}</section>}{view === "requests" && selectedTransport && <RequestDetail request={selectedTransport} onBack={() => setSelectedTransport(null)} onOpenMessages={offerId => go("messages", offerId)} />}{view === "messages" && <LiveMessages />}{view === "profile" && <CustomerProfile />}</main></div>;
}

function RequestDetail({ request, onBack, onOpenMessages }: { request: TransportRequest; onBack: () => void; onOpenMessages: (offerId: string) => void }) {
  const { language, t } = useLanguage();
  const [offers, setOffers] = useState<TransportOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasOffers = !loading && offers.length > 0;
  const loadOffers = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await fetch(`/api/transports/${request.id}/offers`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { offers?: TransportOffer[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to load offers"));
      setOffers(payload.offers || []);
      window.dispatchEvent(new Event("vanscout-offers-read"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Unable to load offers"));
    } finally { setLoading(false); }
  };
  useEffect(() => { void loadOffers(); }, [request.id]);
  return <section className="job-detail customer-job-detail">
    <div className="job-detail-actions"><button className="back detail-back" onClick={onBack}><span aria-hidden="true">←</span><span>{t("Your transports")}</span></button></div>
    <TransportDetailHeader request={request} />
    <div className={`job-layout customer-detail-layout ${hasOffers ? "with-offers" : "no-offers"}`}>
      <TransportDetails request={request} />
      {hasOffers && <aside className="customer-offers-panel">
        <div className="offers-heading"><div><h2>{t("Offers")}</h2><p>{t("Chat with carriers before choosing who is ready for the transport.")}</p></div></div>
        <div className="customer-offer-list">{offers.map(offer => <article className="offer live-offer customer-live-offer" key={offer.id}>
          <div className="offer-person"><b>{offer.companyName || offer.carrierName}</b><span>{offer.carrierName} · {offer.completedTransports} {t("completed transports")}</span></div>
          <div className="offer-time"><b>{formatTransportDates(offer.availableDate, null, language)}</b><span>{t("Available date")}</span></div>
          {offer.message && <p>“{offer.message}”</p>}
          <div className="price"><OfferPrice priceCents={offer.priceCents} vatIncluded={offer.vatIncluded} /></div>
          <div className="offer-actions"><span className={`status ${offer.status === "confirmed" ? "booked" : ""}`}>{t(offer.status === "confirmed" ? "Transport agreed" : offer.selectedByCustomer ? "Your selected carrier" : offer.status === "rejected" ? "Not selected" : "Chat available")}</span><button className="button dark short" onClick={() => onOpenMessages(offer.id)}>{t("Open chat")}</button></div>
        </article>)}</div>
      </aside>}
    </div>
    {error && <p className="transport-list-message error" role="alert">{error}</p>}
  </section>;
}
function OfferCard({ offer, onProfile, onMessage, onAccept }: { offer: Offer; onProfile: () => void; onMessage: () => void; onAccept: () => void }) { const { t } = useLanguage(); return <article className="offer"><button onClick={onProfile}><Avatar offer={offer} /></button><div className="offer-person"><button onClick={onProfile}>{offer.name}</button><span>★ {offer.rating} · {t(offer.jobs)}</span><small>{offer.vehicle}</small></div><div className="offer-time"><b>{t(offer.time)}</b><span>{t("Available window")}</span></div><p>“{t(offer.note)}”</p><div className="price"><b>{offer.price}</b><span>{t("all in")}</span></div><div className="offer-actions"><button onClick={onMessage}>{t("Message")}</button><button onClick={onProfile}>{t("View profile")}</button><button className="button moss short" onClick={onAccept}>{t("Accept")}</button></div></article>; }
function OfferDialog({ offer, onClose, onAccept, onMessage }: { offer: Offer; onClose: () => void; onAccept: () => void; onMessage: () => void }) { const { t } = useLanguage(); const [profile, setProfile] = useState(true); return <div className="overlay">{profile ? <aside className="side"><button className="close" onClick={onClose}>×</button><div className="profile-head"><Avatar offer={offer} large /><div><p className="eyebrow">{t("Verified carrier")}</p><h2>{offer.name}</h2><p>★ {offer.rating} · {t(offer.jobs)} {t("completed")}</p></div></div><p>{t("I move furniture and store purchases around Zagreb with a clean, fully-equipped large van. Clear communication, careful handling.")}</p><section><h3>{t("Vehicle")}</h3><div className="vehicle">▰ <div><b>{offer.vehicle}</b><span>{t("Large van")} · 3.2m {t("cargo length")}</span></div></div></section><section><h3>{t("Previous work")}</h3><div className="work-shots"><span /><span /><span /></div></section><blockquote>{t("On time, careful with everything, and a genuinely nice person.")}<footer>— Ana, {t("verified customer")}</footer></blockquote><footer className="side-actions"><button className="button ghost" onClick={onMessage}>{t("Message")}</button><button className="button moss" onClick={() => setProfile(false)}>{t("Accept")} {offer.price}</button></footer></aside> : <div className="confirm"><button className="close" onClick={onClose}>×</button><p className="eyebrow">{t("Confirm carrier")}</p><h2>{t("Choose {name} for this transport?", { name: offer.name })}</h2><div><b>{offer.price}</b><span>IKEA Zagreb → Trešnjevka</span><span>{t(offer.time)}</span></div><p>{t("After accepting, you and the carrier will be able to see each other’s contact information.")}</p><footer><button className="button ghost" onClick={() => setProfile(true)}>{t("Cancel")}</button><button className="button moss" onClick={onAccept}>{t("Accept offer")}</button></footer></div>}</div>; }
function Accepted({ onTracking, onReview }: { onTracking: () => void; onReview: () => void }) { const { t } = useLanguage(); return <div className="accepted"><section className="booked-card"><Avatar large /><div><p className="eyebrow">{t("Your carrier")}</p><h2>Mario M.</h2><p>★ 4.9 · Renault Master</p></div><div><a href="tel:+385915552400">+385 91 555 2400</a><a href="mailto:mario@example.com">mario@example.com</a></div></section><div className="transport-steps"><div className="done"><b>✓</b><span><strong>{t("Booked")}</strong><small>{t("Mario accepted your transport.")}</small></span></div><div className="active"><b>●</b><span><strong>{t("Pickup")}</strong><small>{t("Today")}, 17:00–19:00</small></span></div><div><b>○</b><span><strong>{t("In transit")}</strong><small>{t("Live updates will appear here.")}</small></span></div><div><b>○</b><span><strong>{t("Delivered")}</strong><small>{t("Review the transport when it’s done.")}</small></span></div></div><div className="actions"><button className="button dark" onClick={onTracking}>{t("Open delivery tracking")} <Arrow /></button><button className="quiet-link" onClick={onReview}>{t("Preview review flow")}</button></div></div>; }
function Messages({ onAccept }: { onAccept: () => void }) { const { t } = useLanguage(); const [note, setNote] = useState(""); const [sent, setSent] = useState<string[]>([]); return <section className="messages-page"><header><p className="eyebrow">{t("Keep it in one place")}</p><h1>{t("Messages")}</h1></header><div className="messages"><aside><button className="conversation selected"><Avatar /><span><b>Mario M.</b><small>{t("Sounds good—17:00 works.")}</small></span><i>2m</i></button><button className="conversation"><Avatar offer={OFFERS[1]} /><span><b>Luka P.</b><small>{t("I can do tomorrow morning.")}</small></span><i>1h</i></button></aside><article><header><div><Avatar /><span><b>Mario M.</b><small>★ 4.9 · Renault Master</small></span></div><b className="offer-tag">{t("Offer: €32")}</b></header><div className="chat-context"><span>{t("Pickup: Today, 17:00–19:00")}</span><button className="button moss short" onClick={onAccept}>{t("Accept offer")}</button></div><div className="thread"><p className="bubble theirs">{t("Hi Ana, I’m already collecting an order near IKEA this afternoon. I can pick up the bed slats between 17:00–19:00.")}</p><p className="bubble mine">{t("Great, that works. It’s ground floor pickup and the slats are already packed.")}</p><p className="contact-note">{t("Contact information can be shared after an offer is accepted.")}</p>{sent.map(x => <p className="bubble mine" key={x}>{x}</p>)}</div><form noValidate onSubmit={event => { event.preventDefault(); if (note.trim()) { setSent([...sent, note.trim()]); setNote(""); } }}><input value={note} onChange={event => setNote(event.target.value)} placeholder={t("Write a message")} /><button aria-label={t("Send")}>↑</button></form></article></div></section>; }
function LiveMessages() {
  const { language, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("offer") || "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [agreementSaving, setAgreementSaving] = useState(false);
  const [realtimeUserId, setRealtimeUserId] = useState("");
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const ablyClient = useRef<Realtime | null>(null);
  const selectedIdRef = useRef("");
  const selected = conversations.find(conversation => conversation.offerId === selectedId) || null;
  const conversationIds = useMemo(() => conversations.map(conversation => conversation.offerId).sort().join(","), [conversations]);

  const loadConversations = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await fetch("/api/conversations", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { conversations?: Conversation[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to load messages"));
      const next = payload.conversations || [];
      setConversations(next);
      setSelectedId(current => current && next.some(item => item.offerId === current) ? current : next[0]?.offerId || "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Unable to load messages"));
    }
  }, [t]);

  const loadMessages = useCallback(async (offerId: string) => {
    const token = getAuthToken();
    if (!token || !offerId) return;
    try {
      const response = await fetch(`/api/conversations/${offerId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { messages?: ChatMessage[]; userId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to load messages"));
      setMessages(payload.messages || []);
      setUserId(payload.userId || "");
      setError("");
      window.dispatchEvent(new Event("vanscout-messages-read"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("Unable to load messages"));
    }
  }, [t]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) setMessages([]);
    else void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    void loadConversations();
    void fetchSessionUser().then(async user => {
      setRealtimeUserId(user?.id || "");
      const token = getAuthToken();
      if (!user || !token) return;
      const response = await fetch("/api/realtime/status", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json() as { enabled?: boolean };
      setRealtimeEnabled(response.ok && payload.enabled === true);
    }).catch(() => {
      setRealtimeUserId("");
      setRealtimeEnabled(false);
    });
  }, [loadConversations]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !realtimeUserId || !realtimeEnabled) return;
    const client = new Realtime({
      autoConnect: true,
      authCallback: async (_params, callback) => {
        try {
          const response = await fetch("/api/realtime/ably-token", { headers: { Authorization: `Bearer ${token}` } });
          const payload = await response.json() as TokenRequest & { error?: string };
          if (!response.ok) throw new Error(payload.error || "Realtime is unavailable");
          callback(null, payload);
        } catch (authError) {
          callback(authError instanceof Error ? authError.message : "Realtime is unavailable", null);
        }
      },
    });
    ablyClient.current = client;
    const connectionListener = () => setRealtimeConnected(client.connection.state === "connected");
    client.connection.on(connectionListener);
    connectionListener();
    return () => {
      client.connection.off(connectionListener);
      client.close();
      if (ablyClient.current === client) ablyClient.current = null;
      setRealtimeConnected(false);
    };
  }, [realtimeEnabled, realtimeUserId]);

  useEffect(() => {
    const client = ablyClient.current;
    if (!client || !realtimeConnected || !realtimeUserId) return;
    let cancelled = false;
    const subscriptions: Array<{ channelName: string; listener: () => void }> = [];
    void (async () => {
      try {
        await client.auth.authorize();
        if (cancelled) return;
        const userChannelName = `user:${realtimeUserId}`;
        const userListener = () => void loadConversations();
        subscriptions.push({ channelName: userChannelName, listener: userListener });
        await client.channels.get(userChannelName).subscribe(userListener);
        for (const offerId of conversationIds ? conversationIds.split(",") : []) {
          if (cancelled) return;
          const channelName = `chat:${offerId}`;
          const listener = () => {
            void loadConversations();
            if (selectedIdRef.current === offerId) void loadMessages(offerId);
          };
          subscriptions.push({ channelName, listener });
          await client.channels.get(channelName).subscribe(listener);
        }
      } catch {
        setRealtimeConnected(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const subscription of subscriptions) client.channels.get(subscription.channelName).unsubscribe(subscription.listener);
    };
  }, [conversationIds, realtimeConnected, realtimeUserId, loadConversations, loadMessages]);

  useEffect(() => {
    if (realtimeConnected) return;
    const timer = window.setInterval(() => {
      void loadConversations();
      if (selectedIdRef.current) void loadMessages(selectedIdRef.current);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [realtimeConnected, loadConversations, loadMessages]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = note.trim();
    const token = getAuthToken();
    if (!body) {
      setError(t("Enter a message before sending"));
      return;
    }
    if (!token || !selectedId) return;
    setNote("");
    const response = await fetch(`/api/conversations/${selectedId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    const payload = await response.json() as { message?: ChatMessage; error?: string; requiredCents?: number; balanceCents?: number };
    if (!response.ok) {
      setNote(body);
      const missing = Math.max(0, Number(payload.requiredCents || 0) - Number(payload.balanceCents || 0));
      setError(response.status === 402 ? t("Add {amount} in credits to continue.", { amount: formatEuro(missing) }) : payload.error || t("Unable to send message"));
      return;
    }
    if (payload.message) {
      setMessages(current => current.some(message => message.id === payload.message?.id)
        ? current
        : [...current, payload.message as ChatMessage]);
    }
  };

  const agree = async () => {
    const token = getAuthToken();
    if (!token || !selected) return;
    setAgreementSaving(true);
    setError("");
    const response = await fetch(`/api/offers/${selected.offerId}/agreement`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json() as { deal?: { insufficientCredits?: boolean; commissionCents?: number; carrierBalanceCents?: number }; error?: string; requiredCents?: number; balanceCents?: number };
    setAgreementSaving(false);
    if (!response.ok) {
      const missing = Math.max(0, Number(payload.requiredCents || 0) - Number(payload.balanceCents || 0));
      setError(response.status === 402 ? t("Add {amount} in credits to continue.", { amount: formatEuro(missing) }) : payload.error || t("Unable to update agreement"));
      return;
    }
    await loadConversations();
    if (payload.deal?.insufficientCredits && selected.role === "transporter") {
      const missing = Math.max(0, Number(payload.deal.commissionCents || 0) - Number(payload.deal.carrierBalanceCents || 0));
      setError(t("Add {amount} in credits to confirm this transport.", { amount: formatEuro(missing) }));
    }
  };

  const needsCarrierCredits = selected?.role === "transporter" && selected.status === "pending" && selected.carrierBalanceCents < selected.commissionCents;
  const agreementLabel = needsCarrierCredits
    ? t("Sufficient credits are required to chat and accept this transport.")
    : selected?.status === "confirmed"
    ? t("Transport agreed")
    : selected?.status === "rejected"
      ? t("Another carrier was selected")
      : selected?.role === "requester"
        ? selected?.selectedByCustomer
          ? selected.carrierAgreed ? t("Waiting for the carrier to add credits") : t("You are ready — waiting for the carrier")
          : selected?.carrierAgreed ? t("Carrier is ready") : t("Discuss the details, then choose this carrier when ready")
        : selected?.carrierAgreed
          ? selected.selectedByCustomer ? t("Add credits to complete the agreement") : t("You are ready — waiting for the customer")
          : selected?.selectedByCustomer ? t("Customer selected you") : t("Agree when the transport details are settled");
  const canAgree = !needsCarrierCredits && selected?.status === "pending" && (selected.role === "requester" ? !selected.selectedByCustomer : !selected.carrierAgreed);

  return <section className="messages-page">
    <header><h1>{t("Messages")}</h1></header>
    {error && <p className="transport-list-message error">{error}</p>}
    {!conversations.length ? <div className="empty-transports"><h2>{t("No conversations yet")}</h2><p>{t("A conversation opens as soon as a carrier sends an offer.")}</p></div> : <div className="messages">
      <aside>{conversations.map(conversation => <button className={`conversation ${selectedId === conversation.offerId ? "selected" : ""}`} onClick={() => setSelectedId(conversation.offerId)} key={conversation.offerId}><span className="avatar">{conversation.otherPartyName.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><b>{conversation.companyName || conversation.otherPartyName}</b><small>{conversation.status === "confirmed" ? t("Transport agreed") : conversation.selectedByCustomer ? t("Selected for transport") : conversation.lastMessage || conversation.itemName}</small></span></button>)}</aside>
      {selected && <article>
        <header><div><span className="avatar">{selected.otherPartyName.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><b>{selected.otherPartyName}</b><small>{selected.itemName}</small></span></div><span className="offer-tag"><OfferPrice priceCents={selected.priceCents} vatIncluded={selected.vatIncluded} /></span></header>
        <div className={`chat-context deal-context ${selected.status === "confirmed" ? "confirmed" : ""}`}><span><b>{agreementLabel}</b><small>{t("Available")}: {formatTransportDates(selected.availableDate, null, language)}</small></span>{canAgree && <button className="button moss short" disabled={agreementSaving} onClick={() => void agree()}>{agreementSaving ? t("Saving…") : t(selected.role === "requester" ? "Choose this carrier" : "Agree to transport")}</button>}{needsCarrierCredits && <Link className="button moss short" to="/carrier/credits">{t("Add credits")}</Link>}</div>
        <div className="thread">{selected.offerMessage && <p className={`bubble ${selected.role === "transporter" ? "mine" : "theirs"}`}>{selected.offerMessage}</p>}{messages.map(message => <p className={`bubble ${message.senderId === userId ? "mine" : "theirs"}`} key={message.id}>{message.body}</p>)}{selected.status === "confirmed" && <div className="contact-note contact-revealed"><b>{t("Contact details unlocked")}</b>{selected.otherPartyPhone && <a href={`tel:${selected.otherPartyPhone}`}>{selected.otherPartyPhone}</a>}{selected.otherPartyEmail && <a href={`mailto:${selected.otherPartyEmail}`}>{selected.otherPartyEmail}</a>}</div>}</div>
        {selected.status === "rejected" ? <p className="conversation-closed">{t("This conversation is read-only because another carrier was confirmed.")}</p> : needsCarrierCredits ? <div className="conversation-credit-lock"><span>{t("Sufficient credits are required to chat and accept this transport.")}</span><Link className="button moss short" to="/carrier/credits">{t("Add credits")}</Link></div> : <form noValidate onSubmit={submit}><input value={note} onChange={event => setNote(event.target.value)} placeholder={t("Write a message")} /><button aria-label={t("Send")}>↑</button></form>}
      </article>}
    </div>}
  </section>;
}
function PrivacyControls() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/privacy/export", { cache: "no-store" });
      if (!response.ok) throw new Error(t("Unable to export your data"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vanscout-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : t("Unable to export your data")); }
    finally { setBusy(false); }
  };
  const erase = async () => {
    const confirmation = window.prompt(t("Type DELETE MY ACCOUNT to permanently delete your account and associated data."));
    if (confirmation !== "DELETE MY ACCOUNT" || !window.confirm(t("This cannot be undone. Continue?"))) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/privacy/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      if (!response.ok) throw new Error(t("Unable to delete your account"));
      clearAuthSession();
      nav("/", { replace: true });
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : t("Unable to delete your account")); setBusy(false); }
  };
  return <section className="privacy-controls"><h2>{t("Privacy and your data")}</h2><p>{t("Download a copy of your VanScout data or permanently delete your account.")}</p>{error && <p className="auth-message error" role="alert">{error}</p>}<div><button className="button dark short" type="button" disabled={busy} onClick={() => void download()}>{t("Download my data")}</button><button className="button danger short" type="button" disabled={busy} onClick={() => void erase()}>{t("Delete my account")}</button></div></section>;
}

function CustomerProfile() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<{ name: string; email: string; phoneNumber: string | null } | null>(null);
  useEffect(() => {
    void fetch("/api/me/profile", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      const payload = await response.json() as { data?: { profile?: { name: string; email: string; phoneNumber: string | null } } };
      setProfile(payload.data?.profile || null);
    }).catch(() => setProfile(null));
  }, []);
  const initials = profile?.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "";
  return <section className="profile-page"><p className="eyebrow">{t("Account")}</p><h1>{t("Your profile")}</h1><div className="profile-head"><span className="avatar customer large">{initials}</span><div><h2>{profile?.name || "—"}</h2><p>{profile ? `${profile.email}${profile.phoneNumber ? ` · ${profile.phoneNumber}` : ""}` : t("Loading profile…")}</p></div></div><PrivacyControls /></section>;
}
function Review({ onDone }: { onDone: () => void }) { const { t } = useLanguage(); const [rating, setRating] = useState(5); return <section className="review"><p className="eyebrow">{t("Transport complete")}</p><h1>{t("How did it go?")}</h1><div className="profile-head"><Avatar large /><div><h2>Mario M.</h2><p>{t("Bed slats")} · IKEA Zagreb → Trešnjevka</p></div></div><div className="stars">{[1,2,3,4,5].map(n => <button className={n <= rating ? "on" : ""} onClick={() => setRating(n)} key={n}>★</button>)}</div><div className="tags">{["On time", "Great communication", "Careful handling", "Friendly"].map(x => <button key={x}>{t(x)}</button>)}</div><label><textarea placeholder={t("Add a short comment (optional)")} /></label><button className="button moss" onClick={onDone}>{t("Submit review")}</button></section>; }
export function Tracking() { const { t } = useLanguage(); return <div className="tracking"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /><span>{t("Private delivery tracking")}</span></div></header><main><p className="eyebrow">{t("Bed slats")} · 12 km</p><h1>{t("Your delivery is on the way.")}</h1><div className="tracking-map"><RouteLine /><i>●</i><b className="map-pickup">{t("From")}: IKEA Zagreb</b><b className="map-delivery">{t("To")}: Trešnjevka</b></div><section className="eta"><div><Avatar /><span><b>Mario M.</b><small>Renault Master</small></span></div><div><span>{t("Estimated arrival")}</span><b>18:42</b></div></section><div className="transport-steps tracking-list"><div className="done"><b>✓</b><span><strong>{t("Picked up")}</strong><small>{t("17:28 — Mario has your item.")}</small></span></div><div className="active"><b>●</b><span><strong>{t("In transit")}</strong><small>{t("18:04 — Heavy traffic. ETA updated by 12 minutes.")}</small></span></div><div><b>○</b><span><strong>{t("Delivered")}</strong><small>{t("We’ll let you know when it arrives.")}</small></span></div></div></main></div>; }
function JobCard({ onOpen, compact = false }: { onOpen: () => void; compact?: boolean }) { const { t } = useLanguage(); return <article className={`job ${compact ? "compact" : ""}`}><ItemImage /><div><h3>{t("Bed slats")}</h3><p>IKEA Zagreb <i>→</i> Trešnjevka</p><span>12 km</span><span>{t("Flexible")}</span><span>{t("No loading help required")}</span></div>{!compact && <b>3 {t("offers")}</b>}<button className="button dark short" onClick={onOpen}>{t("View job")}</button></article>; }
export function CarrierWorkspace() {
  const loc = useLocation();
  const nav = useNavigate();
  const derive = () => loc.pathname.includes("offers") ? "offers" : loc.pathname.includes("active") ? "active" : loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("credits") ? "credits" : loc.pathname.includes("profile") ? "profile" : "jobs";
  const [view, setView] = useState(derive());
  const [selected, setSelected] = useState<MarketplaceTransport | null>(null);
  const [makingOffer, setMakingOffer] = useState(false);
  useEffect(() => { setView(derive()); setSelected(null); setMakingOffer(false); }, [loc.pathname]);
  const go = (next: string, offerId?: string) => { setView(next); nav(next === "jobs" ? "/carrier" : `/carrier/${next}${offerId ? `?offer=${offerId}` : ""}`); };
  return <div className="app"><Topbar kind="carrier" active={view} /><main className="workspace">{view === "jobs" && !selected && <CarrierJobs onOpen={setSelected} />}{view === "jobs" && selected && !makingOffer && <RealJobDetail request={selected} onBack={() => setSelected(null)} onOffer={() => setMakingOffer(true)} />}{view === "jobs" && selected && makingOffer && <RealMakeOffer request={selected} onBack={() => setMakingOffer(false)} onSent={offerId => go("messages", offerId)} />}{view === "offers" && <RealCarrierOffers onOpenChat={offerId => go("messages", offerId)} />}{view === "active" && <RealCarrierOffers confirmedOnly onOpenChat={offerId => go("messages", offerId)} />}{view === "messages" && <LiveMessages />}{view === "credits" && <Wallet />}{view === "profile" && <CarrierProfileEditor />}</main></div>;
}

function CarrierJobs({ onOpen }: { onOpen: (request: MarketplaceTransport) => void }) {
  const { language, t } = useLanguage();
  const [transports, setTransports] = useState<MarketplaceTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void fetch("/api/marketplace/transports", { headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      const payload = await response.json() as { transports?: MarketplaceTransport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to load transports"));
      setTransports(payload.transports || []);
    }).catch(loadError => setError(loadError instanceof Error ? loadError.message : t("Unable to load transports"))).finally(() => setLoading(false));
  }, [t]);
  return <section className="jobs"><div className="workspace-title"><div><h1>{t("Available transports")}</h1></div></div>{loading ? <p className="transport-list-message">{t("Loading transports…")}</p> : error ? <p className="transport-list-message error">{error}</p> : transports.length ? transports.map(request => <article className="job" key={request.id}><TransportImage request={request} /><div><h3>{request.itemName}</h3><TransportRoute from={request.pickup.formatted} to={request.delivery.formatted} short /><span>{request.distanceKm} km</span><span>{request.preferredDateFrom ? formatTransportDates(request.preferredDateFrom, request.preferredDateTo, language) : t(request.timing)}</span><span>{formatTransportMeasurements(request, language, true)}</span><span className={`status request-status ${transportStatusClass(request.status, request.preferredDateFrom, request.preferredDateTo)}`}>{t(transportStatusLabel(request.status, request.preferredDateFrom, request.preferredDateTo))}</span></div><b>{request.offerCount} {t("offers")}</b><button className="button dark short" onClick={() => onOpen(request)}>{request.myOffer ? t("View offer") : t("View job")}</button></article>) : <div className="empty-transports"><h2>{t("No available transports")}</h2><p>{t("New customer requests will appear here.")}</p></div>}</section>;
}

function RealJobDetail({ request, onBack, onOffer }: { request: MarketplaceTransport; onBack: () => void; onOffer: () => void }) {
  const { t } = useLanguage();
  return <section className="job-detail"><div className="job-detail-actions"><button className="back detail-back" onClick={onBack}><span aria-hidden="true">←</span><span>{t("Available transports")}</span></button>{request.myOffer && <button className="edit-offer-quick" onClick={onOffer}><span>{t("Edit offer")}</span><OfferPrice priceCents={request.myOffer.priceCents} vatIncluded={request.myOffer.vatIncluded} className="compact" /></button>}</div><TransportDetailHeader request={request} /><div className={`job-layout ${request.myOffer ? "single-column" : ""}`}><div><TransportDetails request={request} customerName={request.requesterName} /></div>{!request.myOffer && <aside className="job-offer-card"><h2>{t("Make a clear offer.")}</h2><p>{t("Tell the customer your price and when you can do it.")}</p><button className="button moss full" onClick={onOffer}>{t("Make an offer")} <Arrow /></button></aside>}</div>{!request.myOffer && <button className="button moss mobile-sticky" onClick={onOffer}>{t("Make an offer")}</button>}</section>;
}

function RealMakeOffer({ request, onBack, onSent }: { request: MarketplaceTransport; onBack: () => void; onSent: (offerId: string) => void }) {
  const { t } = useLanguage();
  const initialVatIncluded = request.myOffer?.vatIncluded ?? true;
  const initialEnteredPriceCents = request.myOffer
    ? initialVatIncluded ? request.myOffer.priceCents : offerPriceFromTotal(request.myOffer.priceCents).netCents
    : null;
  const [price, setPrice] = useState(initialEnteredPriceCents === null ? "" : String(initialEnteredPriceCents / 100));
  const [vatIncluded, setVatIncluded] = useState(initialVatIncluded);
  const [date, setDate] = useState(request.myOffer?.availableDate || request.preferredDateFrom || "");
  const [message, setMessage] = useState(request.myOffer?.message || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditBalanceCents, setCreditBalanceCents] = useState<number | null>(null);
  const enteredPriceCents = Math.round(Number(price.replace(",", ".")) * 100);
  const priceBreakdown = Number.isFinite(enteredPriceCents) && enteredPriceCents > 0 ? offerPriceFromEnteredAmount(enteredPriceCents, vatIncluded) : null;
  const requiredCreditsCents = priceBreakdown ? Math.ceil(priceBreakdown.totalCents * 0.05) : 0;
  const missingCreditsCents = Math.max(0, requiredCreditsCents - (creditBalanceCents ?? 0));
  const hasSufficientCredits = creditBalanceCents !== null && requiredCreditsCents > 0 && missingCreditsCents === 0;
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void fetch("/api/credits", { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json() as { account?: CreditAccount; error?: string };
        if (!response.ok || !payload.account) throw new Error(payload.error || t("Unable to load credits"));
        setCreditBalanceCents(payload.account.balanceCents);
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t("Unable to load credits")));
  }, [t]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token || !priceBreakdown || !date) { setError(t("Enter a valid price and date")); return; }
    if (!hasSufficientCredits) { setError(t("Add {amount} in credits to continue.", { amount: formatEuro(missingCreditsCents) })); return; }
    setSaving(true); setError("");
    const response = await fetch(`/api/transports/${request.id}/offers`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ priceCents: priceBreakdown.totalCents, vatIncluded, availableDate: date, message }) });
    const payload = await response.json() as { offer?: TransportOffer; error?: string; requiredCents?: number; balanceCents?: number };
    setSaving(false);
    if (!response.ok) {
      const missing = Math.max(0, Number(payload.requiredCents || 0) - Number(payload.balanceCents || 0));
      setError(response.status === 402 ? t("Add {amount} in credits to continue.", { amount: formatEuro(missing) }) : payload.error || t("Unable to save offer"));
      return;
    }
    if (payload.offer) onSent(payload.offer.id);
  };
  return <section className="make-offer"><button className="back detail-back" onClick={onBack}><span aria-hidden="true">←</span><span>{t("Job details")}</span></button><h1>{t("Your offer")}</h1><form noValidate onSubmit={submit}><label>{t("Price")}<span className="price-input">€<input inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder="0.00" required /></span></label><fieldset className="vat-selection"><legend>{t("VAT treatment")}</legend><label><input type="radio" name="vat-treatment" checked={vatIncluded} onChange={() => setVatIncluded(true)} />{t("VAT included")}</label><label><input type="radio" name="vat-treatment" checked={!vatIncluded} onChange={() => setVatIncluded(false)} />{t("+ VAT")}</label></fieldset>{priceBreakdown && <div className="offer-price-preview"><span>{t("Price the customer pays")}</span><OfferPrice priceCents={priceBreakdown.totalCents} vatIncluded={vatIncluded} /></div>}{requiredCreditsCents > 0 && !hasSufficientCredits && <div className="offer-credit-requirement"><span>{t("Add {amount} in credits to continue.", { amount: formatEuro(missingCreditsCents) })}</span><Link className="button dark short" to="/carrier/credits">{t("Add credits")}</Link></div>}<label>{t("Available date")}<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} required /></label><label>{t("Message")} <em>{t("Optional")}</em><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder={t("Tell the customer anything useful about your offer.")} /></label>{error && <p className="transport-list-message error">{error}</p>}<button className="button moss full" disabled={saving || !hasSufficientCredits}>{saving ? t("Sending…") : t(request.myOffer ? "Update offer" : "Send offer")} <Arrow /></button></form></section>;
}

type CarrierOfferRow = TransportOffer & { itemName: string; pickup: string; delivery: string; requesterName: string; transportStatus: TransportStatus; preferredDateFrom: string | null; preferredDateTo: string | null };
function RealCarrierOffers({ confirmedOnly = false, onOpenChat }: { confirmedOnly?: boolean; onOpenChat?: (offerId: string) => void }) {
  const { language, t } = useLanguage();
  const [offers, setOffers] = useState<CarrierOfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void fetch(`/api/offers${confirmedOnly ? "?status=confirmed" : ""}`, { headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      const payload = await response.json() as { offers?: CarrierOfferRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to load offers"));
      setOffers(payload.offers || []);
    }).catch(loadError => setError(loadError instanceof Error ? loadError.message : t("Unable to load offers"))).finally(() => setLoading(false));
  }, [confirmedOnly, t]);
  return <section className="my-offers"><div className="workspace-title"><div><h1>{t(confirmedOnly ? "Active transports" : "My offers")}</h1></div></div>{loading ? <p className="transport-list-message">{t("Loading offers…")}</p> : error ? <p className="transport-list-message error">{error}</p> : offers.length ? offers.map(offer => <article key={offer.id}><ItemImage label={offer.itemName} /><div><h3>{offer.itemName}</h3><TransportRoute from={offer.pickup} to={offer.delivery} short /><small>{offer.requesterName} · {formatTransportDates(offer.availableDate, null, language)}</small></div><OfferPrice priceCents={offer.priceCents} vatIncluded={offer.vatIncluded} className="carrier-offer-price" /><span className={`status ${transportStatusClass(offer.transportStatus, offer.preferredDateFrom, offer.preferredDateTo)}`}>{t(transportStatusLabel(offer.transportStatus, offer.preferredDateFrom, offer.preferredDateTo))}</span>{onOpenChat && <button className="button dark short" onClick={() => onOpenChat(offer.id)}>{t("Open chat")}</button>}</article>) : <div className="empty-transports"><h2>{t(confirmedOnly ? "No active transports" : "No offers yet")}</h2><p>{t(confirmedOnly ? "Mutually agreed transports will appear here." : "Offers you send to customers will appear here.")}</p></div>}</section>;
}

function CarrierProfileEditor() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<CarrierProfileData | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void fetch("/api/carrier-profile", { headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      const payload = await response.json() as { profile?: CarrierProfileData; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error || t("Unable to load profile"));
      setProfile(payload.profile);
      setCompanyName(payload.profile.companyName);
      setBio(payload.profile.bio);
      setImageIds(payload.profile.imageIds);
    }).catch(loadError => setError(loadError instanceof Error ? loadError.message : t("Unable to load profile")));
  }, [t]);
  const imageCount = imageIds.length + files.length;
  const remainingImageSlots = Math.max(0, 3 - imageCount);
  const addImages = (selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(file => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024);
    const imagesToAdd = validFiles.slice(0, remainingImageSlots);
    if (imagesToAdd.length) setFiles(current => [...current, ...imagesToAdd]);
    setMessage("");
    if (validFiles.length !== selectedFiles.length) {
      setError(t("Choose image files up to 10 MB each"));
    } else if (validFiles.length > remainingImageSlots) {
      setError(t("You can add up to 3 business images"));
    } else {
      setError("");
    }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) return;
    if (!companyName.trim()) {
      setMessage("");
      setError(t("Enter your company name"));
      return;
    }
    const form = new FormData();
    form.set("companyName", companyName.trim()); form.set("bio", bio.trim());
    if (profileImage) form.set("profileImage", profileImage);
    const galleryChanged = files.length > 0 || imageIds.join(",") !== (profile?.imageIds || []).join(",");
    if (galleryChanged) {
      form.set("galleryChanged", "true");
      imageIds.forEach(id => form.append("retainedImageIds", id));
      files.forEach(file => form.append("images", file));
    }
    const response = await fetch("/api/carrier-profile", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form });
    const payload = await response.json() as { profile?: CarrierProfileData; error?: string };
    if (!response.ok || !payload.profile) { setError(payload.error || t("Unable to save profile")); return; }
    setProfile(payload.profile);
    setProfileImage(null);
    setImageIds(payload.profile.imageIds);
    setFiles([]);
    setError("");
    setMessage(t("Profile saved"));
  };
  const initials = profile?.carrierName.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "";
  return <section className="carrier-profile real-carrier-profile"><div className="profile-head"><label className="profile-photo-control"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event => { setProfileImage(event.target.files?.[0] || null); event.target.value = ""; }} /><span className="avatar large">{profileImage ? <FilePreview className="profile-photo" file={profileImage} alt={profile?.carrierName || ""} /> : profile?.profileImageId ? <PrivateImage className="profile-photo" src={`/api/carrier-profile/images/${profile.profileImageId}`} alt={profile.carrierName} /> : initials}</span><span className="profile-photo-action">{t("Change photo")}</span></label><div><h1>{profile?.carrierName || t("Your profile")}</h1><p>{profile?.completedTransports || 0} {t("completed transports")}</p></div></div><form noValidate onSubmit={save}><label>{t("Company name")}<input value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={t("e.g. Fast Van Zagreb")} maxLength={150} required /><span className="field-hint">{t("This name appears on your offers and in customer chats.")}</span></label><label>{t("About your business")}<textarea value={bio} onChange={event => setBio(event.target.value)} placeholder={t("Describe your service area, vehicle, availability, and what customers can expect.")} maxLength={1500} /><span className="field-hint">{t("A short, specific introduction helps customers choose with confidence.")}</span></label><div className="business-images-field"><div className="business-images-heading"><strong>{t("Business images")}</strong><span className="field-hint">{t("Up to 3 images, 10 MB each")} · {t("{count} of 3 images added", { count: imageCount })}</span></div>{remainingImageSlots > 0 && <label className="business-image-picker"><input type="file" accept="image/*" multiple onChange={event => { addImages(Array.from(event.target.files || [])); event.target.value = ""; }} /><span>＋ {t("Add image")}</span></label>}</div>{imageCount > 0 && <div className="carrier-image-grid">{imageIds.map(id => <figure key={id}><PrivateImage src={`/api/carrier-profile/images/${id}`} alt={companyName} /><button type="button" aria-label={t("Remove business image")} title={t("Remove business image")} onClick={() => { setImageIds(current => current.filter(imageId => imageId !== id)); setError(""); setMessage(""); }}>×</button></figure>)}{files.map((file, index) => <figure key={`${file.name}-${file.lastModified}-${index}`}><FilePreview file={file} alt={companyName} /><button type="button" aria-label={t("Remove business image")} title={t("Remove business image")} onClick={() => { setFiles(current => current.filter((_, fileIndex) => fileIndex !== index)); setError(""); setMessage(""); }}>×</button></figure>)}</div>}{error && <p className="transport-list-message error">{error}</p>}{message && <p className="auth-message success">{message}</p>}<button className="button moss" type="submit">{t("Save profile")}</button></form><PrivacyControls /></section>;
}
function JobDetail({ onBack, onOffer }: { onBack: () => void; onOffer: () => void }) { const { t } = useLanguage(); return <section className="job-detail"><button className="back" onClick={onBack}>← {t("Available transports")}</button><header><div><p className="eyebrow">{t("Furniture")} · {t("Flexible")}</p><h1>{t("Bed slats")}</h1><p>IKEA Zagreb <i>→</i> Trešnjevka</p></div><b>12 km</b></header><div className="job-layout"><div><div className="detail-map"><RouteLine /><span>IKEA Zagreb</span><span>Trešnjevka</span></div><section><h2>{t("What you’re moving")}</h2><p>{t("Bed slats, already packed. No loading help required.")}</p><div className="photo-row"><ItemImage type="photo" /><ItemImage type="photo" /></div></section><section className="info-split"><div><span>{t("Pickup")}</span><b>{t("Flexible · Ground floor")}</b></div><div><span>{t("Delivery")}</span><b>{t("Trešnjevka · Elevator available")}</b></div></section></div><aside><p className="eyebrow">{t("Interested")}</p><h2>{t("Make a clear offer.")}</h2><p>{t("Tell the customer your price and when you can do it.")}</p><button className="button moss full" onClick={onOffer}>{t("Make an offer")} <Arrow /></button></aside></div><button className="button moss mobile-sticky" onClick={onOffer}>{t("Make an offer")}</button></section>; }
function MakeOffer({ onBack, onSend }: { onBack: () => void; onSend: () => void }) { const { t } = useLanguage(); return <section className="make-offer"><button className="back" onClick={onBack}>← {t("Job details")}</button><p className="eyebrow">{t("Bed slats")} · IKEA Zagreb → Trešnjevka</p><h1>{t("Your offer")}</h1><div><label className="price-input">€<input defaultValue="32" /></label><Picker label={t("Pickup availability")} defaultValue="today" options={[{ value: "today", label: <>{t("Today")}, 17:00–19:00</> }, { value: "tomorrow", label: t("Tomorrow, 10:00–12:00") }]} ariaLabel={t("Pickup availability")} /><Picker label={t("Delivery estimate")} defaultValue="45" options={[{ value: "45", label: t("Within 45 minutes of pickup") }, { value: "60", label: t("Within 1 hour of pickup") }]} ariaLabel={t("Delivery estimate")} /><Picker label={t("Vehicle")} defaultValue="master" options={[{ value: "master", label: <>Renault Master · {t("Large van")}</> }]} ariaLabel={t("Vehicle")} /><label>{t("Message")} <em>{t("Optional")}</em><textarea defaultValue={t("I’m already driving through this area tomorrow afternoon.")} /></label><button className="button moss full" onClick={onSend}>{t("Send offer")} <Arrow /></button></div></section>; }
function MyOffers({ onOpen }: { onOpen: () => void }) { const { t } = useLanguage(); return <section className="my-offers"><div className="workspace-title"><div><p className="eyebrow">{t("Keep an eye on it")}</p><h1>{t("My offers")}</h1></div><div className="tabs"><button className="selected">{t("Pending")}</button><button>{t("Accepted")}</button><button>{t("Past")}</button></div></div><article><ItemImage /><div><h3>{t("Bed slats")}</h3><p>IKEA Zagreb → Trešnjevka</p></div><strong>€32</strong><span className="status">{t("Waiting for customer")}</span><button className="button dark short" onClick={onOpen}>{t("Open")}</button></article></section>; }
function ActiveDelivery({ stage, onNext, share, onShare }: { stage: number; onNext: () => void; share: boolean; onShare: () => void }) { const { t } = useLanguage(); const title = ["Heading to pickup", "At pickup", "Item collected", "On the way"][stage]; const action = ["I’ve arrived", "Item collected", "Start delivery", "Mark as delivered"][stage]; return <section className="active-delivery"><p className="eyebrow">{t("Active transport")}</p><h1>{t(title)}</h1><div className="active-meta"><div><span>{t("Customer")}</span><b>Ana Novak</b><a href="tel:+385915552400">+385 91 555 2400</a></div><div><span>{t("Route")}</span><b>IKEA Zagreb → Trešnjevka</b><button>{t("Open navigation")}</button></div></div><div className="active-map"><RouteLine /><i>●</i></div><div className="share"><div><b>{t("Share live location with customer")}</b><p>{t("Your customer will receive a private tracking link until delivery is completed.")}</p></div><button className={share ? "switch on" : "switch"} onClick={onShare}><span /></button></div><div className="update-buttons">{["Traffic", "Pickup delay", "Customer unavailable", "Other"].map(x => <button key={x}>{t(x)}</button>)}</div><button className="button moss delivery-action" onClick={onNext}>{t(action)}</button></section>; }
function Wallet() {
  const { language, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [amount, setAmount] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const checkoutStatus = searchParams.get("checkout");
  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    const response = await fetch("/api/credits", { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json() as { account?: CreditAccount; error?: string };
    if (!response.ok || !payload.account) throw new Error(payload.error || t("Unable to load credits"));
    setAccount(payload.account);
    setError("");
  }, [t]);
  useEffect(() => {
    void load().catch(loadError => setError(loadError instanceof Error ? loadError.message : t("Unable to load credits"))).finally(() => setLoading(false));
  }, [load, t]);
  useEffect(() => {
    if (checkoutStatus !== "success") return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void load();
      if (attempts >= 10) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [checkoutStatus, load]);
  const checkout = async () => {
    const token = getAuthToken();
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!token || !Number.isFinite(amountCents) || amountCents < 500 || amountCents > 50_000) {
      setError(t("Choose an amount between €5 and €500"));
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/credits/checkout", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ amountCents }) });
    const payload = await response.json() as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setSaving(false);
      setError(payload.error || t("Unable to start checkout"));
      return;
    }
    window.location.assign(payload.url);
  };
  return <section className="wallet"><h1>{t("Balance")}</h1><strong>{loading ? "—" : formatEuro(account?.balanceCents || 0)}</strong><p className="credit-explanation">{t("When a transport is confirmed by both sides, 5% of its agreed price is deducted from your credits.")}</p>{checkoutStatus === "success" && <p className="auth-message success">{t("Payment completed. Your balance will update as soon as Stripe confirms it.")}</p>}{checkoutStatus === "cancelled" && <p className="auth-message">{t("Checkout was cancelled. No credits were added.")}</p>}{error && <p className="transport-list-message error">{error}</p>}<div className="checkout"><h2>{t("Add credits")}</h2><div><label>€<input type="number" inputMode="decimal" min="5" max="500" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} aria-label={t("Custom amount")} /></label></div><button type="button" className="button dark full" disabled={saving || !account?.stripeConfigured} onClick={() => void checkout()}>{saving ? t("Opening Stripe…") : `${t("Continue to Stripe")} · €${amount}`}</button>{!account?.stripeConfigured && !loading && <p className="field-hint">{t("Stripe needs to be configured before credits can be purchased.")}</p>}</div><article className="activity"><h2>{t("Recent activity")}</h2>{account?.transactions.length ? account.transactions.map(transaction => <div key={transaction.id}><span><b>{transaction.amountCents > 0 ? "+ " : "− "}{formatEuro(Math.abs(transaction.amountCents))}</b><small>{t(transaction.description)}</small></span><time>{new Intl.DateTimeFormat(language === "hr" ? "hr-HR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(transaction.createdAt))}</time></div>) : <p className="transport-list-message">{t("No credit activity yet")}</p>}</article></section>;
}
function CarrierProfile({ onVehicles }: { onVehicles: () => void }) { const { t } = useLanguage(); return <section className="carrier-profile"><div className="profile-head"><Avatar large /><div><p className="eyebrow">{t("Verified carrier")}</p><h1>Mario M.</h1><p>★ 4.9 · 127 {t("completed transports")}</p></div></div><p>{t("I’m an independent carrier in Zagreb. I care about being on time, communicating clearly, and delivering everything in the condition it left.")}</p><section><header><h2>{t("Vehicles")}</h2><button className="quiet-link" onClick={onVehicles}>{t("Manage")}</button></header><div className="vehicle">▰ <div><b>Renault Master</b><span>{t("Large Van")} · 3.2m {t("cargo length")} · 1,350kg {t("payload")}</span></div></div></section><section><h2>{t("Reviews")}</h2><blockquote>“{t("Mario was early, thoughtful and took great care with the furniture.")}”<footer>— Petra, {t("verified customer")}</footer></blockquote></section></section>; }
function Vehicles({ onBack }: { onBack: () => void }) { const { t } = useLanguage(); return <section className="vehicles"><button className="back" onClick={onBack}>← {t("Carrier profile")}</button><header><div><p className="eyebrow">{t("Your equipment")}</p><h1>{t("Vehicles")}</h1></div><button className="button dark short">{t("Add vehicle")}</button></header><div className="vehicle manager">▰ <div><b>Renault Master</b><span>{t("Large Van")}</span><small>3.2m {t("cargo length")} · 1.7m {t("width")} · 1,350kg {t("payload")}</small></div><p><button>{t("Edit")}</button><button className="danger">{t("Remove")}</button></p></div></section>; }
