import type { ResumeDataInput } from "../schemas/resume-data";

export interface JobKeyword {
  term: string;
  required: boolean;
}

export interface KeywordCoverage {
  score: number;
  total: number;
  matched: string[];
  missing: JobKeyword[];
}

/*
  Lower-cases and reduces everything but letters, digits, "+" and "#" to single
  spaces, padded at both ends — so a term matches only as whole words
  (" sql " is not found in " nosql "), and "C++", "C#" and "Node.js"
  normalise the same way on both sides.
*/
export const normalizeText = function (text: string) {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim()} `;
};

export const containsTerm = function (normalizedText: string, term: string) {
  const needle = normalizeText(term);
  return needle.trim().length > 0 && normalizedText.includes(needle);
};

export const resumeText = function (data: ResumeDataInput) {
  const parts: (string | undefined)[] = [data.personalInfo?.title, data.personalInfo?.summary];

  for (const entry of data.experience ?? []) parts.push(entry.position, entry.company, entry.description, ...(entry.achievements ?? []));
  for (const entry of data.education ?? []) parts.push(entry.degree, entry.field, entry.school);
  for (const entry of data.projects ?? []) parts.push(entry.name, entry.description, ...(entry.technologies ?? []));
  parts.push(...(data.skills ?? []).map(skill => skill.name));
  parts.push(...(data.certifications ?? []).map(cert => cert.name));
  parts.push(...(data.languages ?? []).map(language => language.name));

  return parts.filter(Boolean).join("\n");
};

export const dedupeKeywords = function (keywords: JobKeyword[]) {
  const seen = new Map<string, JobKeyword>();
  for (const keyword of keywords) {
    const key = normalizeText(keyword.term);
    if (!key.trim()) continue;
    const existing = seen.get(key);
    if (!existing) seen.set(key, { term: keyword.term.trim(), required: keyword.required });
    else existing.required ||= keyword.required;
  }
  return [...seen.values()];
};

export const computeCoverage = function (keywords: JobKeyword[], data: ResumeDataInput): KeywordCoverage {
  const text = normalizeText(resumeText(data));
  const matched: string[] = [];
  const missing: JobKeyword[] = [];

  for (const keyword of keywords) {
    if (containsTerm(text, keyword.term)) matched.push(keyword.term);
    else missing.push(keyword);
  }

  missing.sort((a, b) => Number(b.required) - Number(a.required));

  return {
    score: keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0,
    total: keywords.length,
    matched,
    missing,
  };
};

// "one" is left out: it is far more often a pronoun than a quantity.
const NUMBER_WORDS: Record<string, string> = {
  two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", forty: "40", fifty: "50", hundred: "100",
};

// Written-out numbers count too: in testing, a model wrote "three million"
// where the digits would have been caught.
export const numbersIn = function (text: string) {
  const digits = (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map(number => number.replace(/,/g, ""));
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? []).flatMap(word => NUMBER_WORDS[word] ?? []);
  return new Set([...digits, ...words]);
};

const STOPWORDS = new Set([
  "with", "that", "from", "this", "have", "using", "into", "over", "more", "than", "were", "been", "they",
  "their", "which", "also", "across", "while", "through", "within", "about", "when", "where", "your", "will",
]);

// A crude plural strip, applied to both sides of every comparison, so
// "service" and "services" count as the same word.
const stem = function (word: string) {
  return word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word;
};

export const contentWords = function (texts: string[], ignored: ReadonlySet<string> = new Set()) {
  return new Set(
    normalizeText(texts.join(" "))
      .split(" ")
      .filter(word => word.length >= 4 && !STOPWORDS.has(word) && !ignored.has(word))
      .map(stem),
  );
};

// Share of the candidate text's content words that also appear in the source.
export const groundedShare = function (candidate: string[], source: ReadonlySet<string>, ignored?: ReadonlySet<string>) {
  const words = contentWords(candidate, ignored);
  if (words.size === 0) return 1;

  let shared = 0;
  for (const word of words) if (source.has(word)) shared++;
  return shared / words.size;
};

export interface EvidencedTerm {
  term: string;
  evidence: string;
}

/*
  Decides whether model-written text claims only what the candidate's own
  material supports. A job keyword the source lacks is allowed only when the
  model quoted source text as evidence for it and the quote really is there;
  a number is allowed only when the given number source contains it.
*/
export const buildClaimGuard = function (sourceText: string, keywords: JobKeyword[], newTerms: EvidencedTerm[] = []) {
  const source = normalizeText(sourceText);

  const addedTerms = newTerms.filter(
    entry => entry.term.trim() && entry.evidence.trim().length >= 2 && containsTerm(source, entry.evidence),
  );
  const allowed = new Set(addedTerms.map(entry => normalizeText(entry.term)));
  const blocked = keywords.filter(keyword => !containsTerm(source, keyword.term) && !allowed.has(normalizeText(keyword.term)));

  const isSupported = function (text: string, numberSource: string) {
    const sourceNumbers = numbersIn(numberSource);
    const normalized = normalizeText(text);
    const inventsNumber = [...numbersIn(text)].some(number => !sourceNumbers.has(number));
    const usesBlockedTerm = blocked.some(keyword => containsTerm(normalized, keyword.term));
    return !inventsNumber && !usesBlockedTerm;
  };

  return { addedTerms, isSupported };
};
