import { TERMS_VERSION } from "../lib/legal";
import { Link } from "react-router-dom";

type LegalDocument = "privacy" | "cookies" | "terms" | "impressum";
type Language = "en" | "hr";

/**
 * VanScout legal pages — liability-focused revision, 6 November 2026.
 *
 * IMPORTANT — VERIFY AGAINST PRODUCTION BEFORE PUBLISHING:
 * 1. Operator identity, registered address and MBO against the official Crafts Register.
 * 2. Whether carriers may be private individuals or only registered businesses.
 * 3. Fee calculation (5%, rounding, when both parties confirm), credit purchases,
 *    cancellations, refunds and Stripe invoice issuer against the actual checkout flow.
 * 4. Actual cookies/local storage and any third-party SDKs via a browser/network audit.
 * 5. Data visibility, 730-day chat retention, security measures, service providers,
 *    cross-border transfers and the data export/deletion features against production.
 * 6. DSA notice-and-action, moderation appeal and consumer complaints operations.
 * 7. Confirm that both users separately accept before both email addresses and phone
 *    numbers are released, and that the Carrier fee is taken at that connection event.
 *    Check that the UI discloses both effects before confirmation, and that technical
 *    failures of contact release do not cause an unrecoverable fee charge.
 *    Mutual acceptance may itself form a transport contract between users as a matter
 *    of law, even though VanScout never becomes a party to that contract.
 * 8. Confirm business-user ranking/search display and any paid promotion; EU P2B and
 *    consumer marketplace law may require feature-specific disclosures in the interface.
 * 9. If applicable, P2B business-user notice periods, DSA hosting notice-and-action,
 *    consumer cancellation flow, and required trader identity checks must be operational.
 * 10. Since 19 June 2026, where a consumer has a statutory withdrawal right from a
 *     contract concluded via the online interface, Croatian law requires an accessible
 *     online withdrawal function and a durable-medium receipt; emailing alone is not enough.
 * 11. Check checkout payment labels, correction of input, order confirmations and
 *     withdrawal information/model form under Croatian e-commerce/consumer law.
 * 12. Bump TERMS_VERSION in ../lib/legal when publishing materially revised Terms.
 * This component provides legal information, but does not itself implement those duties.
 * It is not a substitute for a Croatian lawyer's final review.
 */
const operator = {
  // Copied from the supplied original; the identity has not been independently verified.
  name: "STRIVE, obrt za računalno programiranje, vl. Antonio Butković, Đakovo, Vinkovačka 13",
  address: "Vinkovačka 13, 31400 Đakovo, Republika Hrvatska",
  registrationAuthority: "Upravni odjel za gospodarstvo i turizam Đakovo",
  // This is an MBO (matični broj obrta), not an MBS (company court-register number).
  mbo: "98284908",
  email: "info@van-scout.com",
};

