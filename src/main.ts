import "./styles.css";
import { createStorageQuoteApi } from "./api";
import { readRuntimeConfig, type StorageQuoteRuntimeConfigSource } from "./config";
import { calculateStorageQuote, formatIls, type StorageQuoteInput } from "./model";
import { currentSubmissionId, resetSubmissionId } from "./submission";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing app element");

app.innerHTML = `
  <div class="workspace">
    <form class="quote-form" novalidate>
      <header>
        <p class="eyebrow">אחסון בטוח</p>
        <h1>הצעת מחיר לאחסנה</h1>
        <p>טופס פנימי להכנת הצעה ללא חתימה.</p>
      </header>

      <section class="card">
        <h2>פרטי ההצעה</h2>
        <div class="grid">
          <label>שם הלקוח<input name="customerName" autocomplete="name" required /></label>
          <label>טלפון<input name="customerPhone" type="tel" autocomplete="tel" /></label>
          <label>דוא״ל<input name="customerEmail" type="email" autocomplete="email" /></label>
          <label>תאריך<input name="quoteDate" type="date" required /></label>
          <label>נפח המחסן בקוב<input name="volumeCubicMeters" type="number" min="0.01" step="0.01" inputmode="decimal" required /></label>
          <label>מחיר לקוב לחודש<input name="pricePerCubicMeter" type="number" min="0.01" step="0.01" inputmode="decimal" required /></label>
        </div>
        <p class="rule-note">ב־8 קוב ומעלה המחיר לקוב יוצג בהצעה. מתחת ל־8 קוב המחיר מוזן במערכת אך השורה אינה מוצגת במסמך.</p>
      </section>

      <section class="card">
        <h2>שירותים אופציונליים</h2>
        <p>שדה ריק או 0 לא יופיע בהצעה.</p>
        <div class="grid">
          <label>מחיר הובלה<input name="movingPrice" type="number" min="0" step="0.01" inputmode="decimal" /></label>
          <label>מחיר סבלות<input name="porteragePrice" type="number" min="0" step="0.01" inputmode="decimal" /></label>
        </div>
      </section>

      <section class="summary-card">
        <span>מחיר אחסנה חודשי</span>
        <output id="monthly-total">₪0</output>
      </section>

      <section class="submit-card">
        <button id="save-quote" type="submit" disabled>שמירת ההצעה בפיירברי</button>
        <p id="save-status" aria-live="polite">הטופס המקומי מוכן לתצוגה ולהדפסה. החיבור לפיירברי אינו פעיל עדיין.</p>
      </section>
    </form>

    <aside class="proposal" aria-live="polite">
      <div class="proposal-actions"><button id="print-quote" type="button">הדפסת ההצעה</button></div>
      <article id="proposal-preview"></article>
    </aside>
  </div>
`;

const form = app.querySelector<HTMLFormElement>(".quote-form");
const preview = app.querySelector<HTMLElement>("#proposal-preview");
const total = app.querySelector<HTMLOutputElement>("#monthly-total");
const printButton = app.querySelector<HTMLButtonElement>("#print-quote");
const saveButton = app.querySelector<HTMLButtonElement>("#save-quote");
const saveStatus = app.querySelector<HTMLElement>("#save-status");
if (!form || !preview || !total || !printButton || !saveButton || !saveStatus) throw new Error("Storage quote form failed to initialize");

const dateInput = form.elements.namedItem("quoteDate") as HTMLInputElement;
dateInput.value = new Date().toISOString().slice(0, 10);

form.addEventListener("input", render);
printButton.addEventListener("click", () => window.print());
render();
void initializeIntegration();

type StorageQuoteWindow = Window & { __STORAGE_QUOTE_CONFIG__?: StorageQuoteRuntimeConfigSource };

async function initializeIntegration(): Promise<void> {
  const configSource = (window as StorageQuoteWindow).__STORAGE_QUOTE_CONFIG__;
  if (!configSource) return;

  try {
    const config = readRuntimeConfig(configSource);
    const token = new URLSearchParams(location.search).get(config.tokenQueryKey) ?? "";
    const api = createStorageQuoteApi({ endpointUrl: config.endpointUrl });
    saveStatus!.textContent = "טוען את פרטי הלקוח…";
    const prefill = await api.loadPrefill(token);
    setField("customerName", prefill.customer.displayName);
    setField("customerPhone", prefill.customer.phone ?? "");
    setField("customerEmail", prefill.customer.email ?? "");
    render();
    saveButton!.disabled = false;
    saveStatus!.textContent = prefill.owner.displayName
      ? `הטופס מוכן. נציג/ה: ${prefill.owner.displayName}`
      : "הטופס מוכן לשמירה.";

    form!.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form!.reportValidity()) return;
      const submissionId = currentSubmissionId(token);
      saveButton!.disabled = true;
      saveStatus!.classList.remove("error-message", "success-message");
      saveStatus!.textContent = "שומר את ההצעה ואת פריטי ההצעה…";
      try {
        const result = await api.submitQuote({ token, clientSubmissionId: submissionId, form: readInput(form!) }, submissionId);
        resetSubmissionId(token);
        saveStatus!.classList.add("success-message");
        saveStatus!.textContent = `ההצעה נשמרה בהצלחה עם ${result.lineCount} פריטים. אפשר להדפיס או לשמור כ־PDF.`;
        saveButton!.textContent = "נשמר בהצלחה ✓";
      } catch (error) {
        saveStatus!.classList.add("error-message");
        saveStatus!.textContent = error instanceof Error ? error.message : "שמירת ההצעה נכשלה. אפשר לנסות שוב.";
        saveButton!.disabled = false;
      }
    });
  } catch (error) {
    saveStatus!.classList.add("error-message");
    saveStatus!.textContent = error instanceof Error ? error.message : "לא ניתן לטעון את פרטי הלקוח.";
  }
}

