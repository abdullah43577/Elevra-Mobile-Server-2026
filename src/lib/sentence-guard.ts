import { groundedShare } from "./keyword-match";

export const MIN_GROUNDING = 0.5;

export const LETTER_VOCABULARY: ReadonlySet<string> = new Set([
  "welcome", "chance", "talk", "discuss", "discussing", "look", "looking", "forward", "help", "helping", "team", "teams",
  "role", "position", "apply", "applying", "application", "opportunity", "contribute", "contributing", "bring", "bringing",
  "work", "working", "thank", "thanks", "interest", "interested", "excited", "happy", "would", "love", "join", "joining",
  "company", "believe", "skill", "skills", "background", "experience", "experienced", "match", "matches", "mirror",
  "mirrors", "align", "aligns", "aligned", "fits", "current", "currently", "recent", "recently", "previous", "previously",
  "most", "particularly", "especially", "directly", "there", "these", "those", "what", "make", "made", "making", "such",
  "like", "just", "well", "both", "each", "many", "much", "very", "here", "time", "year", "years", "past", "last", "next",
  "first", "them", "then", "know", "value", "goal", "goals", "ready", "able", "eager", "keen", "appeal", "appeals",
  "appealing", "drawn", "speak", "call", "conversation", "meet", "meeting", "strong", "solid", "hands", "deep", "great",
  "good", "including", "include", "includes",
]);

export const META_REFERENCE = /\b(the|this) (resume|candidate|posting|job description)\b|\bcandidate['’]?s?\b/i;

export const GREETING = /^(dear|hi|hello|to whom)\b/i;
export const SIGN_OFF = /^(sincerely|best( regards)?|kind regards|warm regards|regards|yours( truly| sincerely)?|thank you)[,.!]?$/i;

// Splits only where end punctuation is followed by whitespace, so "2.5 million"
// stays one token for the number check.
export const splitSentences = function (paragraph: string) {
  return paragraph
    .split(/(?<=[.!?]["”’)]?)\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
};

interface FilterOptions {
  isSupported: (sentence: string) => boolean;
  grounding?: { source: ReadonlySet<string>; vocabulary: ReadonlySet<string> };
}

export const filterSentences = function (paragraphs: string[], { isSupported, grounding }: FilterOptions) {
  const removed: string[] = [];

  const kept = paragraphs
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph && !GREETING.test(paragraph) && !SIGN_OFF.test(paragraph))
    .map(paragraph =>
      splitSentences(paragraph)
        .filter(sentence => {
          const supported =
            !META_REFERENCE.test(sentence) &&
            isSupported(sentence) &&
            (!grounding || groundedShare([sentence], grounding.source, grounding.vocabulary) >= MIN_GROUNDING);
          if (!supported) removed.push(sentence);
          return supported;
        })
        .join(" "),
    )
    .filter(Boolean);

  return { paragraphs: kept, removed };
};
