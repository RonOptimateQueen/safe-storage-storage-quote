import "./styles.css";
import { createStorageQuoteApi, type StorageQuoteDocument, type StorageQuoteLine } from "./api";
import { readRuntimeConfig, type StorageQuoteRuntimeConfigSource } from "./config";
import { formatIls } from "./model";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing app element");

app.innerHTML = `
  <div class="page-shell">
    <nav class="toolbar" aria-label="פעולות להצעת המחיר">
      <div>
        <strong>הצעת מחיר לאחסנה</strong>
        <span id="load-status">טוען נתונים מ־Fireberry…</span>
      </div>
      <div class="toolbar-actions">
        <button id="print-quote" type="button" disabled>הדפסה / שמירה כ־PDF</button>
        <a id="email-quote" class="action-link disabled" aria-disabled="true">פתיחת מייל</a>
        <a id="whatsapp-quote" class="action-link disabled" aria-disabled="true" target="_blank" rel="noopener">פתיחת WhatsApp</a>
      </div>
    </nav>
    <article id="proposal" class="proposal" aria-live="polite">
      <p class="loading">ההצעה נטענת…</p>
    </article>
  </div>
`;

const proposal = app.querySelector<HTMLElement>("#proposal");
const status = app.querySelector<HTMLElement>("#load-status");
const printButton = app.querySelector<HTMLButtonElement>("#print-quote");
const emailLink = app.querySelector<HTMLAnchorElement>("#email-quote");
const whatsappLink = app.querySelector<HTMLAnchorElement>("#whatsapp-quote");
if (!proposal || !status || !printButton || !emailLink || !whatsappLink) throw new Error("Storage quote viewer failed to initialize");

printButton.addEventListener("click", () => window.print());
void initialize();

type StorageQuoteWindow = Window & { __STORAGE_QUOTE_CONFIG__?: StorageQuoteRuntimeConfigSource };

async function initialize(): Promise<void> {
  try {
    const configSource = (window as StorageQuoteWindow).__STORAGE_QUOTE_CONFIG__;
    if (!configSource) throw new Error("החיבור להצעה עדיין אינו פעיל");
    const config = readRuntimeConfig(configSource);
    const token = new URLSearchParams(location.search).get(config.tokenQueryKey) ?? "";
    const data = await createStorageQuoteApi({ endpointUrl: config.endpointUrl }).loadDocument(token);
    proposal!.innerHTML = renderProposal(data);
    status!.textContent = "הצעה מעודכנת מ־Fireberry";
    printButton!.disabled = false;
    configureShareLinks(data);
  } catch (error) {
    proposal!.innerHTML = `<section class="error-state"><h1>לא ניתן לפתוח את ההצעה</h1><p>${escapeHtml(error instanceof Error ? error.message : "אירעה שגיאה")}</p></section>`;
    status!.textContent = "טעינת ההצעה נכשלה";
    status!.classList.add("error-text");
  }
}

