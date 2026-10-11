import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { UnauthorizedError } from "./errors";
import { getEnv } from "./get-env";

export type SocialProvider = "GOOGLE" | "APPLE";

export interface SocialIdentity {
  provider: SocialProvider;
  // The only field safe to key an account on.
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_pic: string | null;
}

// Module-level on purpose: createRemoteJWKSet caches keys, so one per call would refetch
// the provider's key set on every sign-in.
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

const splitList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

// The audience check ties the signature to our client; without it a token issued to another
// app for the same user would verify.
const googleAudiences = () => {
  const { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } = getEnv([
    "GOOGLE_WEB_CLIENT_ID",
    "GOOGLE_IOS_CLIENT_ID",
    "GOOGLE_ANDROID_CLIENT_ID",
  ]);

  return [...splitList(GOOGLE_WEB_CLIENT_ID), ...splitList(GOOGLE_IOS_CLIENT_ID), ...splitList(GOOGLE_ANDROID_CLIENT_ID)];
};

// Apple's audience is the bundle id on iOS but the Services ID elsewhere; both must be accepted.
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
          // Google issues tokens under both spellings; accepting only the https form rejects real ones.
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
