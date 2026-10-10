import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { generateJson } from "../lib/ai";
import { consumeAiQuota } from "../lib/ai-quota";
import { PdfNoTextError, PdfUnreadableError } from "../lib/errors";
import { contentWords, groundedShare, numbersIn } from "../lib/keyword-match";
import { resumeDataSchema, type ResumeDataInput } from "../schemas/resume-data";

// Below this, a "PDF" is a scan with a stray text label or two, not a resume.
const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 20_000;
const MIN_GROUNDING = 0.6;

const IMPORT_SYSTEM_PROMPT = `You extract a resume into JSON. Copy text exactly as written in the resume: never rephrase, summarise, correct, translate or invent. Anything not in the resume is left out.
- Dates: "YYYY-MM" when the month is given, "YYYY" when only the year is. A role still ongoing ("Present", "Current", "now") gets current: true and no endDate.
- Bullet points go in achievements, one string per bullet, without the bullet character. A paragraph about the role goes in description.
- degree is the qualification as written ("B.Sc.", "Master of Arts"); field is the subject ("Architecture").
- skills: one entry per skill as listed.
- Language proficiency only when stated, as one of: basic, conversational, professional, native.
- A project's website goes in url when one is listed.
- "References available on request" is not a reference.
Reply with JSON only, in this shape (omit any key you have nothing for):
{"personalInfo": {"firstName", "lastName", "email", "phone", "location", "title", "summary"},
 "experience": [{"company", "position", "startDate", "endDate", "current", "description", "achievements": []}],
 "education": [{"school", "degree", "field", "startDate", "endDate", "current", "gpa"}],
 "skills": [{"name"}],
 "languages": [{"name", "proficiency"}],
 "certifications": [{"name", "issuer", "date", "expiry"}],
 "projects": [{"name", "description", "url", "technologies": []}],
 "references": [{"name", "position", "company", "email", "phone"}]}`;

const text = z.string().nullish();
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish();

// Deliberately lenient: models emit nulls and stray values. Everything is
// normalised and re-validated against the real schema afterwards.
const extractedSchema = z.object({
  personalInfo: z
    .object({ firstName: text, lastName: text, email: text, phone: text, location: text, title: text, summary: text })
    .nullish(),
  experience: list(
    z.object({
      company: text,
      position: text,
      startDate: text,
      endDate: text,
      current: z.boolean().nullish(),
      description: text,
      achievements: list(z.string()),
    }),
  ),
  education: list(
    z.object({ school: text, degree: text, field: text, startDate: text, endDate: text, current: z.boolean().nullish(), gpa: text }),
  ),
  skills: list(z.object({ name: text })),
  languages: list(z.object({ name: text, proficiency: text })),
  certifications: list(z.object({ name: text, issuer: text, date: text, expiry: text })),
  projects: list(z.object({ name: text, description: text, url: text, technologies: list(z.string()) })),
  references: list(z.object({ name: text, position: text, company: text, email: text, phone: text })),
});

type Extracted = z.infer<typeof extractedSchema>;

const PROFICIENCY = ["basic", "conversational", "professional", "native"] as const;
const EMAIL = z.email();

export interface ImportReport {
  // Values dropped because they could not be found in the PDF.
  omittedValues: number;
  // Experience and education entries that arrived without a start date, which
  // the editor requires before it will save.
  entriesMissingDates: number;
}

const isPdf = function (buffer: Buffer) {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
};

/*
  Every imported value must come from the user's own document. The model is
  told to copy verbatim, and this checks it did: a value whose numbers are not
  in the PDF, or whose words mostly are not, is dropped and counted. Dates are
  exempt from the number check — "Mar 2022" correctly becomes "2022-03", and
  "03" appears nowhere in the PDF — and pass when their year is in it.
*/
const buildGrounding = function (pdfText: string) {
  const pdfNumbers = numbersIn(pdfText);
  const pdfWords = contentWords([pdfText]);
  let omitted = 0;

  const keep = function (value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    const inventsNumber = [...numbersIn(trimmed)].some(number => !pdfNumbers.has(number));
    if (inventsNumber || groundedShare([trimmed], pdfWords) < MIN_GROUNDING) {
      omitted++;
      return undefined;
    }
    return trimmed;
  };

  const keepDate = function (value: string | null | undefined): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    const year = trimmed.match(/^(\d{4})(?:-(0[1-9]|1[0-2]))?$/);
    if (!year?.[1] || !pdfNumbers.has(year[1])) {
      omitted++;
      return undefined;
    }
    return trimmed;
  };

  return { keep, keepDate, omittedCount: () => omitted };
};

const normalizeUrl = function (value: string | undefined) {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return undefined;
  }
};

const validEmail = function (value: string | undefined) {
  return value && EMAIL.safeParse(value).success ? value : undefined;
};

const compact = function <T extends object>(entry: T) {
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined && value !== "")) as T;
};

