import { AppError } from "./errors.js";

const SHORT_ORIGIN = "https://share.gemini.google";
const GEMINI_ORIGIN = "https://gemini.google.com";
const SHORT_PATH = /^\/([a-zA-Z0-9_-]{1,64})\/?$/;
const SHARE_PATH = /^\/share\/([a-zA-Z0-9_-]{1,64})\/?$/;
const MAX_BYTES = 3_000_000;
const MAX_TEXT = 100_000;

// The public share page loads the conversation separately from its HTML.
// This is Gemini's undocumented, anonymous share reader.
const SHARE_RPC = "ujx1Bf";
const SHARE_ENDPOINT = `${GEMINI_ORIGIN}/_/BardChatUi/data/batchexecute?rpcids=${SHARE_RPC}`;

function shareId(url: URL, origin: string, path: RegExp) {
  if (url.origin !== origin || url.username || url.password) return undefined;
  return path.exec(url.pathname)?.[1];
}

export function isGeminiShare(url: string) {
  const link = new URL(url);
  return Boolean(
    shareId(link, SHORT_ORIGIN, SHORT_PATH) ||
    shareId(link, GEMINI_ORIGIN, SHARE_PATH),
  );
}

function unavailable(reason: string) {
  return new AppError(
    "RECIPE_PAGE_UNAVAILABLE",
    "Could not read that Gemini conversation. Paste the recipe text instead.",
    422,
    { cause: reason },
  );
}

export async function fetchGeminiShare(
  url: string,
  fetcher = fetch,
): Promise<string> {
  const link = new URL(url);
  const signal = AbortSignal.timeout(15_000);
  const options = { redirect: "manual", signal } as const;
  try {
    let id = shareId(link, GEMINI_ORIGIN, SHARE_PATH);
    if (shareId(link, SHORT_ORIGIN, SHORT_PATH)) {
      // The short URL has a different ID. Only trust a redirect to /share/
      // on Gemini itself, and never follow it to fetch the HTML shell.
      const response = await fetcher(link, options);
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (response.status >= 300 && response.status < 400 && location) {
        id = shareId(new URL(location, link), GEMINI_ORIGIN, SHARE_PATH);
      }
    }
    if (!id) throw unavailable("Missing Gemini share ID");

    const response = await fetcher(SHARE_ENDPOINT, {
      ...options,
      method: "POST",
      body: new URLSearchParams({
        "f.req": JSON.stringify([
          [[SHARE_RPC, JSON.stringify([null, id, [4]]), null, "generic"]],
        ]),
      }),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw unavailable(`Gemini share HTTP ${response.status}`);
    }
    const transcript = shareTranscript(await readResponse(response.body));
    if (!transcript) throw unavailable("No messages in Gemini share response");
    if (transcript.length > MAX_TEXT)
      throw unavailable("Gemini share transcript too long");
    return transcript;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable("Could not fetch or parse Gemini share response");
  }
}

async function readResponse(body: NonNullable<Response["body"]>) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES)
        throw unavailable("Gemini share response too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

function at(value: unknown, ...path: number[]): unknown {
  for (const index of path) {
    if (!Array.isArray(value)) return undefined;
    value = value[index];
  }
  return value;
}

function shareTranscript(body: string) {
  // batchexecute prefixes its response with an XSSI guard and sends each
  // JSON frame on a separate line, preceded by its byte count.
  for (const line of body.split("\n")) {
    if (!line.startsWith("[")) continue;
    const rows: unknown = JSON.parse(line);
    if (!Array.isArray(rows)) continue;
    for (const row of rows as unknown[]) {
      if (at(row, 0) !== "wrb.fr" || at(row, 1) !== SHARE_RPC) continue;
      const payload = at(row, 2);
      if (typeof payload !== "string") continue;
      const turns = at(JSON.parse(payload), 0, 1);
      if (!Array.isArray(turns)) continue;
      return (turns as unknown[])
        .flatMap((turn) => {
          const question = at(turn, 2, 0, 0);
          const reply = at(turn, 3, 0, 0, 1, 0);
          return [
            typeof question === "string" && question.trim()
              ? `User: ${question}`
              : null,
            typeof reply === "string" && reply.trim()
              ? `Gemini: ${reply}`
              : null,
          ].filter(Boolean);
        })
        .join("\n\n");
    }
  }
}
