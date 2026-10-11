import dns, { type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import zlib from "node:zlib";
import { AppError } from "./errors";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; Elevra/1.0; job posting import)";

export class InvalidLinkError extends AppError {
  constructor(message = "That link can't be imported. Use the address of a public job posting.") {
    super(message, 400, "INVALID_LINK");
  }
}

export class FetchBlockedError extends AppError {
  constructor(message = "We couldn't read that page. Paste the posting text instead.") {
    super(message, 422, "FETCH_BLOCKED");
  }
}

// Checked against the address the socket connects to, not the url, so a hostname that
// resolves internally, or DNS rebinding between check and connect, cannot slip past.
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv4");
}
// No ::ffff:0:0/96 rule: BlockList matches IPv4 against IPv6 rules in mapped form, so it would
// block all of IPv4. Mapped addresses are unwrapped and checked as IPv4 instead.
for (const [network, prefix] of [
  ["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["64:ff9b::", 96],
] as const) {
  PRIVATE.addSubnet(network, prefix, "ipv6");
}

const mappedIPv4 = function (address: string) {
  const match = address.toLowerCase().match(/^::ffff:(.+)$/);
  if (!match?.[1]) return null;
  if (isIP(match[1]) === 4) return match[1];

  const groups = match[1].split(":");
  if (groups.length !== 2 || !groups.every(group => /^[0-9a-f]{1,4}$/.test(group))) return null;
  const [high, low] = groups.map(group => parseInt(group, 16)) as [number, number];
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
};

const isPrivateAddress = function (address: string) {
  const family = isIP(address);
  if (family === 0) return true;
  const unwrapped = family === 6 ? mappedIPv4(address) : null;
  if (unwrapped) return PRIVATE.check(unwrapped, "ipv4");
  return PRIVATE.check(address, family === 6 ? "ipv6" : "ipv4");
};

const guardedLookup = function (
  hostname: string,
  options: dns.LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 4);
    }
    if (options.all) return callback(null, addresses);
    const [first] = addresses;
    callback(null, first!.address, first!.family);
  });
};

const validateUrl = function (raw: string | URL) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidLinkError();
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new InvalidLinkError();
  if (url.username || url.password) throw new InvalidLinkError();
  if (url.port && url.port !== "80" && url.port !== "443") throw new InvalidLinkError();

  // Node never calls the lookup for an IP literal, so those are checked here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) throw new InvalidLinkError();
  return url;
};

const decoderFor = function (encoding: string | undefined) {
  if (encoding === "gzip" || encoding === "x-gzip") return zlib.createGunzip();
  if (encoding === "deflate") return zlib.createInflate();
  if (encoding === "br") return zlib.createBrotliDecompress();
  return null;
};

const requestOnce = function (url: URL) {
  return new Promise<{ status: number; location?: string; contentType: string; body: string }>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      {
        lookup: guardedLookup as never,
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en",
        },
      },
      response => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400) {
          response.resume();
          return resolve({ status, ...(location && { location }), contentType: "", body: "" });
        }

        const decoder = decoderFor(response.headers["content-encoding"]);
        const stream = decoder ? response.pipe(decoder) : response;
        const chunks: Buffer[] = [];
        let size = 0;

        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy();
            reject(new FetchBlockedError("That page is too large to read. Paste the posting text instead."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks).toString("utf8") }));
        stream.on("error", () => reject(new FetchBlockedError()));
      },
    );

    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error: NodeJS.ErrnoException) => {
      reject(error.code === "EBLOCKED" ? new InvalidLinkError() : new FetchBlockedError());
    });
  });
};

// Redirects are followed by hand so every hop is re-validated against the private-address rules.
export const fetchPublicPage = async function (rawUrl: string) {
  let url = validateUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await requestOnce(url);

    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw new FetchBlockedError();
      url = validateUrl(new URL(response.location, url));
      continue;
    }

    if (response.status < 200 || response.status >= 300) throw new FetchBlockedError();
    if (!/text\/html|application\/xhtml|text\/plain/i.test(response.contentType)) throw new FetchBlockedError();

    return { finalUrl: url, html: response.body };
  }

  throw new FetchBlockedError();
};
