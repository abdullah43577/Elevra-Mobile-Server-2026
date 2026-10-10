const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", bull: "•" };

const decodeEntities = function (text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
};

// Readable text from HTML, keeping the line structure a posting relies on —
// paragraphs, headings and bullet points — and dropping everything that is not
// content.
export const htmlToText = function (html: string) {
  const text = html
    .replace(/<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|tr|table|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(text)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export interface StructuredJob {
  company?: string;
  role?: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
}

const asArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

const findJobPosting = function (node: unknown): Record<string, unknown> | null {
  for (const item of asArray(node as unknown)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const types = asArray(record["@type"] as string | string[] | undefined);
    if (types.includes("JobPosting")) return record;
    const nested = findJobPosting(record["@graph"]);
    if (nested) return nested;
  }
  return null;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? decodeEntities(value.trim()) : undefined);

const locationOf = function (posting: Record<string, unknown>) {
  const places = asArray(posting.jobLocation as unknown).map(place => {
    const address = (place as { address?: unknown })?.address;
    if (typeof address === "string") return address;
    const parts = address as Record<string, unknown> | undefined;
    const country = parts?.addressCountry;
    return [parts?.addressLocality, parts?.addressRegion, typeof country === "string" ? country : (country as { name?: string })?.name]
      .filter(part => typeof part === "string" && part.trim())
      .join(", ");
  });
  return places.find(Boolean);
};

const salaryOf = function (posting: Record<string, unknown>) {
  const salary = posting.baseSalary as Record<string, unknown> | undefined;
  const value = salary?.value as Record<string, unknown> | number | undefined;
  const unit = (typeof value === "object" ? value?.unitText : undefined) ?? salary?.unitText;
  // Only annual pay maps onto the application's salary fields; an hourly rate
  // stored as "salary" would mislead every later comparison.
  if (typeof unit === "string" && unit.toUpperCase() !== "YEAR") return {};

  const toInt = (input: unknown) => (typeof input === "number" || (typeof input === "string" && input.trim()) ? Math.round(Number(input)) : NaN);
  const min = toInt(typeof value === "object" ? (value?.minValue ?? value?.value) : value);
  const max = toInt(typeof value === "object" ? (value?.maxValue ?? value?.value) : value);
  const currency = text(salary?.currency)?.toUpperCase();

  return {
    ...(Number.isFinite(min) && min > 0 && { salaryMin: min }),
    ...(Number.isFinite(max) && max > 0 && { salaryMax: max }),
    ...(currency && /^[A-Z]{3}$/.test(currency) && { salaryCurrency: currency }),
  };
};

/*
  schema.org JobPosting data, which Greenhouse, Lever, Ashby, Workable and most
  careers sites embed for search engines. When it is there the import needs no
  model call at all: the fields are the site's own, so nothing can be invented.
*/
export const extractStructuredJob = function (html: string): StructuredJob | null {
  const blocks = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const [, body] of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body!.trim());
    } catch {
      continue;
    }
    const posting = findJobPosting(parsed);
    if (!posting) continue;

    const organisation = posting.hiringOrganization as Record<string, unknown> | string | undefined;
    const description = text(posting.description);
    const location = locationOf(posting);

    return {
      ...(text(typeof organisation === "string" ? organisation : organisation?.name) && {
        company: text(typeof organisation === "string" ? organisation : organisation?.name)!,
      }),
      ...(text(posting.title) && { role: text(posting.title)! }),
      ...(location && { location }),
      ...(asArray(posting.jobLocationType as string | string[] | undefined).includes("TELECOMMUTE") && { remote: true }),
      ...salaryOf(posting),
      // The description is itself HTML inside the JSON.
      ...(description && { description: htmlToText(description) }),
    };
  }

  return null;
};
