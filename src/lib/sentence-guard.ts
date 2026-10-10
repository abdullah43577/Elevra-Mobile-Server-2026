import { groundedShare } from "./keyword-match";

/*
  Sentence-level grounding for model-written prose — cover letters (F6) and
  application messages (F7). A sentence survives only if the caller's own claim
  check passes and at least half its substantive words appear in the source
  material, ignoring the ordinary vocabulary such prose is made of.
*/

export const MIN_GROUNDING = 0.5;

/*
  Ordinary letter vocabulary, ignored when measuring grounding. Without it the
  polite parts of a letter ("I'd welcome the chance to talk") would count as
  unsupported claims and be removed.
*/
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

// A model told to stick to the resume will sometimes narrate it instead ("The
// resume lists Node.js…"). True, grounded, and useless in a letter.
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
  /** The caller's own check — numbers, evidenced keywords. */
  isSupported: (sentence: string) => boolean;
  /** Omitted for prose with no facts to ground, such as accepting an offer. */
  grounding?: { source: ReadonlySet<string>; vocabulary: ReadonlySet<string> };
}

/*
  Drops greetings and sign-offs the model adds anyway, then every sentence that
  narrates its input, fails the caller's check, or is not grounded. Returns
  what is left and what was removed.
*/
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
