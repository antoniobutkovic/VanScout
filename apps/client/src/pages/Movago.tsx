import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IMAGES } from "../assets/images";

type Offer = {
  name: string;
  price: string;
  rating: string;
  jobs: string;
  vehicle: string;
  time: string;
  note: string;
  initials: string;
  tone: string;
};

const OFFERS: Offer[] = [
  { name: "Mario M.", price: "€32", rating: "4.9", jobs: "127 jobs", vehicle: "Renault Master", time: "Today, 17:00–19:00", note: "I’m already collecting another order near IKEA this afternoon.", initials: "MM", tone: "mario" },
  { name: "Luka P.", price: "€28", rating: "4.8", jobs: "81 jobs", vehicle: "Ford Transit", time: "Tomorrow, 10:00–12:00", note: "I can collect this on my morning route through Trešnjevka.", initials: "LP", tone: "luka" },
  { name: "Nikola R.", price: "€37", rating: "5.0", jobs: "42 jobs", vehicle: "Mercedes Sprinter", time: "Friday, 14:00–16:00", note: "Two-person pickup available if you need a hand with the load.", initials: "NR", tone: "nikola" },
];

const CATEGORIES = ["Furniture", "Appliances", "Store purchase", "Motorcycle", "Boxes / pallets", "Other"];
const WIZARD_STEPS = ["Item", "Photos", "Pickup", "Delivery", "Timing", "Details", "Review"];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function Mark() {
  return <Link className="brand" to="/">movago<span>.</span></Link>;
}

function RouteLine({ small = false }: { small?: boolean }) {
  return <span className={`route-line ${small ? "small" : ""}`}><i /><b /><i /></span>;
}

function Avatar({ offer, large = false }: { offer?: Offer; large?: boolean }) {
  const identity = offer ?? OFFERS[0];
  return <span className={`avatar ${identity.tone} ${large ? "large" : ""}`}>{large && identity.name === "Mario M." ? <img src={IMAGES.CARRIER_DOT_PROFILE} alt="Mario M." /> : identity.initials}</span>;
}

function Topbar({ kind, active }: { kind?: "customer" | "carrier"; active?: string }) {
  const carrierLinks = [["jobs", "Find jobs", "/carrier"], ["offers", "My offers", "/carrier/offers"], ["active", "Active", "/carrier/active"], ["messages", "Messages", "/carrier/messages"], ["wallet", "Wallet", "/carrier/wallet"]];
  return <header className={`topbar ${kind ? "app-topbar" : ""}`}>
    <Mark />
    {kind === "carrier" ? <nav>{carrierLinks.map(([key, label, href]) => <Link className={active === key ? "active" : ""} key={key} to={href}>{label}</Link>)}</nav> : kind === "customer" ? <nav><Link className={active === "requests" ? "active" : ""} to="/customer">Requests</Link><Link className={active === "messages" ? "active" : ""} to="/customer/messages">Messages</Link></nav> : <nav><Link to="/how-it-works">How it works</Link><Link to="/for-carriers">For carriers</Link></nav>}
    <div className="nav-actions">
      {kind ? <><button className="notice" aria-label="Notifications">◌</button><Link className="mini-avatar" to={kind === "carrier" ? "/carrier/profile" : "/customer/profile"}>{kind === "carrier" ? "MM" : "AN"}</Link>{kind === "customer" && <Link className="button dark short" to="/create-request">New request</Link>}</> : <><Link className="sign-in" to="/auth">Sign in</Link><Link className="button dark short" to="/create-request">Request transport</Link></>}
    </div>
  </header>;
}

function Footer() {
  return <footer className="footer"><Mark /><span>Move big things, simply.</span><div><Link to="/how-it-works">How it works</Link><Link to="/for-carriers">For carriers</Link><a href="mailto:hello@movago.example">Help</a></div></footer>;
}

function ItemImage({ type = "bed" }: { type?: "bed" | "photo" }) {
  return <div className={`item-image ${type}`}><span>{type === "bed" ? <>Bed<br />slats</> : "Photo"}</span></div>;
}

