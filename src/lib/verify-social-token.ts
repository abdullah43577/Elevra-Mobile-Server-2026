import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { UnauthorizedError } from "./errors";
import { getEnv } from "./get-env";

export type SocialProvider = "GOOGLE" | "APPLE";

export interface SocialIdentity {
  provider: SocialProvider;
  /** The provider's stable subject id. The only field safe to key an account on. */
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_pic: string | null;
}

/*
  The client is untrusted input, so it never sends us "this is who I am" — it
  sends the provider's signed ID token and we check the signature ourselves.

  createRemoteJWKSet caches the provider's keys and re-fetches on an unknown
  `kid`, so these are module-level singletons on purpose: one per process, not
  one per request. Building them inside the verify call would fetch Google's or
  Apple's key set on every sign-in.
*/
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const splitList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/*
  Every OAuth client id the token may legitimately be addressed to.

  Getting this wrong is the classic ID-token bug: a token verifies perfectly
  against Google's keys and is still worthless to us, because it was issued to
  somebody else's app for the same user. The audience check is what ties the
  signature to *our* client.

  Android is included even though the client never sends an android client id —
  google-signin asks for an idToken audienced to the *web* client id, and the
  android entry is only here for setups that configure it explicitly.
*/
const googleAudiences = () => {
  const { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } = getEnv([
    "GOOGLE_WEB_CLIENT_ID",
    "GOOGLE_IOS_CLIENT_ID",
    "GOOGLE_ANDROID_CLIENT_ID",
  ]);

  return [...splitList(GOOGLE_WEB_CLIENT_ID), ...splitList(GOOGLE_IOS_CLIENT_ID), ...splitList(GOOGLE_ANDROID_CLIENT_ID)];
};

/*
  On iOS the audience is the app's bundle id. On Android and the web it is the
  Services ID configured in the Apple developer portal, which is a different
  string for the same app — both have to be accepted or Apple sign-in works on
  exactly one platform.
*/
const appleAudiences = () => {
  const { APPLE_BUNDLE_ID, APPLE_SERVICE_ID } = getEnv(["APPLE_BUNDLE_ID", "APPLE_SERVICE_ID"]);

  return [...splitList(APPLE_BUNDLE_ID), ...splitList(APPLE_SERVICE_ID)];
};

// Apple sends email_verified as the *string* "true" on some tokens and a real
// boolean on others. Google has done both historically too.
const asBoolean = (value: unknown) => value === true || value === "true";

const nameFromClaims = (payload: JWTPayload) => {
  const given = typeof payload.given_name === "string" ? payload.given_name : null;
  const family = typeof payload.family_name === "string" ? payload.family_name : null;

  if (given || family) return { first_name: given, last_name: family };

  // Apple never puts a name in the token; Google occasionally supplies only the
  // display name. Splitting on the first space is a guess, but a better one
  // than leaving the profile blank.
  const full = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!full) return { first_name: null, last_name: null };

  const [first, ...rest] = full.split(/\s+/);
  return { first_name: first ?? null, last_name: rest.length ? rest.join(" ") : null };
};

const verify = async function (token: string, options: { jwks: ReturnType<typeof createRemoteJWKSet>; issuer: string[]; audience: string[]; provider: SocialProvider }) {
  if (!options.audience.length) {
    throw new UnauthorizedError(`${options.provider === "GOOGLE" ? "Google" : "Apple"} sign-in is not configured on this server`);
  }

  try {
    const { payload } = await jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      audience: options.audience,
      // Signature, issuer, audience and expiry are all checked by jwtVerify.
      // A clock skew allowance keeps a phone whose clock is a few seconds fast
      // from being rejected on a token that is genuinely valid.
      clockTolerance: 30,
    });

    return payload;
  } catch {
    // Never surface the underlying reason. "audience mismatch" versus "expired"
    // versus "bad signature" tells an attacker which knob to turn.
    throw new UnauthorizedError("That sign-in could not be verified. Please try again.");
  }
};

export const verifySocialToken = async function (provider: SocialProvider, idToken: string): Promise<SocialIdentity> {
  const payload =
    provider === "GOOGLE"
      ? await verify(idToken, {
          jwks: GOOGLE_JWKS,
          // Google has issued tokens under both spellings for years and still
          // does. Accepting only the https form rejects real tokens.
          issuer: ["https://accounts.google.com", "accounts.google.com"],
          audience: googleAudiences(),
          provider,
        })
      : await verify(idToken, {
          jwks: APPLE_JWKS,
          issuer: ["https://appleid.apple.com"],
          audience: appleAudiences(),
          provider,
        });

  if (!payload.sub) throw new UnauthorizedError("That sign-in could not be verified. Please try again.");

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const { first_name, last_name } = nameFromClaims(payload);

  return {
    provider,
    providerId: payload.sub,
    email,
    emailVerified: asBoolean(payload.email_verified),
    first_name,
    last_name,
    profile_pic: provider === "GOOGLE" && typeof payload.picture === "string" ? payload.picture : null,
  };
};
