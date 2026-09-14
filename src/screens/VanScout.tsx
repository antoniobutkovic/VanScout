import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, type Auth, type ConfirmationResult } from "firebase/auth";
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { IMAGES } from "../assets/images";
import { LanguagePicker, useLanguage } from "../i18n";
import { Picker } from "../components/Picker";
import { getFirebasePhoneAuth, type FirebasePhoneConfig } from "../lib/firebase-phone";

type Offer = { name: string; price: string; rating: string; jobs: string; vehicle: string; time: string; note: string; initials: string; tone: string };
type AuthRole = "requester" | "transporter";
const OFFERS: Offer[] = [
  { name: "Mario M.", price: "€32", rating: "4.9", jobs: "127 jobs", vehicle: "Renault Master", time: "Today, 17:00–19:00", note: "I’m already collecting another order near IKEA this afternoon.", initials: "MM", tone: "mario" },
  { name: "Luka P.", price: "€28", rating: "4.8", jobs: "81 jobs", vehicle: "Ford Transit", time: "Tomorrow, 10:00–12:00", note: "I can collect this on my morning route through Trešnjevka.", initials: "LP", tone: "luka" },
  { name: "Nikola R.", price: "€37", rating: "5.0", jobs: "42 jobs", vehicle: "Mercedes Sprinter", time: "Friday, 14:00–16:00", note: "Two-person pickup available if you need a hand with the load.", initials: "NR", tone: "nikola" },
];
const CATEGORIES = ["Furniture", "Appliances", "Store purchase", "Motorcycle", "Boxes / pallets", "Other"];
const WIZARD_STEPS = ["Item", "Photos", "Pickup", "Delivery", "Timing", "Details", "Review"];

function Arrow() { return null; }
function Mark() { return <Link className="brand" to="/">VanScout<span>.</span></Link>; }
function RouteLine({ small = false }: { small?: boolean }) { return <span className={`route-line ${small ? "small" : ""}`}><i /><b /><i /></span>; }
function Avatar({ offer, large = false }: { offer?: Offer; large?: boolean }) { const identity = offer ?? OFFERS[0]; return <span className={`avatar ${identity.tone} ${large ? "large" : ""}`}>{large && identity.name === "Mario M." ? <img src={IMAGES.CARRIER_DOT_PROFILE} alt={identity.name} /> : identity.initials}</span>; }
function PasswordControl(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return <span className="password-control"><input {...props} type={visible ? "text" : "password"} /><button type="button" className="password-toggle" aria-label={t(visible ? "Hide password" : "Show password")} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{t(visible ? "Hide" : "Show")}</button></span>;
}
function RoleIcon({ role }: { role: AuthRole }) { return role === "transporter" ? <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 9.5h15v12H4zM19 14h5l4 4v3.5h-9zM8 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM24 25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path d="M19 17.5h8M7 9.5V7h8" /></svg> : <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 10 12-5 12 5-12 5L4 10Z" /><path d="M7 12.5V21l9 4 9-4v-8.5M12 13.5v8M20 13.5v8" /></svg>; }
function RolePicker({ value, onChange }: { value: AuthRole; onChange: (value: AuthRole) => void }) { const { t } = useLanguage(); const options: { value: AuthRole; label: string }[] = [{ value: "requester", label: t("Requester") }, { value: "transporter", label: t("Transporter") }]; return <fieldset className="auth-role-picker"><legend className="picker-label">{t("Account type")}</legend><div className="role-picker-options" role="radiogroup" aria-label={t("Account type")}>{options.map(option => <button type="button" role="radio" aria-checked={value === option.value} className={`role-option ${value === option.value ? "selected" : ""}`} key={option.value} onClick={() => onChange(option.value)}><span className="role-option-icon"><RoleIcon role={option.value} /></span><span>{option.label}</span></button>)}</div></fieldset>; }
type AuthenticatedUser = { role: AuthRole; phoneVerified?: boolean };
type AuthConfig = {
  firebase?: ({ enabled: false; testMode: boolean } | ({ enabled: true } & FirebasePhoneConfig));
};

function firebasePhoneError(error: unknown, translate: (key: string) => string) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Enter a valid mobile number for the selected country",
    "auth/missing-phone-number": "Enter a valid mobile number for the selected country",
    "auth/invalid-verification-code": "The verification code is incorrect",
    "auth/code-expired": "The verification code has expired. Send a new code.",
    "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
    "auth/quota-exceeded": "The SMS verification limit has been reached. Please try again later.",
    "auth/captcha-check-failed": "The security check failed. Please try again.",
    "auth/invalid-app-credential": "The security check expired. Please try again.",
  };
  return translate(messages[code] || "Unable to verify phone number");
}

function GoogleSignInButton({ role, onAuthenticated }: { role?: AuthRole; onAuthenticated: (token: string, user: AuthenticatedUser) => void }) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const onAuthenticatedRef = useRef(onAuthenticated);

  useEffect(() => { onAuthenticatedRef.current = onAuthenticated; }, [onAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    const loadGoogleButton = async () => {
      try {
        const configResponse = await fetch("/api/auth/config");
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
          callback: async response => {
            setError("");
            setIsSigningIn(true);
            try {
              const authResponse = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: response.credential, ...(role ? { role } : {}) }),
              });
              const payload = await authResponse.json() as { token?: string; user?: AuthenticatedUser; error?: string };
              if (!authResponse.ok || !payload.token || !payload.user) throw new Error(payload.error || t("Google sign-in failed"));
              onAuthenticatedRef.current(payload.token, payload.user);
            } catch (authError) {
              setIsSigningIn(false);
              setError(authError instanceof Error ? authError.message : t("Google sign-in failed"));
            }
          },
        });
      } catch {
        // Keep the original Google button visible until the SDK is available.
      }
    };
    void loadGoogleButton();
    return () => { cancelled = true; };
  }, [role, t]);

  const handleGoogleClick = () => {
    setError("");
    setIsSigningIn(true);
    try {
      if (!window.google) {
        setIsSigningIn(false);
        return;
      }
      window.google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          setIsSigningIn(false);
        }
      });
    } catch {
      setIsSigningIn(false);
    }
  };

  return <div className="google-sign-in"><button type="button" className="google" disabled={isSigningIn} aria-busy={isSigningIn} onClick={handleGoogleClick}>G <span>{t("Continue with Google")}</span></button>{error && <p className="google-auth-error">{error}</p>}</div>;
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
  }} placeholder={t("91 234 5678")} /></div><small className="phone-format-help">{t("Enter the rest of your number without the country code. Spaces are added automatically.")}</small>{error && <span className="field-error" role="alert">{error}</span>}</div>;
}