function setField(name: string, value: string): void {
  const field = form!.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.value = value;
}

function render(): void {
  const input = readInput(form!);
  const calculation = calculateStorageQuote(input);
  total!.value = formatIls(calculation.monthlyStoragePrice);
  preview!.innerHTML = renderProposal(input, calculation);
}

function readInput(target: HTMLFormElement): StorageQuoteInput {
  const data = new FormData(target);
  return {
    customerName: String(data.get("customerName") ?? "").trim(),
    customerPhone: String(data.get("customerPhone") ?? "").trim(),
    customerEmail: String(data.get("customerEmail") ?? "").trim(),
    quoteDate: String(data.get("quoteDate") ?? ""),
    volumeCubicMeters: asNumber(data.get("volumeCubicMeters")),
    pricePerCubicMeter: asNumber(data.get("pricePerCubicMeter")),
    movingPrice: asNumber(data.get("movingPrice")),
    porteragePrice: asNumber(data.get("porteragePrice")),
  };
}

function renderProposal(input: StorageQuoteInput, calculation: ReturnType<typeof calculateStorageQuote>): string {
  const customer = escapeHtml(input.customerName) || "____________";
  const date = input.quoteDate ? new Intl.DateTimeFormat("he-IL").format(new Date(`${input.quoteDate}T12:00:00`)) : "____________";
  const volume = input.volumeCubicMeters > 0 ? input.volumeCubicMeters : "____";
  const priceLine = calculation.showPricePerCubeLine
    ? `<p>נשמח לספק עבורכם את שירותי האחסנה במחיר של <strong>${formatIls(input.pricePerCubicMeter)}</strong> לקוב לחודש.</p>`
    : "";
  const services = calculation.optionalServices.length
    ? `<p>כמו כן, ניתן להיעזר בשירותינו:</p><ul>${calculation.optionalServices.map((service) => `<li>${service.label}: <strong>${formatIls(service.amount)}</strong></li>`).join("")}</ul>`
    : "";

  return `
    <div class="proposal-meta"><span>לכבוד: <strong>${customer}</strong></span><span>תאריך: <strong>${date}</strong></span></div>
    <h2>הנדון: הצעת מחיר לאחסנה</h2>
    <p>אנחנו באחסון בטוח עוסקים למעלה מ־40 שנה בהשכרת מחסנים פרטיים בכל גודל ולכל תקופה על פי דרישת הלקוח, בתוך מבנה בטון מלא עם גג בטון, במתחם מאוורר, נקי, מבוטח ומאובטח — עם שמירה, מצלמות ומערכת אזעקה מתקדמת.</p>
    <p>מפתח התא האישי נמצא בידי הלקוח וקיימת אפשרות לגישה למתחם 24/7, בכל שעה ובכל יום, באמצעות בקרות כניסה ויציאה חכמות.</p>
    <p>ברשותנו מחסנים בכל הגדלים, החל מ־1 קוב ועד מחסנים של 100 קוב.</p>
    <p>על פי דרישתכם, להערכתנו תזדקקו למחסן בגודל של <strong>${volume} קוב</strong>.</p>
    ${priceLine}
    <p>המחיר החודשי למחסן בגודל זה הוא <strong>${formatIls(calculation.monthlyStoragePrice)}</strong>. המחיר המדויק ייקבע בהתאם לגודל המחסן שנלקח בפועל במועד האחסנה.</p>
    <p>המחיר כולל ביטוח על פי תנאי החוזה המצורף:</p>
    <ul><li>עד 14 קוב — ביטוח בגובה 5,000 ₪.</li><li>15 קוב ומעלה — ביטוח בגובה 10,000 ₪.</li></ul>
    <p>ניתן להגדיל את הכיסוי הביטוחי בעלות של 2 ₪ לחודש לכל תוספת של 1,000 ₪ ביטוח.</p>
    ${services}
    <p>במידה ותרצו, נשמח לארח אתכם באחד המתחמים הקרובים לביתכם, כדי שתוכלו להתרשם מתנאי האחסון ומהסטנדרט שלנו.</p>
    <p>לתיאום פגישה — שמשון 052-3420734 / אדיר 052-4446766 / משרד 03-9622247</p>
    <p>המחירים אינם כוללים מע״מ. ההצעה תקפה למשך 30 יום.</p>
    <p class="signoff">בתודה מראש,<br><strong>אחסון בטוח</strong></p>
    <footer>אצ״ל 35, ראשון לציון · 03-9622247 · www.ichsunbatuach.co.il</footer>
  `;
}

function asNumber(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