const revisedHr = "6. studenoga 2026.";
const revisedEn = "6 November 2026";
const mailto = `mailto:${operator.email}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
function Email() {
  return <a href={mailto}>{operator.email}</a>;
}

function Privacy({ language }: { language: Language }) {
  if (language === "hr") return <>
    <Section title="1. Tko je voditelj obrade">
      <p>Voditelj obrade osobnih podataka koji se obrađuju radi pružanja platforme VanScout jest {operator.name} (dalje: „VanScout” ili „mi”). Adresa i registracijski podaci navedeni su u <Link to="/impressum">Impressumu</Link>. Za pitanja o privatnosti i ostvarivanje svojih prava pišite na <Email />.</p>
      <p>Kada prijevoznik preuzme podatke potrebne za samostalno organiziranje i izvršenje prijevoza, za vlastitu obradu tih podataka može djelovati kao zaseban voditelj obrade. U tom se slučaju primjenjuju i njegove obveze u pogledu zaštite podataka.</p>
    </Section>
    <Section title="2. Koje podatke obrađujemo i odakle ih dobivamo">
      <ul>
        <li><strong>Račun i prijava:</strong> ime, e-mail adresa, korisnička uloga, hash lozinke, status potvrde e-maila i telefonski broj; ako odaberete prijavu Googleom, odgovarajući Google identifikator i podaci profila koje nam pružite.</li>
        <li><strong>Zahtjevi i prijevozi:</strong> adrese i koordinate preuzimanja i dostave, opis predmeta, fotografije, upute, željeni termin, podaci o ponudi, cijeni i statusu te ostale informacije koje sami unesete.</li>
        <li><strong>Prijevoznici:</strong> podaci profila, poslovni status, podaci o vozilima, relacije, raspoloživost i druge informacije koje prijevoznik unese.</li>
        <li><strong>Komunikacija i povjerenje:</strong> sadržaj poruka, recenzije, prijave nepravilnosti i komunikacija s podrškom.</li>
        <li><strong>Naplate i krediti:</strong> kupljeni i iskorišteni krediti, iznosi, statusi uplata, podaci za izdavanje računa i identifikatori transakcija kod Stripea. Brojeve platnih kartica ne pohranjujemo.</li>
        <li><strong>Tehnički podaci:</strong> podaci o sesiji, sigurnosni i tehnički zapisi te, ako uključite obavijesti, podaci potrebni za njihovu dostavu.</li>
      </ul>
      <p>Većinu podataka dobivamo izravno od vas, a podatke o prijavi, potvrdi telefona i plaćanju u odgovarajućem opsegu od pružatelja tih usluga. Nemojte u opise, fotografije ili poruke unositi osjetljive osobne podatke, podatke djece ili tuđe podatke koji nisu potrebni za prijevoz.</p>
    </Section>
    <Section title="3. Zašto obrađujemo podatke i na kojoj osnovi">
      <ul>
        <li><strong>Izvršavanje ugovora i predugovorne radnje (čl. 6. st. 1. t. b GDPR-a):</strong> otvaranje i upravljanje računom, provjera pristupa, objava zahtjeva, dostava ponuda, komunikacija sudionika, obostrano potvrđivanje povezivanja, razmjenu e-mail adresa i telefonskih brojeva između potvrđenog naručitelja i prijevoznika te obračun i korištenje kredita.</li>
        <li><strong>Zakonske obveze (čl. 6. st. 1. t. c):</strong> izdavanje i čuvanje poslovne dokumentacije, porezne i računovodstvene obveze te postupanje po zakonitim zahtjevima nadležnih tijela.</li>
        <li><strong>Legitimni interesi (čl. 6. st. 1. t. f):</strong> zaštita od prijevara i zlouporaba, sigurnost usluge, otklanjanje grešaka, obrana i ostvarivanje pravnih zahtjeva te postupanje po prijavama spornih sadržaja. Pri tome uzimamo u obzir prava i interese korisnika.</li>
        <li><strong>Privola, kada je potrebna (čl. 6. st. 1. t. a):</strong> primjerice za buduće neobvezne analitičke ili marketinške tehnologije, ako ih uvedemo. Takvu privolu možete povući bez utjecaja na zakonitost prethodne obrade.</li>
      </ul>
      <p>Push obavijesti možete uključiti i isključiti u dostupnim postavkama ili pregledniku. Dopuštenje preglednika samo po sebi nije zamjena za privolu kada je ona zakonom potrebna. Podaci označeni kao obvezni potrebni su za račun ili određenu značajku; bez njih je možda nećete moći koristiti. Ne prodajemo osobne podatke i ne donosimo odluke isključivo automatiziranom obradom koje proizvode pravne ili slično značajne učinke.</p>
    </Section>
    <Section title="4. Tko može vidjeti podatke i kome ih otkrivamo">
      <p>Podaci o zahtjevu i ponudi prikazuju se korisnicima u opsegu potrebnom da procijene i ponude prijevoz. Sudionici razgovora vide poruke koje su im upućene. <strong>Tek nakon što naručitelj i odabrani prijevoznik oboje potvrde povezivanje, VanScout otkriva njihovu e-mail adresu i telefonski broj jedno drugome</strong> radi izravnog dogovora i provedbe prijevoza. Samo slanje ili primanje ponude ne znači da će kontaktni podaci biti otkriveni drugoj strani. Kontaktni podaci koji su samostalno upisani u javno vidljive opise ili poruke mogu biti vidljivi i ranije, pa nemojte objavljivati podatke koje ne želite podijeliti.</p>
      <p>Nakon razmjene kontaktnih podataka naručitelj i prijevoznik mogu komunicirati izvan platforme. VanScout ne upravlja njihovom naknadnom komunikacijom. Svaka strana smije koristiti primljene kontaktne podatke samo za zakonitu komunikaciju u vezi s konkretnim upitom/prijevozom, a za samostalnu obradu u vlastite svrhe odgovara u skladu s primjenjivim propisima.</p>
      <p>Za pružanje usluge koristimo pružatelje kao što su Vercel (hosting), Neon/AWS (baza podataka), Ably (komunikacija u stvarnom vremenu), Google i Firebase (prijava i potvrda telefona), Stripe (naplata), Zoho (e-mail) te Geoapify (pretraga adresa i lokacija). Ti pružatelji mogu djelovati kao izvršitelji obrade ili samostalni voditelji obrade, ovisno o usluzi i svojim uvjetima. S izvršiteljima obrade sklapaju se potrebni ugovori prema članku 28. GDPR-a.</p>
      <p>Podatke možemo otkriti i ovlaštenim savjetnicima ili tijelima kada postoji odgovarajuća pravna osnova. Ne objavljujemo podatke korisnika trećima radi njihove samostalne oglašivačke uporabe.</p>
    </Section>
    <Section title="5. Prijenos podataka izvan Europskoga gospodarskog prostora">
      <p>Određeni pružatelji i njihovi podizvršitelji mogu obrađivati podatke izvan Europskoga gospodarskog prostora (EGP). Kada se takav prijenos odvija, mora postojati odgovarajuća osnova, primjerice odluka o primjerenosti zaštite ili standardne ugovorne klauzule uz potrebne dodatne zaštitne mjere. Informacije o primjenjivom mehanizmu i dostupnoj kopiji mjera možete zatražiti na <Email />.</p>
    </Section>
    <Section title="6. Koliko dugo čuvamo podatke">
      <p>Sadržaj poruka i tekstualnih poruka uz ponude automatski se briše nakon 730 dana, prema postojećim pravilima usluge. Podatke računa čuvamo dok je račun aktivan, a nakon njegova brisanja samo kada je određeno dulje čuvanje potrebno radi zakona, ostvarivanja ili obrane zahtjeva ili sigurnosti. Podaci o poslovima i prijavama čuvaju se onoliko koliko je potrebno za te svrhe i primjenjive zastarne ili zakonske rokove. Računovodstvene i porezne isprave čuvaju se u zakonskim rokovima; istekli kodovi za potvrdu i resetiranje uklanjaju se prema pravilima sustava. Sigurnosne kopije istječu prema ciklusu pružatelja usluga.</p>
    </Section>
    <Section title="7. Sigurnost i privatnost poruka">
      <p>Zaštita prijenosa temelji se na TLS-u. Prema postojećoj implementaciji, sadržaj novih poruka u razgovorima i poruka uz ponude dodatno se šifrira na aplikacijskoj razini algoritmom AES-256-GCM, a pružatelj infrastrukture štiti i pohranjene podatke. To nije šifriranje s kraja na kraj: ovlašteni sustavi VanScouta mogu dešifrirati sadržaj kada je to potrebno radi rada platforme, podrške, sigurnosti ili zakonskih obveza. Pristup osoblja ograničavamo prema potrebi i ovlastima.</p>
    </Section>
    <Section title="8. Vaša prava">
      <p>U granicama GDPR-a imate pravo na pristup, ispravak, brisanje, ograničenje obrade, prenosivost podataka i prigovor na obradu koja se temelji na legitimnom interesu te pravo na povlačenje privole. Ako su te mogućnosti dostupne u profilu, ondje možete zatražiti preuzimanje podataka ili brisanje računa; u svakom slučaju možete pisati na <Email />. Na zahtjeve odgovaramo bez nepotrebnog odgađanja, u pravilu u roku od mjesec dana, uz zakonom dopuštena produljenja.</p>
      <p>Imate pravo podnijeti pritužbu Agenciji za zaštitu osobnih podataka (<a href="https://azop.hr" rel="noreferrer">AZOP</a>) ili drugom nadležnom nadzornom tijelu.</p>
    </Section>
    <Section title="9. Maloljetnici i izmjene obavijesti">
      <p>VanScout je namijenjen osobama starijima od 18 godina. Ovu obavijest ažuriramo kada se promijene relevantne funkcionalnosti, obrade ili pravni zahtjevi. O značajnim promjenama obavijestit ćemo korisnike na primjeren način. Zadnje ažuriranje: {revisedHr}</p>
    </Section>
  </>;

  return <>
    <Section title="1. Who controls your personal data">
      <p>The controller of personal data processed to provide VanScout is {operator.name} ("VanScout", "we" or "us"). Our address and registration details appear in the <Link to="/impressum">Impressum</Link>. For privacy requests and questions contact <Email />.</p>
      <p>When a carrier obtains details needed to arrange or perform a transport independently, that carrier may act as a separate controller for its own processing and is responsible for its own data-protection obligations.</p>
    </Section>
    <Section title="2. Data we process and where it comes from">
      <ul>
        <li><strong>Account and sign-in:</strong> name, email, user role, password hash, email verification status, phone number and, if you choose Google sign-in, the relevant Google identifier and profile data you provide.</li>
        <li><strong>Requests and transport:</strong> pickup and delivery addresses and coordinates, item descriptions, photographs, instructions, preferred dates, offers, prices, statuses and other information you enter.</li>
        <li><strong>Carrier details:</strong> profile, business status, vehicles, routes, availability and other information supplied by the carrier.</li>
        <li><strong>Communications and trust:</strong> messages, reviews, reports of misuse and support correspondence.</li>
        <li><strong>Payments and credits:</strong> credit purchases and deductions, amounts, payment status, invoice details and Stripe transaction identifiers. We do not store payment card numbers.</li>
        <li><strong>Technical data:</strong> session information, technical and security logs and, if enabled, information needed to deliver notifications.</li>
      </ul>
      <p>Most data comes directly from you; authentication, phone-verification and payment providers supply relevant additional data. Do not include sensitive personal data, children's information or unnecessary third-party data in descriptions, photos or messages.</p>
    </Section>
    <Section title="3. Purposes and legal bases">
      <ul>
        <li><strong>Contract or pre-contractual steps (GDPR Article 6(1)(b)):</strong> account creation and administration, access verification, publishing requests, delivering offers, communication, mutual matching confirmations, disclosure of email addresses and phone numbers to the matched Requester and Carrier, and calculating or using credits.</li>
        <li><strong>Legal obligations (Article 6(1)(c)):</strong> accounting and tax records, legally required business documentation and responding to valid legal requests.</li>
        <li><strong>Legitimate interests (Article 6(1)(f)):</strong> preventing fraud and misuse, securing the service, diagnosing issues, defending legal claims and handling reports of problematic content, taking users' rights into account.</li>
        <li><strong>Consent where required (Article 6(1)(a)):</strong> for example, if optional analytics or marketing technologies are introduced. Consent may be withdrawn without affecting earlier lawful processing.</li>
      </ul>
      <p>Push notifications can be enabled or disabled in the available settings or browser. Browser permission alone is not a substitute for consent where the law requires it. Required fields are necessary for the relevant account or feature. We do not sell personal data or use solely automated decision-making that produces legal or similarly significant effects.</p>
    </Section>
    <Section title="4. Visibility and recipients">
      <p>Request and offer information is visible to users as necessary to assess and offer transport. Conversation participants see messages addressed to them. <strong>Only after the Requester and the selected Carrier have both confirmed the connection does VanScout disclose their email addresses and phone numbers to one another</strong> so that they can communicate directly about the transport. Submitting or receiving an offer alone does not disclose those contact details to the other party. Contact information you independently put in visible listings or messages may be visible earlier, so avoid posting information you do not wish to share.</p>
      <p>After contact details are exchanged, Requesters and Carriers may communicate outside the Platform. VanScout does not control those later communications. Each party must use the contact details received only for lawful communications concerning the particular request/transport, and is responsible under applicable law for any separate processing for its own purposes.</p>
      <p>Providers supporting the service include Vercel (hosting), Neon/AWS (database), Ably (real-time communications), Google and Firebase (sign-in and phone verification), Stripe (payment processing), Zoho (email) and Geoapify (address/location search). Depending on the service and their terms, they may be processors or independent controllers. We maintain appropriate Article 28 agreements where a provider acts as a processor.</p>
      <p>Information may also be disclosed to authorised advisers or public authorities where legally justified. We do not disclose users' details to third parties for their independent advertising purposes.</p>
    </Section>
    <Section title="5. Transfers outside the EEA">
      <p>Some service providers or subprocessors may process information outside the European Economic Area (EEA). Such transfers require an appropriate mechanism, such as an adequacy decision or Standard Contractual Clauses with any necessary supplementary measures. Request information about applicable safeguards and available copies at <Email />.</p>
    </Section>
    <Section title="6. Retention">
      <p>Chat content and text messages attached to offers are automatically deleted after 730 days under the service's existing retention rules. Account data is generally kept while an account remains active; following deletion, some information may still need to be retained for legal obligations, legal claims or security. Transport and report records are kept as needed for those purposes and applicable limitation or statutory periods. Accounting and tax records follow statutory retention requirements; expired verification/reset records are removed under system rules. Backups expire under providers' backup cycles.</p>
    </Section>
    <Section title="7. Security and message privacy">
      <p>Data in transit is protected using TLS. Under the existing implementation, new chat and offer-message content is additionally encrypted at the application layer using AES-256-GCM, and infrastructure providers protect stored data. This is not end-to-end encryption: authorised VanScout systems can decrypt content when necessary to operate the service, provide support, protect users or comply with the law. Staff access is restricted according to need and authorisation.</p>
    </Section>
    <Section title="8. Your rights">
      <p>Subject to GDPR conditions, you may request access, rectification, erasure, restriction, portability and object to processing based on legitimate interests. You may also withdraw consent. Where available, you can export data or request account deletion in your profile; you can always contact <Email />. We respond without undue delay, usually within one month, subject to legally permitted extensions.</p>
      <p>You may complain to the Croatian Personal Data Protection Agency (<a href="https://azop.hr" rel="noreferrer">AZOP</a>) or another competent supervisory authority.</p>
    </Section>
    <Section title="9. Minors and updates">
      <p>VanScout is intended for users aged 18 or older. We update this notice when relevant features, processing or legal requirements change and communicate significant changes appropriately. Last updated: {revisedEn}.</p>
    </Section>
  </>;
}

function Cookies({ language }: { language: Language }) {
  if (language === "hr") return <>
    <Section title="1. Što koristimo">
      <p>Kolačići su mali zapisi koje preglednik pohranjuje na uređaj. VanScout prema trenutačnoj konfiguraciji ne koristi analitičke ni oglašivačke kolačiće. Za prijavu i pamćenje izričito odabranog jezika koristimo sljedeće kolačiće i lokalnu pohranu:</p>
      <ul>
        <li><strong>vanscout_session</strong> — HttpOnly kolačić za održavanje prijave; najdulje 8 sati.</li>
        <li><strong>vanscout-language</strong> — pamti izabrani jezik sučelja; do jedne godine.</li>
        <li><strong>vanscout-language-preference</strong> — zapis u lokalnoj pohrani (localStorage) koji pamti izričito odabrani jezik; do brisanja te pohrane ili promjene postavke.</li>
      </ul>
      <p>Ovi se zapisi koriste za prijavu ili postavku koju ste zatražili, a ne za profiliranje. Za takve strogo nužne tehnologije prethodna privola nije potrebna.</p>
    </Section>
    <Section title="2. Usluge trećih strana">
      <p>Pri pokretanju Google prijave ili Firebase potvrde telefona odgovarajući pružatelji mogu koristiti vlastite kolačiće ili pohranu. Kad otvorite Stripeovu stranicu za plaćanje, Stripe može koristiti tehnologije opisane u svojoj obavijesti. Ti pružatelji sami određuju dio obrade na svojim domenama; njihova se pravila primjenjuju uz naše informacije o privatnosti.</p>
    </Section>
    <Section title="3. Kako upravljati pohranom">
      <p>Kolačiće i lokalnu pohranu možete pregledati i izbrisati u postavkama preglednika. Brisanje sesijskog kolačića može vas odjaviti; brisanje jezičnih postavki može vratiti zadani jezik. Ako u budućnosti uvedemo analitičke, oglašivačke ili druge nenužne tehnologije, prethodno ćemo prikazati odgovarajući izbor privole i omogućiti njezino povlačenje.</p>
    </Section>
    <Section title="4. Kontakt i ažuriranja">
      <p>Za pitanja o kolačićima i obradi podataka pišite na <Email />. Zadnje ažuriranje: {revisedHr}</p>
    </Section>
  </>;
  return <>
    <Section title="1. What we use">
      <p>Cookies are small records saved by your browser. Under its current configuration, VanScout does not use analytics or advertising cookies. We use the following cookies and local storage for sign-in and an explicitly selected language:</p>
      <ul>
        <li><strong>vanscout_session</strong> — HttpOnly cookie maintaining sign-in; up to 8 hours.</li>
        <li><strong>vanscout-language</strong> — remembers your chosen interface language; up to one year.</li>
        <li><strong>vanscout-language-preference</strong> — localStorage record remembering your explicit language selection; until that storage is cleared or the preference changes.</li>
      </ul>
      <p>These records support authentication or a preference you requested, rather than profiling. Prior consent is not required for these strictly necessary technologies.</p>
    </Section>
    <Section title="2. Third-party services">
      <p>When you initiate Google sign-in or Firebase phone verification, those providers may use their own cookies or storage. When you open Stripe's payment page, Stripe may use technologies described in its own notice. These providers independently determine some processing on their domains; their policies apply alongside our privacy information.</p>
    </Section>
    <Section title="3. Managing storage">
      <p>You can inspect and clear cookies and local storage in your browser settings. Clearing the session cookie may sign you out; clearing language settings may restore the default language. If we introduce analytics, advertising or other non-essential technologies, we will first provide the required consent choices and allow consent to be withdrawn.</p>
    </Section>
    <Section title="4. Contact and updates">
      <p>For cookie or privacy questions contact <Email />. Last updated: {revisedEn}.</p>
    </Section>
  </>;
}

function Terms({ language }: { language: Language }) {
  if (language === "hr") return <>
    <Section title="1. Ugovorne strane, primjena i pojmovi">
      <p>Ovi Uvjeti uređuju korištenje digitalne platforme VanScout (dalje: „platforma”), kojom upravlja {operator.name} (dalje: „VanScout” ili „operator”). Podaci o operatoru dostupni su u <Link to="/impressum">Impressumu</Link>. Registracijom i izričitim prihvatom pristajete na Uvjete, verzija {TERMS_VERSION}. Za registraciju morate imati najmanje 18 godina.</p>
      <p>„Naručitelj” je osoba koja traži prijevoz; „prijevoznik” je korisnik koji samostalno nudi ili izvršava prijevoz; „posao” ili „prijevoz” označava zaseban odnos između tih korisnika. „Poslovni korisnik” djeluje u okviru vlastite gospodarske ili profesionalne djelatnosti. „Potrošač” ima značenje prema primjenjivom zakonu. Prihvaćanjem ovih Uvjeta sklapate ugovor o korištenju platforme s operatorom, a ne ugovor o prijevozu s operatorom.</p>
    </Section>
    <Section title="2. Ograničena uloga VanScouta">
      <p>VanScout pruža digitalnu uslugu objave zahtjeva, razmjene ponuda i poruka, obostrane potvrde povezivanja i otkrivanja kontaktnih podataka potvrđenim korisnicima. <strong>VanScout sam ne pruža prijevoz, utovar, istovar, pakiranje, skladištenje, špediciju, čuvanje stvari niti osiguranje tereta.</strong> Ne pregovaramo niti sklapamo ugovor o prijevozu u ime naručitelja ili prijevoznika, nismo njihov zastupnik, poslodavac, ugovorni jamac ni stranka njihova ugovora o prijevozu. Odgovaramo za vlastitu uslugu platforme samo u opsegu koji proizlazi iz naših obveza i primjenjivog prava.</p>
      <p>Prijevoznik samostalno odlučuje prihvaća li posao, po kojoj cijeni i pod kojim zakonitim uvjetima, organizira rad, bira vozilo i osoblje te snosi obveze koje proizlaze iz njegova poslovanja i ugovora s naručiteljem. VanScout nema opću obvezu nadzora svakog prijevoza ni obvezu provjeravati istinitost svakog korisničkog navoda. Ne jamčimo da će oglas rezultirati ponudom ili da će dogovoreni prijevoz biti obavljen.</p>
      <p>Naziv, opis, podatak o provjeri računa ili druge oznake na profilu ne predstavljaju preporuku, jamstvo kvalitete, sigurnosti, solvencije, osiguranja ni valjanosti svih dozvola. Ako je provedena pojedina provjera, ona se odnosi samo na izričito navedeni podatak i trenutak provjere. To ne isključuje zakonske obveze operatora u pogledu određenih provjera ili postupanja po saznanju o nezakonitosti.</p>
    </Section>
    <Section title="3. Račun, ovlaštenje i sigurnost">
      <p>Korisnik je dužan navesti istinite, potpune i ažurne podatke, čuvati pristupne podatke i bez odgode prijaviti sumnju na neovlašten pristup. Ako postupa za poslovni subjekt, jamči da je ovlašten za postupanje u njegovo ime. Zabranjeno je lažno predstavljanje, otvaranje računa radi prijevare ili davanje pristupa računu neovlaštenima.</p>
      <p>Odgovorni ste za radnje izvršene putem svojeg računa u mjeri u kojoj ih je moguće pripisati vama prema primjenjivom pravu. VanScout smije poduzeti razmjerne sigurnosne mjere i zatražiti dodatnu potvrdu podataka radi sprečavanja zlouporaba. Kontaktne podatke dobivene nakon povezivanja smijete koristiti za komunikaciju o konkretnom prijevozu, a ne za neželjeno oglašavanje, prodaju baza kontakata ili uznemiravanje.</p>
    </Section>
    <Section title="4. Točnost zahtjeva, ponuda i sadržaja">
      <p>Naručitelj mora prije dogovora jasno navesti vrstu i stanje predmeta, dimenzije, težinu, vrijednost, mjesta i uvjete pristupa, termin, potrebu za pomoćnim osobljem, način pakiranja i sve poznate posebne rizike. Prijevoznik je odgovoran za procjenu izvedivosti, nosivosti, opreme, dopuštenosti tereta i svih okolnosti nužnih za siguran prijevoz. Svaka strana mora prije prihvata razjasniti nejasnoće i dodatne troškove.</p>
      <p>Svaki korisnik odgovara za podatke, fotografije, ponude, recenzije i poruke koje objavljuje te za prava potrebna za njihovu uporabu. VanScout ne potvrđuje njihovu točnost, potpunost ni zakonitost samom objavom.</p>
    </Section>
    <Section title="5. Obostrana potvrda, kontakti i ugovor o prijevozu">
      <p>Naručitelj objavljuje zahtjev, a prijevoznik može poslati ponudu. <strong>Tek kada naručitelj i odabrani prijevoznik oboje potvrde povezivanje putem platforme, omogućujemo razmjenu njihove e-mail adrese i telefonskog broja.</strong> Time pružamo uslugu povezivanja kako bi se strane mogle izravno dogovoriti i organizirati prijevoz. VanScout ne ugovara prijevoz umjesto njih i ne sudjeluje kao stranka u daljnjim pregovorima ili izvršenju prijevoza.</p>
      <p>Objava zahtjeva ili samo slanje ponude ne stvara ugovor o prijevozu. Ovisno o sadržaju ponude, izjavama obiju strana i primjenjivom pravu, njihov obostrani prihvat putem platforme <strong>može imati pravni učinak sklapanja ugovora izravno između naručitelja i prijevoznika</strong>. Za nastanak takva ugovora nije potreban potpis VanScouta, koji ni u jednom trenutku ne postaje njegova stranka. Korisnici su odgovorni usuglasiti bitne uvjete, uključujući cijenu, poreze, termin, utovar, istovar, dodatne usluge, pakiranje i otkazivanje, te poštovati zakonom propisani oblik kada je potreban.</p>
      <p><strong>VanScout ne naplaćuje niti drži cijenu samog prijevoza i ne prima plaćanje za prijevoznika.</strong> Naručitelj plaća prijevozniku prema njihovu dogovoru, izvan VanScoutove naplate naknade za povezivanje. Prijevoznik odgovara za izdavanje računa ili druge isprave, poreze, povrate cijene prijevoza i izvršenje ugovora. Strane naknadno komuniciraju i dogovaraju detalje izravno; VanScout ne preuzima obvezu nadzirati njihovu komunikaciju, riješiti njihov spor ili osigurati izvršenje prijevoza. To ne umanjuje odgovornost VanScouta za vlastitu uslugu prema obveznim propisima.</p>
    </Section>
    <Section title="6. Samostalnost, registracija i osiguranje prijevoznika">
      <p>Prijevoznik je samostalan i nije zaposlenik, agent ni podizvođač VanScouta. Dužan je utvrditi i ispuniti sve propisane uvjete za posao koji prihvaća, uključujući registraciju djelatnosti, licencije, prometna pravila, osiguranje, ispravnost vozila, stručne kvalifikacije, poreze, zaštitu na radu i eventualne carinske ili druge obveze. Ne smije prihvatiti posao koji ne može zakonito ili sigurno izvršiti.</p>
      <p>Prijevoznik mora točno označiti djeluje li kao trgovac ili privatna osoba, ako je takav pristup platformi dopušten. Ako je prijevoznik privatna osoba, potrošačka pravila koja vrijede za ugovore s trgovcem u pravilu se ne primjenjuju na taj ugovor o prijevozu. Podatak o statusu temelji se na izjavi prijevoznika, osim u opsegu u kojem je izričito označena dodatna provjera. Prijevoznik na zakonit zahtjev mora dati dokumentaciju potrebnu za propisane provjere. Zadržavamo pravo odbiti ili ograničiti pristup zbog neispunjenih zakonskih uvjeta.</p>
    </Section>
    <Section title="7. Cijene, naknada VanScouta i unaprijed plaćeni krediti">
      <p>Prema trenutačnom modelu, prijevoznik kupuje unaprijed plaćene kredite namijenjene naknadama platforme. <strong>Kada naručitelj i odabrani prijevoznik oboje potvrde povezivanje, a platforma omogući razmjenu njihovih e-mail adresa i telefonskih brojeva, prijevozniku se obračunava jednokratna naknada od 5% prihvaćene ponuđene cijene, zaokružena na najbliži cent.</strong> Naknada se oduzima od njegovih raspoloživih kredita, a naručitelju VanScout ne naplaćuje naknadu za povezivanje. Iznos naknade i primjenjivi troškovi prikazuju se prije obvezujuće potvrde. Naknada je cijena pružene usluge povezivanja i pristupa kontaktima, a ne provizija za uspješno izvršen prijevoz, jamstvo plaćanja ili osiguranje tereta.</p>
      <p>Krediti predstavljaju ograničeno ugovorno pravo korištenja usluga platforme; nisu depozit za prijevoz, ne donose kamate, nisu namijenjeni prijenosu na druge račune niti zamjeni za gotovinu, osim kada obvezni propisi zahtijevaju drukčije. Kupnja kredita odvija se korištenjem platne infrastrukture Stripe. Račun za uslugu VanScouta izdaje operator, izravno ili putem sustava za fakturiranje. Cijena paketa i porezni tretman prikazuju se prije plaćanja. Ne jamčimo neprekidnu dostupnost bilo kojeg paketa, a promjene cijena ne djeluju retroaktivno na već kupljene kredite.</p>
      <p>Korisnici ne smiju umjetno prikazivati nepotvrđen posao, namjerno manipulirati iznosom prihvaćene ponude niti zloupotrebljavati funkcionalnosti radi izbjegavanja zakonito obračunate naknade. Ova odredba ne zabranjuje prijevoznicima oglašavanje ili rad putem drugih kanala, niti nameće paritet cijena.</p>
    </Section>
    <Section title="8. Otkazivanje, sporovi i povrat kredita">
      <p>Uvjeti otkazivanja prijevoza i moguće naknade između naručitelja i prijevoznika određuju se njihovim ugovorom i obveznim propisima. VanScout ne odlučuje o krivnji za neizvršeni prijevoz, naknadi za čekanje, oštećenju stvari ni povratu prijevozniku ili naručitelju plaćenog iznosa.</p>
      <p>Ako nije došlo do obostrane potvrde ili platforma zbog vlastite tehničke pogreške nije omogućila predviđenu razmjenu kontaktnih podataka, naknada za povezivanje ne bi se trebala konačno zadržati; eventualno pogrešno zaduženje ispravit ćemo u skladu s primjenjivim pravom. <strong>Kada je povezivanje uredno ostvareno i kontakti su otkriveni, kasnije otkazivanje, neodazivanje jedne strane, promjena termina, neplaćanje prijevoza ili spor o njegovu izvršenju sami po sebi ne stvaraju automatsko pravo na povrat VanScoutove naknade.</strong> Ne jamčimo točnost ili dostupnost kontaktnih podataka koje je drugi korisnik dostavio, ali prijave netočnih podataka ili zlouporabe razmotrit ćemo u skladu s našim obvezama. Pogrešna ili dvostruka naplata, neizvršena usluga VanScouta i zakonski obvezni povrati ostaju izuzeci. Zahtjev s identifikatorom povezivanja i opisom pošaljite na <Email />.</p>
      <p>Neiskorišteni krediti ostaju vezani uz račun prema prikazanim pravilima korištenja. Brisanje ili suspenzija računa ne znači automatski odricanje od zakonskih novčanih tražbina. U slučaju trajnog prestanka usluge operator će o sudbini neiskorištenih kupljenih kredita postupiti u skladu s primjenjivim pravom i okolnostima slučaja.</p>
    </Section>
    <Section title="9. Potrošačka prava za uslugu platforme">
      <p>Krediti su prvenstveno namijenjeni korisnicima koji pružaju usluge prijevoza u okviru djelatnosti, no pravni status kupca određuje se stvarnim okolnostima. Kada kupac prema zakonu ima status potrošača, prije sklapanja ugovora dobiva zakonom propisane informacije o cijeni, usluzi i mogućem pravu na jednostrani raskid ugovora sklopljenog na daljinu, u pravilu u roku od 14 dana. Zakonske iznimke i pravila o započinjanju ili potpunom izvršenju usluge primjenjuju se samo uz ispunjenje propisanih uvjeta, uključujući potrebne izričite izjave potrošača.</p>
      <p>Za jednostrani raskid, prigovor ili zakonski povrat možete pisati na <Email /> ili na adresu iz Impressuma. Ništa u ovim Uvjetima ne umanjuje neisključiva prava potrošača niti oslobađa operatora odgovornosti koju zakon ne dopušta isključiti. Uvjeti ugovora o samom prijevozu i prava prema prijevozniku zasebno su pitanje.</p>
    </Section>
    <Section title="10. Nedopuštena uporaba i prijava nezakonitog sadržaja">
      <p>Zabranjeni su zahtjevi ili ponude za nezakonite, ukradene ili opasne predmete protivno propisima, prijevoz koji ugrožava osobe ili imovinu, povrede prava drugih, prijevare, lažne recenzije, uznemiravanje, spam, nedopušteno prikupljanje podataka i zaobilaženje sigurnosnih funkcija. Svaki korisnik mora poštovati primjenjive prometne, carinske, porezne, radne i druge propise.</p>
      <p>Nezakonit sadržaj prijavite na <Email />, uz identifikator ili poveznicu sadržaja, razloge prijave, raspoložive dokaze, podatke za kontakt kada se traže te izjavu o dobroj vjeri. Kada prijava potpada pod Akt o digitalnim uslugama, postupamo u propisanim rokovima i uz propisano obrazloženje odluke. Obveze uklanjanja i obavještavanja određene zakonom imaju prednost pred ovim Uvjetima.</p>
    </Section>
    <Section title="11. Ograničenja računa, moderiranje i prestanak">
      <p>U opravdanim slučajevima možemo odbiti objavu, smanjiti vidljivost sadržaja, privremeno ograničiti funkcije ili suspendirati odnosno ugasiti račun, primjerice zbog nezakonitosti, prijevare, povrede prava trećih, sigurnosnog rizika, ozbiljne ili ponovljene povrede Uvjeta, netočnih podataka ili neplaćene naknade. Mjere trebaju biti razmjerne naravi i težini razloga.</p>
      <p>Kada zakon zahtijeva, dostavljamo razloge odluke i informacije o prigovoru odnosno dostupnim pravnim sredstvima. Za poslovne korisnike na koje se primjenjuje Uredba (EU) 2019/1150 poštujemo posebna pravila o obrazloženju ograničenja i, kod potpunog prestanka pružanja usluge, prethodnoj obavijesti u pravilu 30 dana, uz zakonske iznimke. Pritužbe na odluke operatora šalju se na <Email />. Zakonsko pravo na prigovor ne može se ukloniti ovim Uvjetima.</p>
      <p>Možete prestati koristiti uslugu i zatražiti brisanje računa. Prestankom korištenja ne prestaju već nastale obveze plaćanja, prava na zakonske povrate, obveze čuvanja podataka ili neriješeni pravni zahtjevi.</p>
    </Section>
    <Section title="12. Prikaz ponuda, poslovni korisnici i podaci">
      <p>VanScout ne obećava određeni broj prikaza, upita, ponuda niti poslova. Ako se ponude, profili ili oglasi sortiraju ili filtriraju, na konkretnom prikazu treba uzeti u obzir korisnički odabrane filtre i način sortiranja. Glavni parametri rangiranja i utjecaj eventualne plaćene promocije moraju biti opisani korisnicima na mjestu na kojem je to zakonom potrebno. Sama kupnja kredita ne predstavlja jamstvo plasmana ni sklopljenog posla.</p>
      <p>Poslovni prijevoznici mogu nastupati i izvan VanScouta; ovi Uvjeti ne nameću ekskluzivnost ni obvezu najniže cijene. VanScout može promovirati javno dostupne objave preko vlastitih kanala radi pronalaska korisnika, unutar dodijeljene licence za sadržaj. Pristup podacima na računu ovisi o dodijeljenoj ulozi i funkcionalnostima; informacije o osobnim podacima, primateljima, izvozu i brisanju nalaze se u <Link to="/privacy">Pravilima privatnosti</Link>. Posebna prava poslovnih korisnika koja proizlaze iz propisa o internetskom posredovanju ostaju nepromijenjena.</p>
    </Section>
    <Section title="13. Vlasništvo nad sadržajem i licencija">
      <p>Prava na vlastite objave zadržavate vi ili drugi nositelj prava. VanScoutu dajete neisključivu, bez dodatne naknade, teritorijalno neograničenu licenciju za pohranu, tehničku prilagodbu, prikazivanje, prosljeđivanje odgovarajućim korisnicima i razmjernu promociju javnih objava isključivo radi rada, sigurnosti i predstavljanja platforme. Jamčite da imate pravo objaviti sadržaj, a licencija prestaje kada sadržaj više nije potreban za te svrhe, uz zakonito zadržavanje sigurnosnih kopija ili evidencija.</p>
      <p>Nije dopušteno bez odobrenja kopirati, prodavati, masovno prikupljati ili koristiti VanScoutov kod, dizajn, znakove i sadržaj drugih korisnika izvan dopuštene uporabe usluge.</p>
    </Section>
    <Section title="14. Dostupnost, promjene i vanjske usluge">
      <p>Platformu pružamo uz razumnu profesionalnu pažnju, no ne jamčimo neprekidan rad, odsutnost svih grešaka, ostvarenje poslovnog rezultata, potpunu zaštitu od postupanja trećih osoba niti kompatibilnost sa svakim uređajem. U najvećoj zakonom dopuštenoj mjeri ne odgovaramo za prekide koji su prouzročeni okolnostima izvan naše kontrole, uključujući vanjske mreže, pružatelje infrastrukture i nezakonite radnje korisnika, osim ako smo za nastanak štete odgovorni prema obveznim pravilima.</p>
      <p>Možemo održavati, mijenjati ili ukinuti funkcionalnosti radi sigurnosti, tehničkog razvoja ili zakonitosti; za izmjene koje zahvaćaju bitna prava korisnika primjenjuju se propisana pravila obavještavanja i prestanka ugovora. Stranice ili usluge trećih strana, uključujući platne pružatelje, imaju zasebne uvjete; to ne isključuje naše vlastite zakonske obveze.</p>
    </Section>
    <Section title="15. Podjela odgovornosti i ograničenje naknade">
      <p><strong>Naručitelj i prijevoznik odgovaraju jedno drugome za svoj dogovor ili ugovor o prijevozu i njegovo izvršenje.</strong> To uključuje opis tereta, dopuštenost prijevoza, dogovorenu cijenu, zakašnjenja, neizvršenje, neplaćanje, otkazivanje, pakiranje, utovar, istovar, oštećenje tereta ili prostora, ozljede, dozvole i osiguranje. VanScout pruža povezivanje i razmjenu kontakata, a nije osiguravatelj, jamac, depozitar, voditelj prijevoza niti arbitar tih zahtjeva. Samo povezivanje, naplata naknade platforme ili otkrivanje kontakata ne znači da VanScout preuzima dugove, rizike ili obveze prijevoza. Time se ne isključuje naša odgovornost za vlastitu uslugu u zakonom propisanom opsegu.</p>
      <p>Za vlastitu povredu obveza operator odgovara u skladu s primjenjivim prisilnim pravom. <strong>U ugovorima s poslovnim korisnicima</strong>, u najvećoj mjeri dopuštenoj zakonom, ne odgovaramo za izgubljenu dobit, izgubljene poslovne prilike ni posrednu ili posljedičnu štetu koja se ne može pripisati našoj vlastitoj zakonskoj ili ugovornoj odgovornosti. Naša ukupna ugovorna odgovornost prema pojedinom poslovnom korisniku za običnu nepažnju ograničena je na veći od sljedećih iznosa: <strong>500 EUR ili naknade platforme koje je taj korisnik stvarno platio u 12 mjeseci prije događaja</strong>, ali samo ako takvo ograničenje nije u očitom nerazmjeru sa štetom i ako je u konkretnom slučaju pravno dopušteno.</p>
      <p>Ovo ograničenje ne vrijedi za štetu uzrokovanu namjerom ili krajnjom nepažnjom, odgovornost koju nije dopušteno ograničiti, obvezna potrošačka prava ni prava ispitanika iz propisa o zaštiti osobnih podataka. Ne primjenjuje se automatski na korisnika koji je potrošač. Ništa u ovim Uvjetima ne ukida zakonske zahtjeve protiv VanScouta za njegove vlastite protupravne radnje.</p>
    </Section>
    <Section title="16. Zahtjevi trećih osoba i regres prema poslovnim korisnicima">
      <p>Ako poslovni korisnik svojim nezakonitim oglasom, kršenjem tuđih prava, lažnim podacima, neovlaštenim radom ili vlastitim izvršenjem prijevoza prouzroči opravdan zahtjev treće osobe prema operatoru, dužan je, u opsegu dopuštenom zakonom i u kojemu je odgovoran, naknaditi operatoru razumno nastale i dokazane izravne troškove i štetu. To ne obuhvaća dio štete koji je posljedica vlastite povrede obveza operatora, niti unaprijed isključuje korisnikovo pravo na obranu od neosnovanog zahtjeva. Ova odredba nije usmjerena na ograničavanje zakonskih prava potrošača.</p>
    </Section>
    <Section title="17. Pritužbe, mjerodavno pravo i sudovi">
      <p>Prigovore na rad VanScouta, obračun kredita i odluke o računu pošaljite na <Email /> ili poštom na adresu u Impressumu. Potrošački pisani prigovor potvrđujemo bez odgode i na njega odgovaramo pisano u roku od 15 dana, uz izjašnjenje o njegovoj osnovanosti. Evidenciju takvih prigovora čuvamo u propisanom roku. Za spor koji se odnosi isključivo na izvršenje prijevoza primarni ugovorni sugovornik jest prijevoznik, odnosno naručitelj.</p>
      <p>Za pritužbe zbog mogućih povreda Akta o digitalnim uslugama informacije su dostupne na stranicama <a href="https://www.hakom.hr/en/dsa-complaints/12500" rel="noreferrer">HAKOM-a</a>. Na odnos s operatorom primjenjuje se hrvatsko pravo, bez zadiranja u obveznu zaštitu potrošača prema pravu njegove države uobičajenog boravišta. Sudska nadležnost određuje se prema primjenjivim prisilnim pravilima; potrošač se ne odriče zakonski nadležnog suda.</p>
    </Section>
    <Section title="18. Izmjene Uvjeta i povezane obavijesti">
      <p>Uvjeti se mogu mijenjati zbog promjena zakonodavstva, sigurnosti, poslovnog modela ili funkcionalnosti. Poslovnim korisnicima na koje se primjenjuje Uredba (EU) 2019/1150 predložene promjene priopćavamo na trajnom mediju najmanje 15 dana prije stupanja na snagu, odnosno dulje kada to zakon zahtijeva, uz propisane iznimke za hitne ili obvezne izmjene. Ostale korisnike o bitnim izmjenama obavještavamo na primjeren način i u rokovima koje zakon zahtijeva. Izmjene ne mijenjaju retroaktivno već nastale obveze, osim gdje zakon izričito dopušta drukčije.</p>
      <p>Na obradu osobnih podataka primjenjuju se <Link to="/privacy">Pravila privatnosti</Link>, a na tehnologije pohrane <Link to="/cookies">Pravila o kolačićima</Link>. Datum ažuriranja teksta: {revisedHr}.</p>
    </Section>
  </>;

  return <>
    <Section title="1. Parties, scope and definitions">
      <p>These Terms govern the VanScout digital platform (the “Platform”), operated by {operator.name} (“VanScout” or the “Operator”). Operator details are available in the <Link to="/impressum">Impressum</Link>. By registering and expressly accepting the Terms, you agree to version {TERMS_VERSION}. Account holders must be at least 18 years old.</p>
      <p>A “Requester” seeks transport; a “Carrier” independently offers or performs it; a “Job” or “Transport” is their separate transaction. A “Business User” acts in the course of a trade or profession; “Consumer” has its meaning under applicable law. These Terms form a contract for use of the Platform with the Operator, not a transport contract with the Operator.</p>
    </Section>
    <Section title="2. VanScout's limited role">
      <p>VanScout provides a digital service for publishing requests, exchanging offers and messages, mutually confirming a connection and disclosing contact details to matched users. <strong>VanScout does not itself provide transport, loading, unloading, packing, storage, freight forwarding, custody of goods or cargo insurance.</strong> We do not negotiate or conclude a transport contract for either the Requester or Carrier, and we are not their agent, employer, contractual guarantor or a party to their transport contract. We remain responsible for our own Platform service only to the extent required by our obligations and applicable law.</p>
      <p>Carriers independently decide whether to accept a Job, its lawful terms and price, and how to organise their work, vehicles and personnel. They are responsible for their own operations and contracts with Requesters. We have no general duty to supervise every transport or independently verify every user statement. We do not promise that a listing will receive an offer or that an agreed Job will be completed.</p>
      <p>Account labels, verification indicators or profile descriptions are not endorsements or guarantees of identity, quality, safety, solvency, insurance or valid licences. Any individual check extends only to the specific information and time expressly identified. This does not exclude any mandatory platform duties to verify particular information or act on notice of illegality.</p>
    </Section>
    <Section title="3. Accounts, authority and security">
      <p>Provide accurate and current information, safeguard account access and promptly report suspected unauthorised use. Anyone acting for a business confirms authority to do so. Impersonation, fraudulent registrations or unauthorised sharing of access are prohibited.</p>
      <p>You are responsible for actions attributable to you through your account to the extent permitted by law. We may apply proportionate safeguards and seek additional information to prevent misuse. Contact details received after matching may be used to communicate about that particular transport, not for unsolicited marketing, sale of contact lists or harassment.</p>
    </Section>
    <Section title="4. Accuracy of requests, offers and content">
      <p>Before agreement, Requesters must clearly describe the goods and their condition, dimensions, weight, value, access conditions, addresses, timing, assistance required, packing and known risks. Carriers are responsible for assessing feasibility, vehicle capacity, equipment, lawful carriage and safe performance. Both parties must resolve uncertainty and additional charges before accepting.</p>
      <p>Each user is responsible for the data, photos, offers, reviews and messages they post and the rights needed to use them. Publication by VanScout does not certify accuracy, completeness or legality.</p>
    </Section>
    <Section title="5. Mutual confirmation, contact exchange and transport contracts">
      <p>The Requester posts a request and a Carrier may submit an offer. <strong>Only when both the Requester and the selected Carrier confirm the connection through the Platform do we enable the exchange of their email addresses and phone numbers.</strong> This completes our matching service so that the parties can communicate directly about arranging and performing transport. VanScout does not arrange transport on their behalf and is not a party to their subsequent negotiations or performance.</p>
      <p>Posting a request or merely submitting an offer does not by itself create a transport contract. Depending on the offer, both parties' statements and applicable law, their mutual confirmation through the Platform <strong>may constitute acceptance and the formation of a transport contract directly between the Requester and the Carrier</strong>. VanScout's signature is not required and VanScout never becomes a party to that contract. The users are responsible for agreeing essential terms, including price, tax treatment, timing, loading, unloading, additional services, packing and cancellation, and complying with mandatory formalities where applicable.</p>
      <p><strong>VanScout neither collects nor holds payment of the transport price and does not receive payment for the Carrier.</strong> The Requester pays the Carrier under their agreement, separately from VanScout's matching fee. The Carrier is responsible for invoices or other records, taxes, transport-price refunds and performance. The parties communicate and arrange further details directly; VanScout does not undertake to supervise those conversations, resolve their disputes or ensure performance. This does not exclude VanScout's mandatory liability for its own Platform service.</p>
    </Section>
    <Section title="6. Carrier independence, registration and insurance">
      <p>Carriers are independent, not VanScout employees, agents or subcontractors. They must identify and comply with every legal requirement applicable to the Job, including business registration, transport licences, road rules, insurance, vehicle safety, professional qualifications, taxation, employment and customs obligations. They must not accept unlawful or unsafe Jobs.</p>
      <p>Carriers must accurately state whether they act as traders or private individuals, where the Platform allows the latter. Consumer protections applicable to contracts with traders generally do not apply to a transport contract with a genuinely private individual. Status information is based on the Carrier's declaration unless an additional check is expressly indicated. Carriers must provide documentation for legally required checks on request. We may deny or restrict access where legal conditions are not met.</p>
    </Section>
    <Section title="7. Prices, Platform fee and prepaid credits">
      <p>Under the current model, Carriers purchase prepaid credits for Platform fees. <strong>When both the Requester and the selected Carrier confirm the connection and the Platform enables the exchange of their email addresses and phone numbers, the Carrier is charged a one-off fee of 5% of the accepted offer price, rounded to the nearest cent.</strong> The fee is deducted from the Carrier's available credits; the Requester is not charged a matching fee by VanScout. The fee and applicable charges are shown before binding confirmation. It is the price of the matching service and access to contact details, not a commission for successful transport performance, a payment guarantee or cargo insurance.</p>
      <p>Credits are limited contractual rights to use Platform services, not deposits for Transport. They bear no interest and are not intended for transfer or cash redemption except where mandatory law provides otherwise. Stripe supplies payment infrastructure; the Operator issues invoices directly or via its billing system. Package price and tax treatment are displayed before purchase. We do not guarantee that any package will remain on sale, and price changes do not retroactively affect credits already purchased.</p>
      <p>Users must not manipulate confirmed offer values or misuse Platform functions to evade a valid fee. This does not prohibit Carriers from marketing or working through other channels, nor does it impose price parity.</p>
    </Section>
    <Section title="8. Cancellation, disputes and credit refunds">
      <p>Cancellation terms and charges between a Requester and Carrier depend on their contract and mandatory law. VanScout does not determine fault for unperformed Transport, waiting time, damage to goods or refunds of the transport price.</p>
      <p>If mutual confirmation was not completed, or if the Platform failed due to its own technical error to enable the promised contact exchange, the matching fee should not be finally retained; any incorrect charge will be corrected under applicable law. <strong>Once matching is properly completed and contact details have been disclosed, a later cancellation, no-show, rescheduling, non-payment of the transport price or dispute about its performance does not itself create an automatic right to a refund of VanScout's fee.</strong> We do not guarantee the accuracy or availability of contact details provided by another user, but will consider reports of false information or abuse in accordance with our obligations. Mistaken or duplicate charges, a failure to provide VanScout's own service and statutory refunds remain exceptions. Send requests with the connection reference and details to <Email />.</p>
      <p>Unused credits remain associated with the account subject to the displayed credit rules. Account deletion or suspension does not automatically extinguish statutory monetary claims. If the Platform permanently ceases providing the relevant service, the Operator will handle unused purchased credits in accordance with applicable law and the circumstances.</p>
    </Section>
    <Section title="9. Consumer rights concerning Platform services">
      <p>Credits are primarily intended for professional Carriers, but a buyer's legal status depends on the facts. Where a buyer legally qualifies as a Consumer, statutory pre-contract information on the price, service and any right of withdrawal from a distance contract will be provided; a 14-day withdrawal right applies in principle. Statutory exceptions and rules on commencement or completion of services apply only when their conditions, including any required express consumer requests and acknowledgments, are fulfilled.</p>
      <p>Send a statutory withdrawal, complaint or refund request to <Email /> or the postal address in the Impressum. These Terms do not reduce mandatory Consumer rights or exclude the Operator's non-excludable liability. The underlying transport contract and any claims against the Carrier are separate.</p>
    </Section>
    <Section title="10. Prohibited conduct and illegal-content notices">
      <p>Requests or offers involving unlawful or stolen goods, hazardous loads in breach of regulations, unsafe transport, third-party rights violations, fraud, fake reviews, harassment, spam, unauthorised data collection or security circumvention are prohibited. Users must comply with applicable road, customs, tax, labour and other laws.</p>
      <p>Report illegal content at <Email />, providing a link or content identifier, reasons, available evidence, contact details where required and a good-faith statement. Where the Digital Services Act applies, we follow its requirements for notice handling and reasons for decisions. Mandatory removal and notification duties prevail over these Terms.</p>
    </Section>
    <Section title="11. Moderation, restrictions and account termination">
      <p>Where justified, we may reject posts, reduce visibility, restrict features, suspend or terminate accounts, for example for unlawful conduct, fraud, third-party rights infringements, security threats, serious or repeated Terms breaches, false information or unpaid fees. Measures must be proportionate to the relevant circumstances.</p>
      <p>Where legally required, we give reasons and information on complaint or appeal rights. For Business Users covered by Regulation (EU) 2019/1150, we comply with its special rules on restriction decisions and, for full termination of intermediation services, ordinarily give 30 days' prior notice, subject to statutory exceptions. Complaints regarding Operator decisions may be sent to <Email />. Statutory remedies remain available.</p>
      <p>You may stop using the service and request account deletion. Existing payment obligations, lawful refund rights, retention obligations and unresolved claims survive as applicable.</p>
    </Section>
    <Section title="12. Listings, Business Users and data access">
      <p>VanScout does not promise any number of impressions, enquiries, offers or Jobs. Where listings, profiles or offers are sorted or filtered, take account of the user-selected controls shown in that interface. The main ranking parameters and effects of any paid placement must be explained wherever the law requires. Buying credits does not guarantee placement or a completed Job.</p>
      <p>Professional Carriers may work outside VanScout; these Terms do not require exclusivity or price parity. We may promote public listings through our own channels to attract users within the content licence below. Account-data access depends on roles and available functionality; the <Link to="/privacy">Privacy Policy</Link> describes personal data, recipients, exports and deletion. Any special non-waivable rights of Business Users under online-intermediation law remain unaffected.</p>
    </Section>
    <Section title="13. Content ownership and licence">
      <p>You or the relevant rightsholder retain rights in your content. You grant VanScout a non-exclusive, royalty-free, worldwide licence to store, technically adapt, display and deliver content to relevant users, and proportionately promote public listings, solely to operate, secure and present the Platform. You confirm you have the rights needed to post it. The licence ends when no longer needed for those purposes, subject to lawful backups and records.</p>
      <p>Do not copy, sell, scrape or use VanScout code, design, branding or other users' content outside permitted Platform use without authorisation.</p>
    </Section>
    <Section title="14. Availability, changes and third-party services">
      <p>We provide the Platform with reasonable professional care but do not guarantee uninterrupted operation, freedom from every error, any particular commercial outcome, complete protection against third-party misconduct or compatibility with every device. To the maximum extent permitted by law, we are not responsible for interruptions caused by events outside our control, including external networks, infrastructure providers and user misconduct, unless mandatory law makes us responsible for the resulting harm.</p>
      <p>We may maintain, change or discontinue features for safety, technical development or compliance; mandatory notice and termination protections apply where material rights are affected. Third-party sites and services, including payment providers, have their own terms; this does not remove the Operator's statutory obligations.</p>
    </Section>
    <Section title="15. Allocation and limits of liability">
      <p><strong>Requesters and Carriers are responsible to one another for their transport arrangements or contracts and their performance.</strong> That includes cargo descriptions, lawful carriage, agreed price, delay, non-performance, non-payment, cancellation, packing, loading, unloading, damage to cargo or property, injury, permits and insurance. VanScout provides matching and contact exchange; we are not an insurer, guarantor, bailee, transport manager or adjudicator of such claims. The connection, Platform fee or contact disclosure alone does not transfer either party's transport debts, risks or obligations to VanScout. Our liability for our own Platform service under mandatory law remains unaffected.</p>
      <p>The Operator remains liable for its own breaches under applicable mandatory law. <strong>In contracts with Business Users</strong>, to the extent legally permitted, we exclude liability for lost profits, lost business opportunities and indirect or consequential loss not attributable to our own actionable breach. Our aggregate contractual liability to a Business User for ordinary negligence is limited to the greater of <strong>EUR 500 or Platform fees actually paid by that Business User in the 12 months preceding the event</strong>, but only to the extent that the cap is not manifestly disproportionate to the damage and is legally valid in the circumstances.</p>
      <p>This limit does not apply to intentional misconduct, gross negligence, liability that cannot legally be limited, mandatory Consumer rights or data-subject rights. It does not automatically apply to Consumers. Nothing here extinguishes statutory claims against VanScout for its own unlawful conduct.</p>
    </Section>
    <Section title="16. Third-party claims caused by Business Users">
      <p>Where a Business User's unlawful listing, infringement of third-party rights, false information, unlicensed activity or own transport performance gives rise to a justified third-party claim against the Operator, that Business User must, to the extent legally responsible, reimburse reasonable, proven direct costs and harm suffered by the Operator. This does not cover loss attributable to the Operator's own breach or prevent the user from disputing an unfounded claim. This provision is not intended to restrict mandatory Consumer protections.</p>
    </Section>
    <Section title="17. Complaints, applicable law and courts">
      <p>Complaints about VanScout's services, credit charges or account decisions may be sent to <Email /> or by post to the Impressum address. We acknowledge written Consumer complaints without undue delay and respond in writing within 15 days, stating whether the complaint is accepted. We keep legally required complaint records. For a dispute exclusively about transport performance, your primary contractual counterparty is the relevant Carrier or Requester.</p>
      <p>Information about complaints regarding potential Digital Services Act infringements is available from <a href="https://www.hakom.hr/en/dsa-complaints/12500" rel="noreferrer">HAKOM</a>. Croatian law governs the relationship with the Operator without prejudice to mandatory law protecting Consumers in their country of habitual residence. Courts have jurisdiction as determined by applicable mandatory rules; Consumers do not waive their statutory forum.</p>
    </Section>
    <Section title="18. Changes and related notices">
      <p>We may change these Terms for legal, security, business-model or feature changes. Where Regulation (EU) 2019/1150 applies, proposed changes are notified to affected Business Users on a durable medium at least 15 days in advance, or longer where required, subject to statutory exceptions for urgent or mandatory changes. Other users receive notice of material changes as required by law. Changes do not retroactively alter accrued obligations unless law expressly permits.</p>
      <p>Our <Link to="/privacy">Privacy Policy</Link> explains personal-data processing and our <Link to="/cookies">Cookie Policy</Link> explains storage technologies. Text last updated: {revisedEn}.</p>
    </Section>
  </>;
}

function Impressum({ language }: { language: Language }) {
  if (language === "hr") return <>
    <Section title="Podaci o pružatelju usluge">
      <p>VanScout je naziv digitalne platforme kojom upravlja sljedeći obrt:</p>
      <dl>
        <dt>Puni naziv obrta</dt><dd>{operator.name}</dd>
        <dt>Sjedište i poštanska adresa</dt><dd>{operator.address}</dd>
        <dt>Javni registar</dt><dd>Obrtni registar Republike Hrvatske</dd>
        <dt>Matični broj obrta (MBO)</dt><dd>{operator.mbo}</dd>
        <dt>Registracijsko tijelo</dt><dd>{operator.registrationAuthority}</dd>
        <dt>E-mail za kontakt</dt><dd><Email /></dd>
      </dl>
    </Section>
    <Section title="Pisani prigovori potrošača">
      <p>Pisani prigovor u vezi s uslugama VanScouta možete podnijeti e-mailom na <Email /> ili poštom na adresu sjedišta iznad, odnosno osobno u poslovnim prostorijama u skladu s primjenjivim propisima. Primitak prigovora potvrđujemo bez odgode, a pisani odgovor dostavljamo najkasnije u roku od 15 dana od primitka prigovora. Za prigovore koji se odnose isključivo na izvršenje prijevoza obratite se i prijevozniku s kojim ste sklopili ugovor.</p>
    </Section>
    <Section title="Nadležna tijela i dodatne informacije">
      <p>Za zaštitu osobnih podataka nadležna je <a href="https://azop.hr" rel="noreferrer">Agencija za zaštitu osobnih podataka (AZOP)</a>. Hrvatski koordinator za digitalne usluge je <a href="https://www.hakom.hr/en/dsa-complaints/12500" rel="noreferrer">HAKOM</a>. Informacije o izvansudskom rješavanju potrošačkih sporova dostupne su na <a href="https://www.szp.hr" rel="noreferrer">Središnjem portalu za potrošače</a>.</p>
    </Section>
  </>;
  return <>
    <Section title="Service-provider details">
      <p>VanScout is a digital platform operated by the following Croatian sole proprietorship:</p>
      <dl>
        <dt>Full registered business name</dt><dd>{operator.name}</dd>
        <dt>Registered and postal address</dt><dd>{operator.address}</dd>
        <dt>Public register</dt><dd>Croatian Crafts Register (Obrtni registar Republike Hrvatske)</dd>
        <dt>Craft registration number (MBO)</dt><dd>{operator.mbo}</dd>
        <dt>Registration authority</dt><dd>{operator.registrationAuthority}</dd>
        <dt>Contact email</dt><dd><Email /></dd>
      </dl>
    </Section>
    <Section title="Written consumer complaints">
      <p>You may submit a written complaint concerning VanScout services by email to <Email /> or by post to the address above, or in person at the business premises where required by applicable law. We acknowledge receipt without undue delay and reply in writing within 15 days of receiving a complaint. For complaints relating solely to performance of a transport, also contact the carrier with whom you contracted.</p>
    </Section>
    <Section title="Competent authorities and further information">
      <p>Personal-data protection is supervised by the <a href="https://azop.hr" rel="noreferrer">Croatian Personal Data Protection Agency (AZOP)</a>. Croatia's Digital Services Coordinator is <a href="https://www.hakom.hr/en/dsa-complaints/12500" rel="noreferrer">HAKOM</a>. Information on alternative consumer dispute resolution is available through the <a href="https://www.szp.hr" rel="noreferrer">Croatian Central Consumer Portal</a>.</p>
    </Section>
  </>;
}

export function LegalDocumentContent({ document, language }: { document: LegalDocument; language: Language }) {
  return <div className="legal-policy">
    {document === "privacy" ? <Privacy language={language} /> :
     document === "cookies" ? <Cookies language={language} /> :
     document === "terms" ? <Terms language={language} /> :
     <Impressum language={language} />}
  </div>;
}