export function Home() {
  return <div className="site"><Topbar /><main>
    <section className="home-hero">
      <div className="home-copy"><p className="eyebrow">Transport, without the back and forth.</p><h1>Need to move something that won’t fit in your car?</h1><p>Post what you need moved and receive offers from local carriers.</p><div className="actions"><Link className="button moss" to="/create-request">Request transport <Arrow /></Link><Link className="quiet-link" to="/for-carriers">I’m a carrier <Arrow /></Link></div></div>
      <div className="hero-image"><img src={IMAGES.HOME_DOT_HERO} alt="Furniture and boxes being loaded into a cargo van." /><div className="hero-caption"><span>Local carrier</span><strong>Large enough for the things that matter.</strong></div><div className="hero-sticker"><span>Today</span><RouteLine small /><b>IKEA Zagreb → Trešnjevka</b></div></div>
    </section>
    <section className="steps"><p className="eyebrow">How it works</p><div>{[["01", "Post what you need moved", "Add photos and tell us where it needs to go."], ["02", "Receive offers", "Local carriers send you their price and availability."], ["03", "Choose who moves it", "Compare carriers, chat and book the one you want."]].map(([number, title, copy]) => <article key={number}><span>{number}</span><h2>{title}</h2><p>{copy}</p></article>)}</div></section>
    <section className="use-cases"><header><p className="eyebrow">For real life</p><h2>Whatever it is. Wherever it’s going.</h2></header><div className="case-grid"><Link to="/create-request" className="case photo-case main-case"><img src={IMAGES.HOME_DOT_FURNITURE} alt="Furniture ready to transport." /><b>Furniture <Arrow /></b></Link><Link to="/create-request" className="case photo-case"><img src={IMAGES.HOME_DOT_APPLIANCES} alt="Appliance ready to transport." /><b>Appliances <Arrow /></b></Link><Link to="/create-request" className="case text-case"><b>Store pickup <Arrow /></b></Link><Link to="/create-request" className="case text-case clay"><b>Marketplace finds <Arrow /></b></Link></div></section>
    <section className="trust"><div><p className="eyebrow">Built for confidence</p><h2>Choose with confidence.</h2></div><ul><li>✓ Verified phone numbers</li><li>✓ Carrier profiles and vehicles</li><li>✓ Real reviews after every job</li></ul></section>
    <section className="final-cta"><p className="eyebrow">One good question</p><h2>What do you need moved?</h2><Link className="button dark" to="/create-request">Create a transport request <Arrow /></Link></section>
  </main><Footer /></div>;
}