function configureShareLinks(data: StorageQuoteDocument): void {
  const documentUrl = location.href;
  const subject = `הצעת מחיר לאחסנה - ${data.customer.displayName}`;
  const message = `שלום ${data.customer.displayName},\nמצורפת הצעת המחיר לאחסנה מאחסון בטוח:\n${documentUrl}`;
  emailLink!.href = `mailto:${encodeURIComponent(data.customer.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  emailLink!.classList.remove("disabled");
  emailLink!.removeAttribute("aria-disabled");
  const phone = normalizePhone(data.customer.phone);
  whatsappLink!.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  whatsappLink!.classList.remove("disabled");
  whatsappLink!.removeAttribute("aria-disabled");
}

function renderProposal(data: StorageQuoteDocument): string {
  const storageLine = data.lines.find((line) => /אחסנ/.test(line.description)) ?? data.lines[0];
  const optionalLines = data.lines.filter((line) => line !== storageLine && line.amount > 0);
  const date = formatDate(data.quote.createdOn);
  const quoteLabel = data.quote.quoteNumber ? `מספר הצעה ${escapeHtml(data.quote.quoteNumber)}` : escapeHtml(data.quote.displayName);
  const pricePerCube = storageLine.quantity >= 8
    ? `<p>נשמח לספק עבורכם את שירותינו לאחסנה במחיר של <strong>${formatIls(storageLine.unitPrice)}</strong> לקו״ב לחודש.</p>`
    : "";
  const optional = optionalLines.length
    ? `<section class="optional-services"><p>כמו כן, ניתן להיעזר בשירותינו להובלת הציוד לאחסון ו/או עבודת סבלות לסידור הציוד במחסנים:</p><ul>${optionalLines.map(renderOptionalLine).join("")}</ul></section>`
    : "";

  return `
    <div class="document-logo"><img src="./logo.png" alt="אחסון בטוח - מחסנים להשכרה"></div>
    <header class="document-meta">
      <span><strong>לכבוד:</strong> ${escapeHtml(data.customer.displayName)}</span>
      <span><strong>תאריך:</strong> ${date}</span>
    </header>
    <p class="quote-reference">${quoteLabel}</p>
    <h1>הנדון: הצעת מחיר לאחסנה</h1>
    <p>אנחנו באחסון בטוח עוסקים למעלה מ־40 שנה בהשכרת מחסנים פרטיים בכל גודל ולכל תקופה על פי דרישת הלקוח בתוך מבנה בטון מלא, עם גג בטון, במתחם מאוורר, נקי, מבוטח ומאובטח - עם שמירה, מצלמות ומערכת אזעקה מתקדמת וייחודית.</p>
    <p>מפתח ביד הלקוח לתא האישי שלו ואפשרות לגישה 24/7 למתחם כל שעה וכל יום באמצעות בקרות כניסה ויציאה חכמות.</p>
    <p>מחיר השכירות החודשי נקבע על פי גודל המחסן ביחידות קוב.</p>
    <p>ברשותנו מחסנים בכל הגדלים, החל מ־1 קוב ואילך, עד למחסנים ענקיים של 100 קוב.</p>
    <p>על פי דרישתכם להערכתנו תזדקקו למחסן בגודל של <strong>${formatNumber(storageLine.quantity)} קוב</strong>.</p>
    ${pricePerCube}
    <p>כך שמחסן בגודל <strong>${formatNumber(storageLine.quantity)} קוב</strong> יעלה עבורכם <strong>${formatIls(storageLine.amount)}</strong> בחודש. מחיר האחסון המדויק ייקבע בהתאם לגודל המחסן אשר נלקח בפועל במועד האחסנה.</p>
    <p>המחיר כולל ביטוח על פי תנאי החוזה המצורף:</p>
    <ul>
      <li>למחסן בגודל עד 14 קוב ביטוח בגובה 5,000 ₪.</li>
      <li>למחסן בגודל 15 קוב ומעלה ביטוח בגובה 10,000 ₪.</li>
    </ul>
    <p>בעת הצורך ניתן להגדיל את הכיסוי הביטוחי בעלות של 2 ₪ על כל תוספת של 1,000 ₪ ביטוח.</p>
    ${optional}
    <p>במידה ותרצו, נשמח לארח אתכם באחד המתחמים הקרובים לביתכם - על מנת שתגיעו להתרשם מתנאי האחסון והסטנדרט שלנו באחסון בטוח.</p>
    <p>לתיאום פגישה - שמשון 052-3420734 / אדיר 052-4446766 / משרד 03-9622247</p>
    <ul class="terms"><li>המחירים אינם כוללים מע״מ.</li><li>הצעה זו תקפה למשך 30 יום.</li></ul>
    <p class="signoff">בתודה מראש<br><strong>אחסון בטוח</strong></p>
    <footer><strong>אצ"ל 35 ראשל"צ&nbsp;&nbsp;&nbsp; טלפון: 03-9622247&nbsp;&nbsp;&nbsp; פקס: 03-9622248</strong><br><strong>www.ichsunbatuach.co.il</strong></footer>
  `;
}

function renderOptionalLine(line: StorageQuoteLine): string {
  return `<li>${escapeHtml(line.description)}: <strong>${formatIls(line.amount)}</strong></li>`;
}

function normalizePhone(value: string | null): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("he-IL").format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}