const toProfile = function (extracted: Extracted, pdfText: string) {
  const { keep, keepDate, omittedCount } = buildGrounding(pdfText);
  const keepAll = (values: string[] | null | undefined) => (values ?? []).map(keep).filter((v): v is string => !!v);

  const info = extracted.personalInfo;
  const personalInfo = info
    ? compact({
        firstName: keep(info.firstName),
        lastName: keep(info.lastName),
        email: validEmail(keep(info.email)),
        phone: keep(info.phone),
        location: keep(info.location),
        title: keep(info.title),
        summary: keep(info.summary),
      })
    : undefined;

  const experience = (extracted.experience ?? [])
    .map(entry => {
      const achievements = keepAll(entry.achievements);
      return {
        company: keep(entry.company) ?? "",
        position: keep(entry.position) ?? "",
        // Required by the schema; left empty rather than guessed, so the editor asks.
        startDate: keepDate(entry.startDate) ?? "",
        ...compact({
          endDate: entry.current ? undefined : keepDate(entry.endDate),
          description: keep(entry.description),
        }),
        ...(entry.current && { current: true }),
        ...(achievements.length && { achievements }),
      };
    })
    .filter(entry => entry.company || entry.position);

  const education = (extracted.education ?? [])
    .map(entry => ({
      school: keep(entry.school) ?? "",
      degree: keep(entry.degree) ?? "",
      startDate: keepDate(entry.startDate) ?? "",
      ...compact({
        field: keep(entry.field),
        endDate: entry.current ? undefined : keepDate(entry.endDate),
        gpa: keep(entry.gpa),
      }),
      ...(entry.current && { current: true }),
    }))
    .filter(entry => entry.school || entry.degree);

  const skills = keepAll((extracted.skills ?? []).map(skill => skill.name ?? "")).map(name => ({ name }));

  const languages = (extracted.languages ?? []).flatMap(entry => {
    const name = keep(entry.name);
    if (!name) return [];
    const proficiency = PROFICIENCY.find(level => level === entry.proficiency?.trim().toLowerCase());
    return [{ name, ...(proficiency && { proficiency }) }];
  });

  const certifications = (extracted.certifications ?? []).flatMap(entry => {
    const name = keep(entry.name);
    if (!name) return [];
    return [{ name, issuer: keep(entry.issuer) ?? "", ...compact({ date: keepDate(entry.date), expiry: keepDate(entry.expiry) }) }];
  });

  const projects = (extracted.projects ?? []).flatMap(entry => {
    const name = keep(entry.name);
    if (!name) return [];
    const technologies = keepAll(entry.technologies);
    return [
      {
        name,
        ...compact({ description: keep(entry.description), url: normalizeUrl(keep(entry.url)) }),
        ...(technologies.length && { technologies }),
      },
    ];
  });

  const references = (extracted.references ?? []).flatMap(entry => {
    const name = keep(entry.name);
    if (!name) return [];
    return [
      compact({
        name,
        position: keep(entry.position),
        company: keep(entry.company),
        email: validEmail(keep(entry.email)),
        phone: keep(entry.phone),
      }),
    ];
  });

  const profile = resumeDataSchema.parse({
    ...(personalInfo && Object.keys(personalInfo).length && { personalInfo }),
    ...(experience.length && { experience }),
    ...(education.length && { education }),
    ...(skills.length && { skills }),
    ...(languages.length && { languages }),
    ...(certifications.length && { certifications }),
    ...(projects.length && { projects }),
    ...(references.length && { references }),
  });

  const report: ImportReport = {
    omittedValues: omittedCount(),
    entriesMissingDates: [...experience, ...education].filter(entry => !entry.startDate).length,
  };

  return { profile, report };
};

export class ResumeImportService {
  /*
    Free, deliberately (client CLAUDE.md §31, decision 5): typing a career
    history on a phone is where new users quit, and every paid feature improves
    once the profile is full. It still counts against the daily AI quota.

    Returns the profile for the user to review; it is never saved here. The PDF
    itself is never stored.
  */
  async importFromPdf(userId: string, file: Buffer): Promise<{ profile: ResumeDataInput; report: ImportReport }> {
    if (!isPdf(file)) throw new PdfUnreadableError();

    let pdfText: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(file));
      ({ text: pdfText } = await extractText(pdf, { mergePages: true }));
    } catch {
      throw new PdfUnreadableError();
    }

    if (pdfText.replace(/\s+/g, "").length < MIN_TEXT_CHARS) throw new PdfNoTextError();

    await consumeAiQuota(userId);

    const source = pdfText.slice(0, MAX_TEXT_CHARS);
    const { result } = await generateJson({
      system: IMPORT_SYSTEM_PROMPT,
      prompt: source,
      schema: extractedSchema,
      temperature: 0,
      reasoningEffort: "low",
      maxTokens: 8192,
    });

    return toProfile(result, source);
  }
}

export { toProfile as buildImportedProfile };
