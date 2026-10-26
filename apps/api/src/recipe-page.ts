import { lookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";

import { AppError } from "./errors.js";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3_000_000;
const MAX_TEXT = 100_000;
const TIMEOUT_MS = 15_000;

// Loopback, private, link-local (cloud metadata), CGNAT, multicast, reserved,
// and IPv6 unique-local, which covers Fly's fdaa:: private network. BlockList
// checks IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4 ranges.
const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !privateRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Resolves like dns.lookup, but fails when any address is private, so the
 *  socket can only ever connect to an address that passed the check. */
const publicLookup = ((hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const resolved = addresses as LookupAddress[];
    const first = resolved[0];
    if (!first || !resolved.every((a) => isPublicAddress(a.address)))
      return callback(
        new Error(`${hostname} resolves to a private address`),
        "",
        0,
      );
    if (options.all) return callback(null, resolved);
    callback(null, first.address, first.family);
  });
}) as LookupFunction;

function unavailable(reason: string) {
  return new AppError(
    "RECIPE_PAGE_UNAVAILABLE",
    "Could not open that page. Check the link or try another one.",
    422,
    { cause: reason },
  );
}

const SHELL_ONLY_HOSTS = ["instagram.com"];

/** Sites that serve Google's fetcher a page shell without the recipe. Asking
 *  Gemini to fetch them only costs a call, so we read them ourselves. */
export function geminiSeesOnlyAShell(url: string): boolean {
  const host = new URL(url).hostname;
  return SHELL_ONLY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The page's HTML, fetched from the public internet only. */
export async function fetchRecipePage(url: string): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await get(current, signal);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      response.resume();
      current = new URL(location, current);
      continue;
    }
    if (status !== 200) {
      response.resume();
      throw unavailable(`HTTP ${status}`);
    }
    return readBody(response);
  }
  throw unavailable("Too many redirects");
}

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return Promise.reject(unavailable(`Scheme ${url.protocol}`));
  // A literal IP never goes through the lookup, so check it here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host))
    return Promise.reject(unavailable(`${host} is a private address`));
  return new Promise((resolve, reject) => {
    (url.protocol === "https:" ? https : http)
      .get(
        url,
        {
          lookup: publicLookup,
          signal,
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; Magpie recipe import)",
            accept: "text/html,application/xhtml+xml",
            "accept-encoding": "gzip, deflate, br",
          },
        },
        resolve,
      )
      .on("error", (error) => reject(unavailable(error.message)));
  });
}

async function readBody(response: IncomingMessage): Promise<string> {
  const encoding = response.headers["content-encoding"];
  const body =
    encoding === "gzip"
      ? response.pipe(zlib.createGunzip())
      : encoding === "deflate"
        ? response.pipe(zlib.createInflate())
        : encoding === "br"
          ? response.pipe(zlib.createBrotliDecompress())
          : response;
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      chunks.push(chunk as Buffer);
      size += (chunk as Buffer).length;
      // Recipe content sits well before this; the rest is comments and ads.
      if (size >= MAX_BYTES) break;
    }
  } catch (error) {
    throw unavailable((error as Error).message);
  } finally {
    response.destroy();
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** What the model reads: structured recipe data for the facts, and the page
 *  text for what sites keep outside it, such as optionals, swaps and tips. */
export function recipePageText(html: string): string {
  const structured = [
    ...html.matchAll(
      /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map(([, json = ""]) => json.trim())
    .filter((json) => json.includes('"Recipe"'));
  const description = pageDescription(html);
  const text = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(
        /<(script|style|noscript|svg|template|iframe|nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return [
    structured.length
      ? `Structured recipe data (JSON-LD):\n${structured.join("\n")}`
      : null,
    description ? `Page description:\n${description}` : null,
    `Page text:\n${text}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT);
}

/** Social posts, such as Instagram's, keep the caption only in the page's
 *  description meta tags. The longest one is the fullest. */
function pageDescription(html: string): string | null {
  const descriptions = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) =>
      /\b(?:name|property)=["'](?:og:|twitter:)?description["']/i.test(tag),
    )
    .map((tag) => decodeEntities(/\bcontent="([^"]*)"/i.exec(tag)?.[1] ?? ""))
    .sort((a, b) => b.length - a.length);
  return descriptions[0]?.trim() || null;
}

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, name: string) => {
      if (name[0] !== "#") return namedEntities[name.toLowerCase()] ?? entity;
      const hex = /^#x/i.test(name);
      const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    },
  );
}