function normalizedPhoneNumber(country: CountryCode, input: string, allowFictional: boolean) {
  const parsed = parsePhoneNumberFromString(input, country);
  const type = parsed?.getType();
  if (parsed?.isValid() && parsed.country === country && (!type || type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE")) {
    return parsed.number;
  }
  if (!allowFictional) return null;

  // Firebase test numbers may be syntactically valid E.164 values without
  // matching a real country's assigned mobile ranges (for example,
  // +38500000000). Preserve the exact digits so Firebase can match the
  // fictional number configured in its console.
  const digits = input.replace(/\D/g, "");
  const dialCode = getCountryCallingCode(country);
  const international = digits.startsWith(dialCode) ? digits : `${dialCode}${digits}`;
  const e164 = `+${international}`;
  return e164.startsWith(`+${dialCode}`) && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

function HeaderActions({ kind }: { kind?: "customer" | "carrier" }) {
  const { t } = useLanguage();
  return <div className="nav-actions">{kind ? <><button className="notice" aria-label={t("Notifications")}>◌</button><Link className="mini-avatar" to={kind === "carrier" ? "/carrier/profile" : "/customer/profile"}>{kind === "carrier" ? "MM" : "AN"}</Link>{kind === "customer" && <Link className="button dark short" to="/create-request">{t("New request")}</Link>}<LanguagePicker /></> : <><LanguagePicker /><Link className="sign-in" to="/auth">{t("Sign in")}</Link></>}</div>;
}
function Topbar({ kind, active }: { kind?: "customer" | "carrier"; active?: string }) {
  const { t } = useLanguage();
  const carrierLinks = [["jobs", "Find jobs", "/carrier"], ["offers", "My offers", "/carrier/offers"], ["active", "Active", "/carrier/active"], ["messages", "Messages", "/carrier/messages"], ["wallet", "Wallet", "/carrier/wallet"]];
  return <header className={`topbar ${kind ? "app-topbar" : ""}`}><Mark />{kind === "carrier" ? <nav>{carrierLinks.map(([key, label, href]) => <Link className={active === key ? "active" : ""} key={key} to={href}>{t(label)}</Link>)}</nav> : kind === "customer" ? <nav><Link className={active === "requests" ? "active" : ""} to="/customer">{t("Requests")}</Link><Link className={active === "messages" ? "active" : ""} to="/customer/messages">{t("Messages")}</Link></nav> : null}<HeaderActions kind={kind} /></header>;
}
function Footer() { const { t } = useLanguage(); return <footer className="footer"><div className="footer-brand"><Mark /><strong>Contact</strong><a href="mailto:info@van-scout.com">info@van-scout.com</a></div><div className="footer-legal"><strong>{t("Legal information")}</strong><Link to="/politika-privatnosti">{t("Privacy policy")}</Link><Link to="/politika-o-kolacicima">{t("Cookie policy")}</Link><Link to="/uvjeti-koristenja">{t("Terms of use")}</Link><Link to="/impressum">{t("Impressum")}</Link></div><small className="footer-copyright">{t("© 2026 VanScout. All rights reserved.")}</small></footer>; }
function ItemImage({ type = "bed" }: { type?: "bed" | "photo" }) { const { t } = useLanguage(); return <div className={`item-image ${type}`}><span>{type === "bed" ? <>{t("Bed")}<br />{t("slats")}</> : t("Photo")}</span></div>; }

type LegalDocument = "privacy" | "cookies" | "terms" | "impressum";
const LEGAL_DOCUMENTS: Record<LegalDocument, { title: string; introduction: string }> = {
  privacy: { title: "Privacy policy", introduction: "Privacy policy introduction" },
  cookies: { title: "Cookie policy", introduction: "Cookie policy introduction" },
  terms: { title: "Terms of use", introduction: "Terms of use introduction" },
  impressum: { title: "Impressum", introduction: "Impressum introduction" },
};

export function LegalPage({ document }: { document: LegalDocument }) {
  const { t } = useLanguage();
  const page = LEGAL_DOCUMENTS[document];
  return <div className="site"><Topbar /><main className="legal-page"><section className="legal-intro"><p className="eyebrow">{t("Legal information")}</p><h1>{t(page.title)}</h1><p>{t(page.introduction)}</p></section><section className="legal-content"><article><span>01</span><div><h2>{t(page.title)}</h2><p>{t("This page is being prepared")}</p></div></article><article><span>02</span><div><h2>{t("Contact")}</h2><p><a href="mailto:hello@vanscout.example">hello@vanscout.example</a></p></div></article></section></main><Footer /></div>;
}

export function Home() {
  const { t } = useLanguage(); const workflows = [{ audience: "For requesters", steps: [["01", "Describe the item and route", "Add the details carriers need to make a clear offer."], ["02", "Compare offers", "Review price, vehicle and availability in one place."], ["03", "Book with confidence", "Choose the carrier that fits and follow the transport to delivery."]] }, { audience: "For carriers", steps: [["01", "Find a job that fits", "Browse routes, items and timing before you make an offer."], ["02", "Make a clear offer.", "Set your price and availability in minutes."], ["03", "Complete the transport", "Keep the customer updated, then build your review history."]] }];
  return <div className="site"><Topbar /><main><section className="home-hero"><div className="home-copy"><h1>{t("Request or offer transport services without the hassle.")}</h1><div className="actions"><Link className="button moss" to="/create-request">{t("Request transport")} <Arrow /></Link><Link className="quiet-link" to="/auth?role=transporter">{t("I'm a carrier")}</Link></div></div><div className="hero-image"><img src={IMAGES.HOME_DOT_HERO} alt={t("Furniture and boxes being loaded into a cargo van.")} /><div className="hero-sticker"><span>{t("Today")}</span><RouteLine small /><b>IKEA Zagreb → Trešnjevka</b></div></div></section><section className="steps"><div className="workflow-rows">{workflows.map(({ audience, steps }) => <section className="workflow-row" key={audience}><h2>{t(audience)}</h2><div>{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{t(title)}</h3><p>{t(copy)}</p></article>)}</div></section>)}</div></section><section className="trust"><div><h2>{t("Choose with confidence.")}</h2></div><ul><li>{t("Verified phone numbers")}</li><li>{t("Carrier profiles and vehicles")}</li><li>{t("Real reviews after every job")}</li></ul></section></main><Footer /></div>;
}

export function CreateRequest() { const { t } = useLanguage(); const nav = useNavigate(); const [step, setStep] = useState(0); const [category, setCategory] = useState("Furniture"); const [timing, setTiming] = useState("I’m flexible"); const [expanded, setExpanded] = useState(""); const next = () => step === 6 ? nav("/auth") : setStep(step + 1); return <div className="wizard"><header><Mark /><div className="wizard-header-actions"><span>{step + 1} / 7</span><LanguagePicker /><Link to="/">×</Link></div></header><div className="wizard-progress"><b style={{ width: `${(step + 1) * 14.285}%` }} />{WIZARD_STEPS.map((label, index) => <span className={index === step ? "current" : ""} key={label}>{t(label)}</span>)}</div><main>{step === 0 && <section><p className="eyebrow">{t("Start with the thing")}</p><h1>{t("What are you moving?")}</h1><div className="choices">{CATEGORIES.map(item => <button className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{t(item)}</button>)}</div><label>{t("Item name")}<input defaultValue={t("Bed slats")} /></label><label>{t("Description")} <em>{t("Optional")}</em><textarea placeholder={t("Anything carriers should know about the item?")} /></label><button className="expand" onClick={() => setExpanded(expanded === "size" ? "" : "size")}>{expanded === "size" ? t("− Hide dimensions") : t("+ Add dimensions")}</button>{expanded === "size" && <div className="inline-inputs"><label>{t("Length")}<input placeholder="cm" /></label><label>{t("Width")}<input placeholder="cm" /></label><label>{t("Weight")}<input placeholder="kg" /></label></div>}</section>}{step === 1 && <section className="visual-step"><p className="eyebrow">{t("A better offer starts here")}</p><h1>{t("Show carriers what they’re moving.")}</h1><div className="drop"><b>＋</b><strong>{t("Drop photos here")}</strong><span>{t("or choose from your device")}</span><button className="button dark short">{t("Choose photos")}</button></div><p className="help">{t("Photos help carriers give you a more accurate price.")}</p></section>}{step === 2 && <AddressStep label={t("Where should it be picked up?")} value="IKEA Zagreb" kind="pickup" expanded={expanded === "pickup"} onExpand={() => setExpanded(expanded === "pickup" ? "" : "pickup")} />}{step === 3 && <AddressStep label={t("Where is it going?")} value="Trešnjevka, Zagreb" kind="delivery" expanded={expanded === "delivery"} onExpand={() => setExpanded(expanded === "delivery" ? "" : "delivery")} />}{step === 4 && <section><p className="eyebrow">{t("Make it work for you")}</p><h1>{t("When should it be moved?")}</h1><div className="timing">{["As soon as possible", "Choose a date", "I’m flexible"].map(item => <button className={timing === item ? "selected" : ""} key={item} onClick={() => setTiming(item)}><b>{t(item)}</b>{item === "I’m flexible" && <span>{t("Flexible jobs can often receive cheaper offers because carriers can combine them with existing routes.")}</span>}</button>)}</div>{timing === "Choose a date" && <label>{t("Preferred date")}<input type="date" /></label>}</section>}{step === 5 && <section><p className="eyebrow">{t("Last details")}</p><h1>{t("Anything else carriers should know?")}</h1><div className="tags">{["Needs two people", "Heavy item", "Already packed", "Store pickup", "Fragile"].map(tag => <button key={tag}>{t(tag)}</button>)}</div><label><textarea className="large-textarea" placeholder={t("Add a note (optional)")} /></label></section>}{step === 6 && <section className="review-request"><p className="eyebrow">{t("One more look")}</p><h1>{t("Ready to publish?")}</h1><article><ItemImage /><div><span>{t("Furniture")}</span><h2>{t("Bed slats")}</h2><p>IKEA Zagreb <i>→</i> Trešnjevka</p><small>12 km · {t(timing)} · {t("No loading help required")}</small></div><button>{t("Edit")}</button></article></section>}</main><footer><button className="button ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>{t("Back")}</button><button className="button dark" onClick={next}>{t(step === 6 ? "Publish request" : "Continue")} <Arrow /></button></footer></div>; }

function AddressStep({ label, value, kind, expanded, onExpand }: { label: string; value: string; kind: "pickup" | "delivery"; expanded: boolean; onExpand: () => void }) { const { t } = useLanguage(); const isPickup = kind === "pickup"; const kindLabel = t(kind); return <section><p className="eyebrow">{t(isPickup ? "First stop" : "Last stop")}</p><h1>{label}</h1><label className="address-input">{t(isPickup ? "Pickup location" : "Delivery location")}<input defaultValue={value} /></label>{isPickup ? <div className="map"><span>IKEA Zagreb</span><i>{t("Pickup")}</i></div> : <div className="route-summary"><span>IKEA Zagreb</span><RouteLine /><span>Trešnjevka</span><b>12 km</b></div>}<button className="expand" onClick={onExpand}>{expanded ? t("Hide {kind} details", { kind: kindLabel }) : t("Add {kind} details", { kind: kindLabel })}</button>{expanded && <div className="details"><Picker label={t("Floor")} defaultValue="ground" options={[{ value: "ground", label: t("Ground floor") }, { value: "first", label: t("1st floor") }, { value: "upper", label: t("2nd floor+") }]} ariaLabel={t("Floor")} /><label><input type="checkbox" /> {t("Elevator available")}</label><label><input type="checkbox" /> {t("Help needed")}</label><label>{t("Instructions")}<textarea placeholder={t("Parking, access, entrance…")} /></label></div>}</section>; }
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
    setAuthError("");
    setMessage("");
  }, [requestedMode, verificationEmail]);

  const validatePasswords = () => {
    if (stage !== "profile") return true;
    const nextPasswordError = password.length < 8 ? t("Password must be at least 8 characters") : "";
    const nextConfirmationError = password !== passwordConfirmation ? t("Passwords do not match") : "";
    setPasswordError(nextPasswordError);
    setPasswordConfirmationError(nextConfirmationError);
    return !nextPasswordError && !nextConfirmationError;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validatePasswords()) return;
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
          setMessage(t("We sent a new six-digit code to your email."));
          return;
        }
        throw new Error(payload.error || t(stage === "profile" ? "Unable to create account" : "Unable to sign in"));
      }
      if (stage === "profile") {
        setEmail(payload.email || email);
        setStage("email-code");
        setMessage(t("We sent a six-digit code to your email."));
        return;
      }
      if (!payload.token || !payload.user) throw new Error(t("Unable to sign in"));
      window.localStorage.setItem("auth_token", payload.token);
      setRole(payload.user.role);
      if (!payload.user.phoneVerified) {
        setStage("phone");
        return;
      }
      nav(payload.user.role === "transporter" ? "/carrier" : "/customer");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t(stage === "profile" ? "Unable to create account" : "Unable to sign in"));
    } finally {
      setSubmitting(false);
    }
  };

  const authenticated = (token: string, user: AuthenticatedUser) => {
    window.localStorage.setItem("auth_token", token);
    setRole(user.role);
    if (user.phoneVerified) nav(user.role === "transporter" ? "/carrier" : "/customer");
    else setStage("phone");
  };

  const verifyEmailCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emailCode.length !== 6) return setAuthError(t("Enter the complete six-digit code"));
    setSubmitting(true); setAuthError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code: emailCode }) });
      const payload = await response.json() as { token?: string; user?: AuthenticatedUser; error?: string };
      if (!response.ok || !payload.token || !payload.user) throw new Error(payload.error || t("Unable to verify your email"));
      window.localStorage.setItem("auth_token", payload.token);
      setRole(payload.user.role);
      setStage("phone");
    } catch (error) { setAuthError(error instanceof Error ? error.message : t("Unable to verify your email")); }
    finally { setSubmitting(false); }
  };

  const resendEmailCode = async () => {
    setSubmitting(true); setAuthError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/email/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t("Unable to send verification email"));
      setMessage(t("A new six-digit code was sent."));
    } catch (error) { setAuthError(error instanceof Error ? error.message : t("Unable to send verification email")); }
    finally { setSubmitting(false); }
  };

  const sendPhoneCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setPhoneError(""); setAuthError(""); setMessage("");
    try {
      const sessionToken = window.localStorage.getItem("auth_token") || "";
      const configResponse = await fetch("/api/auth/config");
      const configPayload = await configResponse.json() as AuthConfig;
      if (!configResponse.ok || !configPayload.firebase?.enabled) throw new Error(t("Phone verification is not configured"));
      const phoneNumber = normalizedPhoneNumber(country, localNumber, configPayload.firebase.testMode);
      if (!phoneNumber) return setPhoneError(t("Enter a valid mobile number for the selected country"));

      const validationResponse = await fetch("/api/auth/phone/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ phoneNumber }) });
      const validationPayload = await validationResponse.json() as { error?: string };
      if (!validationResponse.ok) throw new Error(validationPayload.error || t("Unable to send phone verification code"));

      const auth = getFirebasePhoneAuth(configPayload.firebase);
      auth.languageCode = language;
      firebaseAuth.current = auth;

      recaptchaVerifier.current?.clear();
      const verifier = new RecaptchaVerifier(auth, "firebase-phone-recaptcha", { size: "invisible" });
      recaptchaVerifier.current = verifier;
      confirmationResult.current = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setPendingPhoneNumber(phoneNumber);
      setStage("phone-code");
      setMessage(configPayload.firebase.testMode ? t("Use the six-digit test code configured for this phone number in Firebase.") : t("We sent a six-digit code to your phone."));
    } catch (error) {
      setAuthError(error instanceof Error && !('code' in error) ? error.message : firebasePhoneError(error, t));
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
      const response = await fetch("/api/auth/phone/verify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.localStorage.getItem("auth_token") || ""}` }, body: JSON.stringify({ firebaseIdToken }) });
      const payload = await response.json() as { user?: AuthenticatedUser; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || t("Unable to verify phone number"));
      if (firebaseAuth.current) await signOut(firebaseAuth.current);
      confirmationResult.current = null;
      nav(payload.user.role === "transporter" ? "/carrier" : "/customer");
    } catch (error) { setAuthError(error instanceof Error && !('code' in error) ? error.message : firebasePhoneError(error, t)); }
    finally { setSubmitting(false); }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main>
    {stage === "login" && <><GoogleSignInButton onAuthenticated={authenticated} /><div className="or">{t("or")}</div><form className="auth-form" onSubmit={handleSubmit}><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><div className="password-field"><label>{t("Password")}<PasswordControl value={password} onChange={event => setPassword(event.target.value)} placeholder={t("Password")} autoComplete="current-password" required /></label><Link className="forgot-password" to="/auth/forgot-password">{t("Forgot your password?")}</Link></div>{authError && <p className="auth-error">{authError}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Sign in")} <Arrow /></button></form><p className="auth-signup-prompt">{t("Don't have an account?")} <Link to="/auth?mode=register">{t("Create one here")}</Link></p></>}
    {stage === "role" && <><p className="eyebrow">{t("Create your account")}</p><h1>{t("How will you use VanScout?")}</h1><RolePicker value={role} onChange={setRole} /><button type="button" className="button dark full" onClick={() => setStage("profile")}>{t("Continue")} <Arrow /></button><p className="auth-signup-prompt">{t("Already have an account?")} <Link to="/auth">{t("Sign in here")}</Link></p></>}
    {stage === "profile" && <><p className="eyebrow">{t(role === "transporter" ? "Transporter account" : "Requester account")}</p><h1>{t("Create your account")}</h1><form className="auth-form" onSubmit={handleSubmit}><div className="name-fields"><label>{t("First name")}<input value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" required /></label><label>{t("Last name")}<input value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" required /></label></div><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><div className="password-field"><label>{t("Password")}<PasswordControl value={password} onChange={event => { const value = event.target.value; setPassword(value); setPasswordError(value.length > 0 && value.length < 8 ? t("Password must be at least 8 characters") : ""); setPasswordConfirmationError(passwordConfirmation && value !== passwordConfirmation ? t("Passwords do not match") : ""); }} placeholder={t("Create a password")} autoComplete="new-password" minLength={8} aria-invalid={Boolean(passwordError)} required />{passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label><label className="password-confirmation"><span>{t("Confirm password")}</span><PasswordControl value={passwordConfirmation} onChange={event => { const value = event.target.value; setPasswordConfirmation(value); setPasswordConfirmationError(value && value !== password ? t("Passwords do not match") : ""); }} placeholder={t("Repeat your password")} autoComplete="new-password" minLength={8} aria-invalid={Boolean(passwordConfirmationError)} required />{passwordConfirmationError && <span className="field-error" role="alert">{passwordConfirmationError}</span>}</label></div>{authError && <p className="auth-error">{authError}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Confirm and continue")} <Arrow /></button></form><button type="button" className="quiet-link auth-back" onClick={() => setStage("role")}>← {t("Back")}</button></>}
    {stage === "email-code" && <><p className="eyebrow">{t("Confirm your email")}</p><h1>{t("Enter your email code")}</h1><p>{t("We sent a six-digit verification code to")} <strong>{email}</strong>.</p><form onSubmit={verifyEmailCode}><OtpInput value={emailCode} onChange={setEmailCode} disabled={submitting} />{message && <p className="auth-message success">{message}</p>}{authError && <p className="auth-message error">{authError}</p>}<button className="button dark full" type="submit" disabled={submitting || emailCode.length !== 6}>{t("Verify email")} <Arrow /></button></form><button className="quiet-link center" type="button" onClick={() => void resendEmailCode()} disabled={submitting}>{t("Send a new code")}</button></>}
    {stage === "phone" && <><p className="eyebrow">{t("One quick check")}</p><h1>{t("Verify your phone.")}</h1><div className="security-note"><b>{t("Why we verify your phone")}</b><p>{t("Once a transport is agreed, VanScout shares phone contacts between both people. A verified number makes coordination easier and helps show that each person is genuine, adding an important layer of safety.")}</p></div><form onSubmit={sendPhoneCode}><PhoneNumberField country={country} localNumber={localNumber} onCountryChange={value => { setCountry(value); setLocalNumber(""); setPhoneError(""); }} onNumberChange={value => { setLocalNumber(value); setPhoneError(""); }} error={phoneError} />{authError && <p className="auth-message error">{authError}</p>}<button className="button dark full auth-create-button" type="submit" disabled={submitting}>{t("Send verification code")} <Arrow /></button></form></>}
    {stage === "phone-code" && <><p className="eyebrow">{t("Confirm your phone")}</p><h1>{t("Enter your phone code")}</h1><p>{t("Enter the code sent to")} <strong>{parsePhoneNumberFromString(pendingPhoneNumber)?.formatInternational() || pendingPhoneNumber}</strong>.</p><form onSubmit={verifyPhoneCode}><OtpInput value={phoneCode} onChange={setPhoneCode} disabled={submitting} />{message && <p className="auth-message success">{message}</p>}{authError && <p className="auth-message error">{authError}</p>}<button className="button dark full" type="submit" disabled={submitting || phoneCode.length !== 6}>{t("Verify and continue")} <Arrow /></button></form><button className="quiet-link center" type="button" onClick={() => { setStage("phone"); setPhoneCode(""); setPendingPhoneNumber(""); confirmationResult.current = null; }}>{t("Send a new code or change phone number")}</button></>}
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

  const resend = async () => {
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
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t("Unable to send verification email"));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><p className="eyebrow">{t("Confirm your email")}</p><h1>{t("Check your email")}</h1><p>{t("We sent a six-digit verification code to")} <strong>{email}</strong>.</p><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error">{error}</p>}<Link className="button dark full auth-create-button" to={`/auth?verifyEmail=${encodeURIComponent(email)}`}>{t("Continue verification")}</Link><button className="quiet-link center" type="button" onClick={() => void resend()} disabled={submitting}>{t("Send a new code")}</button><Link className="quiet-link auth-back" to="/auth">{t("Back to sign in")}</Link></main></div>;
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

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><p className="eyebrow">{t("Confirm your email")}</p><h1>{status === "loading" ? t("Confirming your email…") : status === "success" ? t("Email verified") : t("Unable to verify your email")}</h1><p>{status === "success" ? t("Your email has been verified. You can now sign in.") : status === "error" ? t("This verification link is invalid or expired") : t("Please wait while we confirm your email.")}</p><Link className="button dark full auth-create-button" to="/auth">{t("Back to sign in")}</Link></main></div>;
}

export function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main><p>{t("Enter your email to reset your password")}</p><form className="auth-form" onSubmit={handleSubmit}><label>{t("Email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error">{error}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Send reset link")} <Arrow /></button></form><Link className="quiet-link auth-back" to="/auth">{t("Back to sign in")}</Link></main></div>;
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
    const nextPasswordError = password.length < 8 ? t("Password must be at least 8 characters") : "";
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

  return <div className="auth"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /></div></header><main>{!token ? <p className="auth-message error">{t("This reset link is invalid or expired")}</p> : <form className="auth-form" onSubmit={handleSubmit}><label>{t("New password")}<PasswordControl value={password} onChange={event => { const value = event.target.value; setPassword(value); setPasswordError(value.length > 0 && value.length < 8 ? t("Password must be at least 8 characters") : ""); setPasswordConfirmationError(passwordConfirmation && value !== passwordConfirmation ? t("Passwords do not match") : ""); }} autoComplete="new-password" minLength={8} aria-invalid={Boolean(passwordError)} required />{passwordError && <span className="field-error" role="alert">{passwordError}</span>}</label><label className="password-confirmation">{t("Confirm password")}<PasswordControl value={passwordConfirmation} onChange={event => { const value = event.target.value; setPasswordConfirmation(value); setPasswordConfirmationError(value && value !== password ? t("Passwords do not match") : ""); }} placeholder={t("Repeat your password")} autoComplete="new-password" minLength={8} aria-invalid={Boolean(passwordConfirmationError)} required />{passwordConfirmationError && <span className="field-error" role="alert">{passwordConfirmationError}</span>}</label>{message && <p className="auth-message success">{message}</p>}{error && <p className="auth-message error">{error}</p>}<button type="submit" className="button dark full auth-create-button" disabled={submitting}>{t("Reset password")} <Arrow /></button></form>}<Link className="quiet-link auth-back" to="/auth">{t("Back to sign in")}</Link></main></div>;
}

function RequestRow({ booked, onClick }: { booked?: boolean; onClick: () => void }) { const { t } = useLanguage(); return <article className="request-row"><ItemImage /><div><h3>{t("Bed slats")}</h3><p>IKEA Zagreb <i>→</i> Trešnjevka</p><span className={`status ${booked ? "booked" : ""}`}>{booked ? t("Carrier booked") : t("3 offers · Looking for carriers")}</span></div><div className="request-meta"><b>12 km</b><span>{t("Flexible pickup")}</span></div><button className="button dark short" onClick={onClick}>{booked ? t("Open transport") : t("View offers")}</button></article>; }
export function CustomerWorkspace() { const { t } = useLanguage(); const loc = useLocation(); const nav = useNavigate(); const [view, setView] = useState(loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("profile") ? "profile" : "requests"); const [detail, setDetail] = useState(false); const [accepted, setAccepted] = useState(false); const [offer, setOffer] = useState<Offer | null>(null); const [sort, setSort] = useState("Recommended"); const go = (next: string) => { setView(next); nav(next === "messages" ? "/customer/messages" : next === "profile" ? "/customer/profile" : "/customer"); }; const list = useMemo(() => sort === "Lowest price" ? [...OFFERS].sort((a, b) => Number(a.price.slice(1)) - Number(b.price.slice(1))) : OFFERS, [sort]); return <div className="app"><Topbar kind="customer" active={view === "requests" ? "requests" : view} /><main className="workspace">{view === "requests" && !detail && <section className="requests"><div className="workspace-title"><div><p className="eyebrow">{t("Your transport, at a glance")}</p><h1>{t("Your transports")}</h1></div><div className="tabs"><button className="selected">{t("Active")}</button><button>{t("Completed")}</button></div></div><div className="rows"><RequestRow onClick={() => setDetail(true)} /><RequestRow booked onClick={() => { setAccepted(true); setDetail(true); }} /></div></section>}{view === "requests" && detail && <RequestDetail accepted={accepted} sort={sort} onSort={setSort} offers={list} onBack={() => setDetail(false)} onOpenProfile={setOffer} onMessage={() => go("messages")} onAccept={setOffer} onTracking={() => nav("/tracking")} onReview={() => go("review")} />}{view === "messages" && <Messages onAccept={() => setOffer(OFFERS[0])} />}{view === "profile" && <CustomerProfile />}{view === "review" && <Review onDone={() => { go("requests"); setDetail(false); }} />}</main>{offer && <OfferDialog offer={offer} onClose={() => setOffer(null)} onAccept={() => { setAccepted(true); setOffer(null); }} onMessage={() => { setOffer(null); go("messages"); }} />}</div>; }
function RequestDetail({ accepted, sort, onSort, offers, onBack, onOpenProfile, onMessage, onAccept, onTracking, onReview }: { accepted: boolean; sort: string; onSort: (x: string) => void; offers: Offer[]; onBack: () => void; onOpenProfile: (x: Offer) => void; onMessage: () => void; onAccept: (x: Offer) => void; onTracking: () => void; onReview: () => void }) { const { t } = useLanguage(); return <section className="request-detail"><button className="back" onClick={onBack}>← {t("Your transports")}</button><header><div><p className="eyebrow">{accepted ? t("Carrier booked") : t("3 offers received")}</p><h1>{t("Bed slats")}</h1><p>IKEA Zagreb <i>→</i> Trešnjevka</p></div><span className={`status large ${accepted ? "booked" : ""}`}>{accepted ? t("Carrier booked") : t("Looking for carriers")}</span></header><div className="detail-layout"><aside><ItemImage /><h3>{t("Request summary")}</h3><dl><div><dt>{t("Route")}</dt><dd>IKEA Zagreb → Trešnjevka</dd></div><div><dt>{t("Distance")}</dt><dd>12 km</dd></div><div><dt>{t("Timing")}</dt><dd>{t("Flexible pickup")}</dd></div><div><dt>{t("Loading")}</dt><dd>{t("No loading help required")}</dd></div></dl><div className="mini-map"><RouteLine /><b>12 km</b></div></aside><div className="primary-detail">{accepted ? <Accepted onTracking={onTracking} onReview={onReview} /> : <><div className="offers-heading"><div><h2>{t("Choose a carrier")}</h2><p>{t("Compare price, availability and previous reviews.")}</p></div><div className="sort">{["Recommended", "Lowest price", "Earliest pickup"].map(x => <button className={sort === x ? "selected" : ""} onClick={() => onSort(x)} key={x}>{t(x)}</button>)}</div></div>{offers.map(o => <OfferCard key={o.name} offer={o} onProfile={() => onOpenProfile(o)} onMessage={onMessage} onAccept={() => onAccept(o)} />)}</>}</div></div></section>; }
function OfferCard({ offer, onProfile, onMessage, onAccept }: { offer: Offer; onProfile: () => void; onMessage: () => void; onAccept: () => void }) { const { t } = useLanguage(); return <article className="offer"><button onClick={onProfile}><Avatar offer={offer} /></button><div className="offer-person"><button onClick={onProfile}>{offer.name}</button><span>★ {offer.rating} · {t(offer.jobs)}</span><small>{offer.vehicle}</small></div><div className="offer-time"><b>{t(offer.time)}</b><span>{t("Available window")}</span></div><p>“{t(offer.note)}”</p><div className="price"><b>{offer.price}</b><span>{t("all in")}</span></div><div className="offer-actions"><button onClick={onMessage}>{t("Message")}</button><button onClick={onProfile}>{t("View profile")}</button><button className="button moss short" onClick={onAccept}>{t("Accept")}</button></div></article>; }
function OfferDialog({ offer, onClose, onAccept, onMessage }: { offer: Offer; onClose: () => void; onAccept: () => void; onMessage: () => void }) { const { t } = useLanguage(); const [profile, setProfile] = useState(true); return <div className="overlay">{profile ? <aside className="side"><button className="close" onClick={onClose}>×</button><div className="profile-head"><Avatar offer={offer} large /><div><p className="eyebrow">{t("Verified carrier")}</p><h2>{offer.name}</h2><p>★ {offer.rating} · {t(offer.jobs)} {t("completed")}</p></div></div><p>{t("I move furniture and store purchases around Zagreb with a clean, fully-equipped large van. Clear communication, careful handling.")}</p><section><h3>{t("Vehicle")}</h3><div className="vehicle">▰ <div><b>{offer.vehicle}</b><span>{t("Large van")} · 3.2m {t("cargo length")}</span></div></div></section><section><h3>{t("Previous work")}</h3><div className="work-shots"><span /><span /><span /></div></section><blockquote>{t("On time, careful with everything, and a genuinely nice person.")}<footer>— Ana, {t("verified customer")}</footer></blockquote><footer className="side-actions"><button className="button ghost" onClick={onMessage}>{t("Message")}</button><button className="button moss" onClick={() => setProfile(false)}>{t("Accept")} {offer.price}</button></footer></aside> : <div className="confirm"><button className="close" onClick={onClose}>×</button><p className="eyebrow">{t("Confirm carrier")}</p><h2>{t("Choose {name} for this transport?", { name: offer.name })}</h2><div><b>{offer.price}</b><span>IKEA Zagreb → Trešnjevka</span><span>{t(offer.time)}</span></div><p>{t("After accepting, you and the carrier will be able to see each other’s contact information.")}</p><footer><button className="button ghost" onClick={() => setProfile(true)}>{t("Cancel")}</button><button className="button moss" onClick={onAccept}>{t("Accept offer")}</button></footer></div>}</div>; }
function Accepted({ onTracking, onReview }: { onTracking: () => void; onReview: () => void }) { const { t } = useLanguage(); return <div className="accepted"><section className="booked-card"><Avatar large /><div><p className="eyebrow">{t("Your carrier")}</p><h2>Mario M.</h2><p>★ 4.9 · Renault Master</p></div><div><a href="tel:+385915552400">+385 91 555 2400</a><a href="mailto:mario@example.com">mario@example.com</a></div></section><div className="transport-steps"><div className="done"><b>✓</b><span><strong>{t("Booked")}</strong><small>{t("Mario accepted your transport.")}</small></span></div><div className="active"><b>●</b><span><strong>{t("Pickup")}</strong><small>{t("Today")}, 17:00–19:00</small></span></div><div><b>○</b><span><strong>{t("In transit")}</strong><small>{t("Live updates will appear here.")}</small></span></div><div><b>○</b><span><strong>{t("Delivered")}</strong><small>{t("Review the transport when it’s done.")}</small></span></div></div><div className="actions"><button className="button dark" onClick={onTracking}>{t("Open delivery tracking")} <Arrow /></button><button className="quiet-link" onClick={onReview}>{t("Preview review flow")}</button></div></div>; }
function Messages({ onAccept }: { onAccept: () => void }) { const { t } = useLanguage(); const [note, setNote] = useState(""); const [sent, setSent] = useState<string[]>([]); return <section className="messages-page"><header><p className="eyebrow">{t("Keep it in one place")}</p><h1>{t("Messages")}</h1></header><div className="messages"><aside><button className="conversation selected"><Avatar /><span><b>Mario M.</b><small>{t("Sounds good—17:00 works.")}</small></span><i>2m</i></button><button className="conversation"><Avatar offer={OFFERS[1]} /><span><b>Luka P.</b><small>{t("I can do tomorrow morning.")}</small></span><i>1h</i></button></aside><article><header><div><Avatar /><span><b>Mario M.</b><small>★ 4.9 · Renault Master</small></span></div><b className="offer-tag">{t("Offer: €32")}</b></header><div className="chat-context"><span>{t("Pickup: Today, 17:00–19:00")}</span><button className="button moss short" onClick={onAccept}>{t("Accept offer")}</button></div><div className="thread"><p className="bubble theirs">{t("Hi Ana, I’m already collecting an order near IKEA this afternoon. I can pick up the bed slats between 17:00–19:00.")}</p><p className="bubble mine">{t("Great, that works. It’s ground floor pickup and the slats are already packed.")}</p><p className="contact-note">{t("Contact information can be shared after an offer is accepted.")}</p>{sent.map(x => <p className="bubble mine" key={x}>{x}</p>)}</div><form onSubmit={event => { event.preventDefault(); if (note.trim()) { setSent([...sent, note.trim()]); setNote(""); } }}><input value={note} onChange={event => setNote(event.target.value)} placeholder={t("Write a message")} /><button aria-label={t("Send")}>↑</button></form></article></div></section>; }
function CustomerProfile() { const { t } = useLanguage(); return <section className="profile-page"><p className="eyebrow">{t("Account")}</p><h1>{t("Your profile")}</h1><div className="profile-head"><span className="avatar customer large">AN</span><div><h2>Ana Novak</h2><p>ana.novak@example.com · +385 91 555 2400</p><button className="quiet-link">{t("Edit profile")}</button></div></div><div className="setting-list"><button>{t("Notifications")} <i>›</i></button><button>{t("Payment methods")} <i>›</i></button><button>{t("Help and safety")} <i>›</i></button></div></section>; }
function Review({ onDone }: { onDone: () => void }) { const { t } = useLanguage(); const [rating, setRating] = useState(5); return <section className="review"><p className="eyebrow">{t("Transport complete")}</p><h1>{t("How did it go?")}</h1><div className="profile-head"><Avatar large /><div><h2>Mario M.</h2><p>{t("Bed slats")} · IKEA Zagreb → Trešnjevka</p></div></div><div className="stars">{[1,2,3,4,5].map(n => <button className={n <= rating ? "on" : ""} onClick={() => setRating(n)} key={n}>★</button>)}</div><div className="tags">{["On time", "Great communication", "Careful handling", "Friendly"].map(x => <button key={x}>{t(x)}</button>)}</div><label><textarea placeholder={t("Add a short comment (optional)")} /></label><button className="button moss" onClick={onDone}>{t("Submit review")}</button></section>; }
export function Tracking() { const { t } = useLanguage(); return <div className="tracking"><header><Mark /><div className="standalone-header-actions"><LanguagePicker /><span>{t("Private delivery tracking")}</span></div></header><main><p className="eyebrow">{t("Bed slats")} · 12 km</p><h1>{t("Your delivery is on the way.")}</h1><div className="tracking-map"><RouteLine /><i>●</i><b className="map-pickup">IKEA Zagreb</b><b className="map-delivery">Trešnjevka</b></div><section className="eta"><div><Avatar /><span><b>Mario M.</b><small>Renault Master</small></span></div><div><span>{t("Estimated arrival")}</span><b>18:42</b></div></section><div className="transport-steps tracking-list"><div className="done"><b>✓</b><span><strong>{t("Picked up")}</strong><small>{t("17:28 — Mario has your item.")}</small></span></div><div className="active"><b>●</b><span><strong>{t("In transit")}</strong><small>{t("18:04 — Heavy traffic. ETA updated by 12 minutes.")}</small></span></div><div><b>○</b><span><strong>{t("Delivered")}</strong><small>{t("We’ll let you know when it arrives.")}</small></span></div></div></main></div>; }
function JobCard({ onOpen, compact = false }: { onOpen: () => void; compact?: boolean }) { const { t } = useLanguage(); return <article className={`job ${compact ? "compact" : ""}`}><ItemImage /><div><h3>{t("Bed slats")}</h3><p>IKEA Zagreb <i>→</i> Trešnjevka</p><span>12 km</span><span>{t("Flexible")}</span><span>{t("No loading help required")}</span></div>{!compact && <b>3 {t("offers")}</b>}<button className="button dark short" onClick={onOpen}>{t("View job")}</button></article>; }
export function CarrierWorkspace() { const loc = useLocation(); const nav = useNavigate(); const derive = () => loc.pathname.includes("offers") ? "offers" : loc.pathname.includes("active") ? "active" : loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("wallet") ? "wallet" : loc.pathname.includes("vehicles") ? "vehicles" : loc.pathname.includes("profile") ? "profile" : "jobs"; const [view, setView] = useState(derive()); const [job, setJob] = useState(false); const [offer, setOffer] = useState(false); const [stage, setStage] = useState(0); const [share, setShare] = useState(false); const go = (x: string) => { setView(x); nav(x === "jobs" ? "/carrier" : `/carrier/${x}`); }; const { t } = useLanguage(); return <div className="app"><Topbar kind="carrier" active={view} /><main className="workspace">{view === "jobs" && !job && <section className="jobs"><div className="workspace-title"><div><p className="eyebrow">{t("Near Zagreb")}</p><h1>{t("Available transports")}</h1></div><div className="filters">{["Pickup area", "Destination", "Date", "Category"].map(x => <button key={x}>{t(x)}</button>)}</div></div><JobCard onOpen={() => setJob(true)} /><JobCard onOpen={() => setJob(true)} /><JobCard onOpen={() => setJob(true)} /></section>}{view === "jobs" && job && !offer && <JobDetail onBack={() => setJob(false)} onOffer={() => setOffer(true)} />}{view === "jobs" && offer && <MakeOffer onBack={() => setOffer(false)} onSend={() => { setOffer(false); go("offers"); }} />}{view === "offers" && <MyOffers onOpen={() => { go("jobs"); setJob(true); }} />}{view === "messages" && <Messages onAccept={() => go("active")} />}{view === "active" && <ActiveDelivery stage={stage} onNext={() => setStage(Math.min(stage + 1, 3))} share={share} onShare={() => setShare(!share)} />}{view === "wallet" && <Wallet />}{view === "profile" && <CarrierProfile onVehicles={() => go("vehicles")} />}{view === "vehicles" && <Vehicles onBack={() => go("profile")} />}</main></div>; }
function JobDetail({ onBack, onOffer }: { onBack: () => void; onOffer: () => void }) { const { t } = useLanguage(); return <section className="job-detail"><button className="back" onClick={onBack}>← {t("Available transports")}</button><header><div><p className="eyebrow">{t("Furniture")} · {t("Flexible")}</p><h1>{t("Bed slats")}</h1><p>IKEA Zagreb <i>→</i> Trešnjevka</p></div><b>12 km</b></header><div className="job-layout"><div><div className="detail-map"><RouteLine /><span>IKEA Zagreb</span><span>Trešnjevka</span></div><section><h2>{t("What you’re moving")}</h2><p>{t("Bed slats, already packed. No loading help required.")}</p><div className="photo-row"><ItemImage type="photo" /><ItemImage type="photo" /></div></section><section className="info-split"><div><span>{t("Pickup")}</span><b>{t("Flexible · Ground floor")}</b></div><div><span>{t("Delivery")}</span><b>{t("Trešnjevka · Elevator available")}</b></div></section></div><aside><p className="eyebrow">{t("Interested")}</p><h2>{t("Make a clear offer.")}</h2><p>{t("Tell the customer your price and when you can do it.")}</p><button className="button moss full" onClick={onOffer}>{t("Make an offer")} <Arrow /></button></aside></div><button className="button moss mobile-sticky" onClick={onOffer}>{t("Make an offer")}</button></section>; }
function MakeOffer({ onBack, onSend }: { onBack: () => void; onSend: () => void }) { const { t } = useLanguage(); return <section className="make-offer"><button className="back" onClick={onBack}>← {t("Job details")}</button><p className="eyebrow">{t("Bed slats")} · IKEA Zagreb → Trešnjevka</p><h1>{t("Your offer")}</h1><div><label className="price-input">€<input defaultValue="32" /></label><Picker label={t("Pickup availability")} defaultValue="today" options={[{ value: "today", label: <>{t("Today")}, 17:00–19:00</> }, { value: "tomorrow", label: t("Tomorrow, 10:00–12:00") }]} ariaLabel={t("Pickup availability")} /><Picker label={t("Delivery estimate")} defaultValue="45" options={[{ value: "45", label: t("Within 45 minutes of pickup") }, { value: "60", label: t("Within 1 hour of pickup") }]} ariaLabel={t("Delivery estimate")} /><Picker label={t("Vehicle")} defaultValue="master" options={[{ value: "master", label: <>Renault Master · {t("Large van")}</> }]} ariaLabel={t("Vehicle")} /><label>{t("Message")} <em>{t("Optional")}</em><textarea defaultValue={t("I’m already driving through this area tomorrow afternoon.")} /></label><button className="button moss full" onClick={onSend}>{t("Send offer")} <Arrow /></button></div></section>; }
function MyOffers({ onOpen }: { onOpen: () => void }) { const { t } = useLanguage(); return <section className="my-offers"><div className="workspace-title"><div><p className="eyebrow">{t("Keep an eye on it")}</p><h1>{t("My offers")}</h1></div><div className="tabs"><button className="selected">{t("Pending")}</button><button>{t("Accepted")}</button><button>{t("Past")}</button></div></div><article><ItemImage /><div><h3>{t("Bed slats")}</h3><p>IKEA Zagreb → Trešnjevka</p></div><strong>€32</strong><span className="status">{t("Waiting for customer")}</span><button className="button dark short" onClick={onOpen}>{t("Open")}</button></article></section>; }
function ActiveDelivery({ stage, onNext, share, onShare }: { stage: number; onNext: () => void; share: boolean; onShare: () => void }) { const { t } = useLanguage(); const title = ["Heading to pickup", "At pickup", "Item collected", "On the way"][stage]; const action = ["I’ve arrived", "Item collected", "Start delivery", "Mark as delivered"][stage]; return <section className="active-delivery"><p className="eyebrow">{t("Active transport")}</p><h1>{t(title)}</h1><div className="active-meta"><div><span>{t("Customer")}</span><b>Ana Novak</b><a href="tel:+385915552400">+385 91 555 2400</a></div><div><span>{t("Route")}</span><b>IKEA Zagreb → Trešnjevka</b><button>{t("Open navigation")}</button></div></div><div className="active-map"><RouteLine /><i>●</i></div><div className="share"><div><b>{t("Share live location with customer")}</b><p>{t("Your customer will receive a private tracking link until delivery is completed.")}</p></div><button className={share ? "switch on" : "switch"} onClick={onShare}><span /></button></div><div className="update-buttons">{["Traffic", "Pickup delay", "Customer unavailable", "Other"].map(x => <button key={x}>{t(x)}</button>)}</div><button className="button moss delivery-action" onClick={onNext}>{t(action)}</button></section>; }
function Wallet() { const { t } = useLanguage(); const [open, setOpen] = useState(false); const [amount, setAmount] = useState("50"); return <section className="wallet"><p className="eyebrow">{t("Your funds")}</p><h1>{t("Balance")}</h1><strong>€42.50</strong><button className="button moss" onClick={() => setOpen(!open)}>{t("Add funds")} <Arrow /></button>{open && <div className="checkout"><h2>{t("Add funds")}</h2><div>{["10", "25", "50", "100"].map(x => <button className={amount === x ? "selected" : ""} onClick={() => setAmount(x)} key={x}>€{x}</button>)}<label>€<input value={amount} onChange={e => setAmount(e.target.value)} /></label></div><Picker label={t("Payment method")} defaultValue="visa" options={[{ value: "visa", label: t("Visa ending in 2400") }, { value: "new", label: t("New card") }]} ariaLabel={t("Payment method")} /><button className="button dark full">{t("Add funds")} €{amount}</button></div>}<article className="activity"><h2>{t("Recent activity")}</h2><div><span><b>€50.00</b><small>{t("Balance top-up")}</small></span><time>{t("Today")}</time></div><div><span><b>− €4.80</b><small>{t("Commission — Bed slats transport")}</small></span><time>{t("Aug 18")}</time></div></article></section>; }
function CarrierProfile({ onVehicles }: { onVehicles: () => void }) { const { t } = useLanguage(); return <section className="carrier-profile"><div className="profile-head"><Avatar large /><div><p className="eyebrow">{t("Verified carrier")}</p><h1>Mario M.</h1><p>★ 4.9 · 127 {t("completed transports")}</p></div></div><p>{t("I’m an independent carrier in Zagreb. I care about being on time, communicating clearly, and delivering everything in the condition it left.")}</p><section><header><h2>{t("Vehicles")}</h2><button className="quiet-link" onClick={onVehicles}>{t("Manage")}</button></header><div className="vehicle">▰ <div><b>Renault Master</b><span>{t("Large Van")} · 3.2m {t("cargo length")} · 1,350kg {t("payload")}</span></div></div></section><section><h2>{t("Reviews")}</h2><blockquote>“{t("Mario was early, thoughtful and took great care with the furniture.")}”<footer>— Petra, {t("verified customer")}</footer></blockquote></section></section>; }
function Vehicles({ onBack }: { onBack: () => void }) { const { t } = useLanguage(); return <section className="vehicles"><button className="back" onClick={onBack}>← {t("Carrier profile")}</button><header><div><p className="eyebrow">{t("Your equipment")}</p><h1>{t("Vehicles")}</h1></div><button className="button dark short">{t("Add vehicle")}</button></header><div className="vehicle manager">▰ <div><b>Renault Master</b><span>{t("Large Van")}</span><small>3.2m {t("cargo length")} · 1.7m {t("width")} · 1,350kg {t("payload")}</small></div><p><button>{t("Edit")}</button><button className="danger">{t("Remove")}</button></p></div></section>; }
