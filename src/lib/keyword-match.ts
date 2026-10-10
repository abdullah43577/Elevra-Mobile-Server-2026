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

export const numbersIn = function (text: string) {
  return new Set((text.match(/\d+(?:[.,]\d+)*/g) ?? []).map(number => number.replace(/,/g, "")));
};