export function HowItWorks() {
  const list = [["1", "Create a request", "Tell Movago what needs to be transported."], ["2", "Set the route", "Choose pickup and delivery locations."], ["3", "Choose timing", "Pick a date or stay flexible for better prices."], ["4", "Receive offers", "Local carriers suggest a price and available time."], ["5", "Compare and chat", "See vehicle, rating and availability before you decide."], ["6", "Book with confidence", "Accept one offer, track the delivery, then review."]];
  return <div className="site"><Topbar /><main className="info"><section className="intro"><p className="eyebrow">The simple version</p><h1>From “can someone move this?” to delivered.</h1><p>Movago makes bulky-item transport feel as easy as buying it in the first place.</p><Link className="button moss" to="/create-request">Request transport <Arrow /></Link></section><section className="lifecycle">{list.map(([n, title, text]) => <article key={n}><span>{n}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</section></main><Footer /></div>;
}

export function CarrierLanding() {
  return <div className="site"><Topbar /><main className="carrier-land"><section className="intro"><p className="eyebrow">For independent carriers</p><h1>Good routes. Clear jobs. On your terms.</h1><p>Find nearby transport jobs, choose the work that fits your vehicle, and make offers in minutes.</p><div className="actions"><Link className="button moss" to="/carrier">Start carrying <Arrow /></Link><Link className="quiet-link" to="/how-it-works">See how Movago works <Arrow /></Link></div></section><section className="carrier-points">{[["01", "Only relevant jobs", "Filter by route, day, category and the jobs your vehicle can actually take."], ["02", "Offer on your schedule", "Set a fair price and pickup window. Customers choose the right fit."], ["03", "Keep the work moving", "One calm workspace for offers, messages, live jobs and balance."]].map(([n,t,c]) => <article key={n}><span>{n}</span><h2>{t}</h2><p>{c}</p></article>)}</section><section className="carrier-preview"><div><p className="eyebrow">See the job, not the noise</p><h2>Everything you need to decide. Nothing you don’t.</h2><p>Item, route, timing and access details come first. Send an offer when it makes sense.</p></div><JobCard onOpen={() => undefined} compact /></section></main><Footer /></div>;
}

export function CreateRequest() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("Furniture");
  const [timing, setTiming] = useState("I’m flexible");
  const [expanded, setExpanded] = useState("");
  const next = () => step === 6 ? nav("/auth") : setStep(step + 1);
  return <div className="wizard"><header><Mark /><span>{step + 1} / 7</span><Link to="/">×</Link></header><div className="wizard-progress"><b style={{ width: `${(step + 1) * 14.285}%` }} />{WIZARD_STEPS.map((label, index) => <span className={index === step ? "current" : ""} key={label}>{label}</span>)}</div>
    <main>
      {step === 0 && <section><p className="eyebrow">Start with the thing</p><h1>What are you moving?</h1><div className="choices">{CATEGORIES.map(item => <button className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><label>Item name<input defaultValue="Bed slats" /></label><label>Description <em>Optional</em><textarea placeholder="Anything carriers should know about the item?" /></label><button className="expand" onClick={() => setExpanded(expanded === "size" ? "" : "size")}>{expanded === "size" ? "− Hide dimensions" : "+ Add dimensions"}</button>{expanded === "size" && <div className="inline-inputs"><label>Length<input placeholder="cm" /></label><label>Width<input placeholder="cm" /></label><label>Weight<input placeholder="kg" /></label></div>}</section>}
      {step === 1 && <section className="visual-step"><p className="eyebrow">A better offer starts here</p><h1>Show carriers what they’re moving.</h1><div className="drop"><b>＋</b><strong>Drop photos here</strong><span>or choose from your device</span><button className="button dark short">Choose photos</button></div><p className="help">Photos help carriers give you a more accurate price.</p></section>}
      {step === 2 && <AddressStep label="Where should it be picked up?" value="IKEA Zagreb" kind="pickup" expanded={expanded === "pickup"} onExpand={() => setExpanded(expanded === "pickup" ? "" : "pickup")} />}
      {step === 3 && <AddressStep label="Where is it going?" value="Trešnjevka, Zagreb" kind="delivery" expanded={expanded === "delivery"} onExpand={() => setExpanded(expanded === "delivery" ? "" : "delivery")} />}
      {step === 4 && <section><p className="eyebrow">Make it work for you</p><h1>When should it be moved?</h1><div className="timing">{["As soon as possible", "Choose a date", "I’m flexible"].map(item => <button className={timing === item ? "selected" : ""} key={item} onClick={() => setTiming(item)}><b>{item}</b>{item === "I’m flexible" && <span>Flexible jobs can often receive cheaper offers because carriers can combine them with existing routes.</span>}</button>)}</div>{timing === "Choose a date" && <label>Preferred date<input type="date" /></label>}</section>}
      {step === 5 && <section><p className="eyebrow">Last details</p><h1>Anything else carriers should know?</h1><div className="tags">{["Needs two people", "Heavy item", "Already packed", "Store pickup", "Fragile"].map(tag => <button key={tag}>{tag}</button>)}</div><label><textarea className="large-textarea" placeholder="Add a note (optional)" /></label></section>}
      {step === 6 && <section className="review-request"><p className="eyebrow">One more look</p><h1>Ready to publish?</h1><article><ItemImage /><div><span>Furniture</span><h2>Bed slats</h2><p>IKEA Zagreb <i>→</i> Trešnjevka</p><small>12 km · {timing} · No loading help required</small></div><button>Edit</button></article></section>}
    </main><footer><button className="button ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Back</button><button className="button dark" onClick={next}>{step === 6 ? "Publish request" : "Continue"} <Arrow /></button></footer>
  </div>;
}

function AddressStep({ label, value, kind, expanded, onExpand }: { label: string; value: string; kind: string; expanded: boolean; onExpand: () => void }) {
  return <section><p className="eyebrow">{kind === "pickup" ? "First stop" : "Last stop"}</p><h1>{label}</h1><label className="address-input">{kind === "pickup" ? "Pickup location" : "Delivery location"}<input defaultValue={value} /></label>{kind === "pickup" ? <div className="map"><span>IKEA Zagreb</span><i>Pickup</i></div> : <div className="route-summary"><span>IKEA Zagreb</span><RouteLine /><span>Trešnjevka</span><b>12 km</b></div>}<button className="expand" onClick={onExpand}>{expanded ? `− Hide ${kind} details` : `+ Add ${kind} details`}</button>{expanded && <div className="details"><label>Floor<select><option>Ground floor</option><option>1st floor</option><option>2nd floor+</option></select></label><label><input type="checkbox" /> Elevator available</label><label><input type="checkbox" /> Help needed</label><label>Instructions<textarea placeholder="Parking, access, entrance…" /></label></div>}</section>;
}

export function Registration() {
  const nav = useNavigate();
  const [phone, setPhone] = useState(false);
  return <div className="auth"><header><Mark /><Link to="/create-request">Back to request</Link></header><main>{!phone ? <><p className="eyebrow">Almost there</p><h1>Save your request and start receiving offers.</h1><button className="google">G <span>Continue with Google</span></button><div className="or">or</div><label>Email<input type="email" placeholder="you@example.com" /></label><label>Password<input type="password" placeholder="Create a password" /></label><button className="button dark full" onClick={() => setPhone(true)}>Create account <Arrow /></button></> : <><p className="eyebrow">One quick check</p><h1>Verify your phone.</h1><p>We’ll text a six-digit code to keep Movago trusted for everyone.</p><label>Phone number<input defaultValue="+385 91 555 2400" /></label><div className="otp">{[1,2,3,4,5,6].map(n => <input aria-label={`Digit ${n}`} key={n} maxLength={1} />)}</div><button className="button dark full" onClick={() => nav("/customer")}>Verify and publish <Arrow /></button><button className="quiet-link center">Send a new code</button></>}</main></div>;
}

function RequestRow({ booked, onClick }: { booked?: boolean; onClick: () => void }) {
  return <article className="request-row"><ItemImage /><div><h3>Bed slats</h3><p>IKEA Zagreb <i>→</i> Trešnjevka</p><span className={`status ${booked ? "booked" : ""}`}>{booked ? "Carrier booked" : "3 offers · Looking for carriers"}</span></div><div className="request-meta"><b>12 km</b><span>Flexible pickup</span></div><button className="button dark short" onClick={onClick}>{booked ? "Open transport" : "View offers"}</button></article>;
}

export function CustomerWorkspace() {
  const loc = useLocation();
  const nav = useNavigate();
  const [view, setView] = useState(loc.pathname.includes("messages") ? "messages" : loc.pathname.includes("profile") ? "profile" : "requests");
  const [detail, setDetail] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [sort, setSort] = useState("Recommended");
  const go = (next: string) => { setView(next); nav(next === "messages" ? "/customer/messages" : next === "profile" ? "/customer/profile" : "/customer"); };
  const list = useMemo(() => sort === "Lowest price" ? [...OFFERS].sort((a,b) => Number(a.price.slice(1)) - Number(b.price.slice(1))) : OFFERS, [sort]);
  return <div className="app"><Topbar kind="customer" active={view === "requests" ? "requests" : view} /><main className="workspace">
    {view === "requests" && !detail && <section className="requests"><div className="workspace-title"><div><p className="eyebrow">Your transport, at a glance</p><h1>Your transports</h1></div><div className="tabs"><button className="selected">Active</button><button>Completed</button></div></div><div className="rows"><RequestRow onClick={() => setDetail(true)} /><RequestRow booked onClick={() => {setAccepted(true);setDetail(true);}} /></div></section>}
    {view === "requests" && detail && <RequestDetail accepted={accepted} sort={sort} onSort={setSort} offers={list} onBack={() => setDetail(false)} onOpenProfile={setOffer} onMessage={() => go("messages")} onAccept={setOffer} onTracking={() => nav("/tracking")} onReview={() => go("review")} />}
    {view === "messages" && <Messages onAccept={() => setOffer(OFFERS[0])} />}
    {view === "profile" && <CustomerProfile />}
    {view === "review" && <Review onDone={() => {go("requests");setDetail(false);}} />}
  </main>{offer && <OfferDialog offer={offer} onClose={() => setOffer(null)} onAccept={() => {setAccepted(true);setOffer(null);}} onMessage={() => {setOffer(null);go("messages");}} />}</div>;
}

function RequestDetail({ accepted, sort, onSort, offers, onBack, onOpenProfile, onMessage, onAccept, onTracking, onReview }: { accepted: boolean; sort: string; onSort: (x:string) => void; offers: Offer[]; onBack: () => void; onOpenProfile: (x:Offer)=>void; onMessage:()=>void; onAccept:(x:Offer)=>void; onTracking:()=>void; onReview:()=>void }) {
  return <section className="request-detail"><button className="back" onClick={onBack}>← Your transports</button><header><div><p className="eyebrow">{accepted ? "Carrier booked" : "3 offers received"}</p><h1>Bed slats</h1><p>IKEA Zagreb <i>→</i> Trešnjevka</p></div><span className={`status large ${accepted ? "booked" : ""}`}>{accepted ? "Carrier booked" : "Looking for carriers"}</span></header><div className="detail-layout"><aside><ItemImage /><h3>Request summary</h3><dl><div><dt>Route</dt><dd>IKEA Zagreb → Trešnjevka</dd></div><div><dt>Distance</dt><dd>12 km</dd></div><div><dt>Timing</dt><dd>Flexible pickup</dd></div><div><dt>Loading</dt><dd>No help required</dd></div></dl><div className="mini-map"><RouteLine /><b>12 km</b></div></aside><div className="primary-detail">{accepted ? <Accepted onTracking={onTracking} onReview={onReview} /> : <><div className="offers-heading"><div><h2>Choose a carrier</h2><p>Compare price, availability and previous reviews.</p></div><div className="sort">{["Recommended","Lowest price","Earliest pickup"].map(x => <button className={sort === x ? "selected" : ""} onClick={() => onSort(x)} key={x}>{x}</button>)}</div></div>{offers.map(o => <OfferCard key={o.name} offer={o} onProfile={() => onOpenProfile(o)} onMessage={onMessage} onAccept={() => onAccept(o)} />)}</>}</div></div></section>;
}

function OfferCard({ offer, onProfile, onMessage, onAccept }: { offer: Offer; onProfile:()=>void;onMessage:()=>void;onAccept:()=>void }) {
  return <article className="offer"><button onClick={onProfile}><Avatar offer={offer} /></button><div className="offer-person"><button onClick={onProfile}>{offer.name}</button><span>★ {offer.rating} · {offer.jobs}</span><small>{offer.vehicle}</small></div><div className="offer-time"><b>{offer.time}</b><span>Available window</span></div><p>“{offer.note}”</p><div className="price"><b>{offer.price}</b><span>all in</span></div><div className="offer-actions"><button onClick={onMessage}>Message</button><button onClick={onProfile}>View profile</button><button className="button moss short" onClick={onAccept}>Accept</button></div></article>;
}

function OfferDialog({ offer, onClose, onAccept, onMessage }: { offer: Offer; onClose:()=>void;onAccept:()=>void;onMessage:()=>void }) {
  const [profile, setProfile] = useState(true);
  return <div className="overlay">{profile ? <aside className="side"><button className="close" onClick={onClose}>×</button><div className="profile-head"><Avatar offer={offer} large /><div><p className="eyebrow">Verified carrier</p><h2>{offer.name}</h2><p>★ {offer.rating} · {offer.jobs} completed</p></div></div><p>I move furniture and store purchases around Zagreb with a clean, fully-equipped large van. Clear communication, careful handling.</p><section><h3>Vehicle</h3><div className="vehicle">▰ <div><b>{offer.vehicle}</b><span>Large van · 3.2m cargo length</span></div></div></section><section><h3>Previous work</h3><div className="work-shots"><span /><span /><span /></div></section><blockquote>“On time, careful with everything, and a genuinely nice person.”<footer>— Ana, verified customer</footer></blockquote><footer className="side-actions"><button className="button ghost" onClick={onMessage}>Message</button><button className="button moss" onClick={() => setProfile(false)}>Accept {offer.price}</button></footer></aside> : <div className="confirm"><button className="close" onClick={onClose}>×</button><p className="eyebrow">Confirm carrier</p><h2>Choose {offer.name} for this transport?</h2><div><b>{offer.price}</b><span>IKEA Zagreb → Trešnjevka</span><span>{offer.time}</span></div><p>After accepting, you and the carrier will be able to see each other’s contact information.</p><footer><button className="button ghost" onClick={() => setProfile(true)}>Cancel</button><button className="button moss" onClick={onAccept}>Accept offer</button></footer></div>}</div>;
}

function Accepted({ onTracking, onReview }: { onTracking:()=>void;onReview:()=>void }) {
  return <div className="accepted"><section className="booked-card"><Avatar large /><div><p className="eyebrow">Your carrier</p><h2>Mario M.</h2><p>★ 4.9 · Renault Master</p></div><div><a href="tel:+385915552400">+385 91 555 2400</a><a href="mailto:mario@example.com">mario@example.com</a></div></section><div className="transport-steps"><div className="done"><b>✓</b><span><strong>Booked</strong><small>Mario accepted your transport.</small></span></div><div className="active"><b>●</b><span><strong>Pickup</strong><small>Today, 17:00–19:00</small></span></div><div><b>○</b><span><strong>In transit</strong><small>Live updates will appear here.</small></span></div><div><b>○</b><span><strong>Delivered</strong><small>Review the transport when it’s done.</small></span></div></div><div className="actions"><button className="button dark" onClick={onTracking}>Open delivery tracking <Arrow /></button><button className="quiet-link" onClick={onReview}>Preview review flow</button></div></div>;
}

function Messages({ onAccept }: { onAccept:()=>void }) {
  const [note, setNote] = useState(""); const [sent, setSent] = useState<string[]>([]);
  return <section className="messages-page"><header><p className="eyebrow">Keep it in one place</p><h1>Messages</h1></header><div className="messages"><aside><button className="conversation selected"><Avatar /><span><b>Mario M.</b><small>Sounds good—17:00 works.</small></span><i>2m</i></button><button className="conversation"><Avatar offer={OFFERS[1]} /><span><b>Luka P.</b><small>I can do tomorrow morning.</small></span><i>1h</i></button></aside><article><header><div><Avatar /><span><b>Mario M.</b><small>★ 4.9 · Renault Master</small></span></div><b className="offer-tag">Offer: €32</b></header><div className="chat-context"><span>Pickup: Today, 17:00–19:00</span><button className="button moss short" onClick={onAccept}>Accept offer</button></div><div className="thread"><p className="bubble theirs">Hi Ana, I’m already collecting an order near IKEA this afternoon. I can pick up the bed slats between 17:00–19:00.</p><p className="bubble mine">Great, that works. It’s ground floor pickup and the slats are already packed.</p><p className="contact-note">Contact information can be shared after an offer is accepted.</p>{sent.map(x => <p className="bubble mine" key={x}>{x}</p>)}</div><form onSubmit={event => {event.preventDefault();if(note.trim()){setSent([...sent,note.trim()]);setNote("");}}}><input value={note} onChange={event=>setNote(event.target.value)} placeholder="Write a message" /><button aria-label="Send">↑</button></form></article></div></section>;
}

function CustomerProfile() {
  return <section className="profile-page"><p className="eyebrow">Account</p><h1>Your profile</h1><div className="profile-head"><span className="avatar customer large">AN</span><div><h2>Ana Novak</h2><p>ana.novak@example.com · +385 91 555 2400</p><button className="quiet-link">Edit profile</button></div></div><div className="setting-list"><button>Notifications <i>›</i></button><button>Payment methods <i>›</i></button><button>Help and safety <i>›</i></button></div></section>;
}

function Review({ onDone }: { onDone:()=>void }) {
  const [rating, setRating] = useState(5);
  return <section className="review"><p className="eyebrow">Transport complete</p><h1>How did it go?</h1><div className="profile-head"><Avatar large /><div><h2>Mario M.</h2><p>Bed slats · IKEA Zagreb → Trešnjevka</p></div></div><div className="stars">{[1,2,3,4,5].map(n => <button className={n <= rating ? "on" : ""} onClick={()=>setRating(n)} key={n}>★</button>)}</div><div className="tags">{["On time","Great communication","Careful handling","Friendly"].map(x => <button key={x}>{x}</button>)}</div><label><textarea placeholder="Add a short comment (optional)" /></label><button className="button moss" onClick={onDone}>Submit review</button></section>;
}

export function Tracking() {
  return <div className="tracking"><header><Mark /><span>Private delivery tracking</span></header><main><p className="eyebrow">Bed slats · 12 km</p><h1>Your delivery is on the way.</h1><div className="tracking-map"><RouteLine /><i>●</i><b className="map-pickup">IKEA Zagreb</b><b className="map-delivery">Trešnjevka</b></div><section className="eta"><div><Avatar /><span><b>Mario M.</b><small>Renault Master</small></span></div><div><span>Estimated arrival</span><b>18:42</b></div></section><div className="transport-steps tracking-list"><div className="done"><b>✓</b><span><strong>Picked up</strong><small>17:28 — Mario has your item.</small></span></div><div className="active"><b>●</b><span><strong>In transit</strong><small>18:04 — Heavy traffic. ETA updated by 12 minutes.</small></span></div><div><b>○</b><span><strong>Delivered</strong><small>We’ll let you know when it arrives.</small></span></div></div></main></div>;
}

function JobCard({ onOpen, compact = false }: { onOpen:()=>void;compact?:boolean }) {
  return <article className={`job ${compact ? "compact" : ""}`}><ItemImage /><div><h3>Bed slats</h3><p>IKEA Zagreb <i>→</i> Trešnjevka</p><span>12 km</span><span>Flexible</span><span>No loading help</span></div>{!compact && <b>3 offers</b>}<button className="button dark short" onClick={onOpen}>View job</button></article>;
}

export function CarrierWorkspace() {
  const loc = useLocation(); const nav = useNavigate(); const derive = () => loc.pathname.includes("offers")?"offers":loc.pathname.includes("active")?"active":loc.pathname.includes("messages")?"messages":loc.pathname.includes("wallet")?"wallet":loc.pathname.includes("vehicles")?"vehicles":loc.pathname.includes("profile")?"profile":"jobs"; const [view,setView] = useState(derive()); const [job,setJob]=useState(false); const [offer,setOffer]=useState(false); const [stage,setStage]=useState(0); const [share,setShare]=useState(false); const go=(x:string)=>{setView(x);nav(x==="jobs"?"/carrier":`/carrier/${x}`);};
  return <div className="app"><Topbar kind="carrier" active={view}/><main className="workspace">
    {view==="jobs" && !job && <section className="jobs"><div className="workspace-title"><div><p className="eyebrow">Near Zagreb</p><h1>Available transports</h1></div><div className="filters"><button>Pickup area</button><button>Destination</button><button>Date</button><button>Category</button></div></div><JobCard onOpen={()=>setJob(true)}/><JobCard onOpen={()=>setJob(true)}/><JobCard onOpen={()=>setJob(true)}/></section>}
    {view==="jobs" && job && !offer && <JobDetail onBack={()=>setJob(false)} onOffer={()=>setOffer(true)}/>}
    {view==="jobs" && offer && <MakeOffer onBack={()=>setOffer(false)} onSend={()=>{setOffer(false);go("offers");}}/>}
    {view==="offers" && <MyOffers onOpen={()=>{go("jobs");setJob(true);}}/>}
    {view==="messages" && <Messages onAccept={()=>go("active")}/>}
    {view==="active" && <ActiveDelivery stage={stage} onNext={()=>setStage(Math.min(stage+1,3))} share={share} onShare={()=>setShare(!share)}/>}
    {view==="wallet" && <Wallet/>}
    {view==="profile" && <CarrierProfile onVehicles={()=>go("vehicles")}/>}
    {view==="vehicles" && <Vehicles onBack={()=>go("profile")}/>}
  </main></div>;
}

function JobDetail({onBack,onOffer}:{onBack:()=>void;onOffer:()=>void}){return <section className="job-detail"><button className="back" onClick={onBack}>← Available transports</button><header><div><p className="eyebrow">Furniture · Flexible</p><h1>Bed slats</h1><p>IKEA Zagreb <i>→</i> Trešnjevka</p></div><b>12 km</b></header><div className="job-layout"><div><div className="detail-map"><RouteLine /><span>IKEA Zagreb</span><span>Trešnjevka</span></div><section><h2>What you’re moving</h2><p>Bed slats, already packed. No loading help required.</p><div className="photo-row"><ItemImage type="photo"/><ItemImage type="photo"/></div></section><section className="info-split"><div><span>Pickup</span><b>Flexible · Ground floor</b></div><div><span>Delivery</span><b>Trešnjevka · Elevator available</b></div></section></div><aside><p className="eyebrow">Interested?</p><h2>Make a clear offer.</h2><p>Tell the customer your price and when you can do it.</p><button className="button moss full" onClick={onOffer}>Make an offer <Arrow /></button></aside></div><button className="button moss mobile-sticky" onClick={onOffer}>Make an offer</button></section>}

function MakeOffer({onBack,onSend}:{onBack:()=>void;onSend:()=>void}){return <section className="make-offer"><button className="back" onClick={onBack}>← Job details</button><p className="eyebrow">Bed slats · IKEA Zagreb → Trešnjevka</p><h1>Your offer</h1><div><label className="price-input">€<input defaultValue="32"/></label><label>Pickup availability<select><option>Today, 17:00–19:00</option><option>Tomorrow, 10:00–12:00</option></select></label><label>Delivery estimate<select><option>Within 45 minutes of pickup</option><option>Within 1 hour of pickup</option></select></label><label>Vehicle<select><option>Renault Master · Large van</option></select></label><label>Message <em>Optional</em><textarea defaultValue="I’m already driving through this area tomorrow afternoon."/></label><button className="button moss full" onClick={onSend}>Send offer <Arrow /></button></div></section>}

function MyOffers({onOpen}:{onOpen:()=>void}){return <section className="my-offers"><div className="workspace-title"><div><p className="eyebrow">Keep an eye on it</p><h1>My offers</h1></div><div className="tabs"><button className="selected">Pending</button><button>Accepted</button><button>Past</button></div></div><article><ItemImage/><div><h3>Bed slats</h3><p>IKEA Zagreb → Trešnjevka</p></div><strong>€32</strong><span className="status">Waiting for customer</span><button className="button dark short" onClick={onOpen}>Open</button></article></section>}

function ActiveDelivery({stage,onNext,share,onShare}:{stage:number;onNext:()=>void;share:boolean;onShare:()=>void}){const title=["Heading to pickup","At pickup","Item collected","On the way"][stage];const action=["I’ve arrived","Item collected","Start delivery","Mark as delivered"][stage];return <section className="active-delivery"><p className="eyebrow">Active transport</p><h1>{title}</h1><div className="active-meta"><div><span>Customer</span><b>Ana Novak</b><a href="tel:+385915552400">+385 91 555 2400</a></div><div><span>Route</span><b>IKEA Zagreb → Trešnjevka</b><button>Open navigation ↗</button></div></div><div className="active-map"><RouteLine/><i>●</i></div><div className="share"><div><b>Share live location with customer</b><p>Your customer will receive a private tracking link until delivery is completed.</p></div><button className={share?"switch on":"switch"} onClick={onShare}><span/></button></div><div className="update-buttons"><button>Traffic</button><button>Pickup delay</button><button>Customer unavailable</button><button>Other</button></div><button className="button moss delivery-action" onClick={onNext}>{action}</button></section>}

function Wallet(){const [open,setOpen]=useState(false);const[amount,setAmount]=useState("50");return <section className="wallet"><p className="eyebrow">Your funds</p><h1>Balance</h1><strong>€42.50</strong><button className="button moss" onClick={()=>setOpen(!open)}>Add funds <Arrow /></button>{open&&<div className="checkout"><h2>Add funds</h2><div>{["10","25","50","100"].map(x=><button className={amount===x?"selected":""} onClick={()=>setAmount(x)} key={x}>€{x}</button>)}<label>€<input value={amount} onChange={e=>setAmount(e.target.value)}/></label></div><label>Payment method<select><option>Visa ending in 2400</option><option>New card</option></select></label><button className="button dark full">Add €{amount}</button></div>}<article className="activity"><h2>Recent activity</h2><div><span><b>€50.00</b><small>Balance top-up</small></span><time>Today</time></div><div><span><b>− €4.80</b><small>Commission — Bed slats transport</small></span><time>Aug 18</time></div></article></section>}

function CarrierProfile({onVehicles}:{onVehicles:()=>void}){return <section className="carrier-profile"><div className="profile-head"><Avatar large/><div><p className="eyebrow">Verified carrier</p><h1>Mario M.</h1><p>★ 4.9 · 127 completed transports</p></div></div><p>I’m an independent carrier in Zagreb. I care about being on time, communicating clearly, and delivering everything in the condition it left.</p><section><header><h2>Vehicles</h2><button className="quiet-link" onClick={onVehicles}>Manage</button></header><div className="vehicle">▰ <div><b>Renault Master</b><span>Large Van · 3.2m cargo length · 1,350kg payload</span></div></div></section><section><h2>Reviews</h2><blockquote>“Mario was early, thoughtful and took great care with the furniture.”<footer>— Petra, verified customer</footer></blockquote></section></section>}

function Vehicles({onBack}:{onBack:()=>void}){return <section className="vehicles"><button className="back" onClick={onBack}>← Carrier profile</button><header><div><p className="eyebrow">Your equipment</p><h1>Vehicles</h1></div><button className="button dark short">Add vehicle</button></header><div className="vehicle manager">▰ <div><b>Renault Master</b><span>Large Van</span><small>3.2m cargo length · 1.7m width · 1,350kg payload</small></div><p><button>Edit</button><button className="danger">Remove</button></p></div></section>}
