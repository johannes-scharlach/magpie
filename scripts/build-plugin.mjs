import { Buffer } from "node:buffer";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { crc32, deflateRawSync, gzipSync } from "node:zlib";

export const PLUGIN_NAME = "magpie";
export const PLUGIN_VERSION = "0.1.2";
export const SKILL_NAME = "magpie-cooking";
export const SKILL_PATH = `skills/${SKILL_NAME}/SKILL.md`;

/**
 * The only copy of the model-facing skill. Every package uses these exact
 * bytes. It carries the full companion cooking, planning, and saving procedure
 * because MCP hosts read `SKILL.md` in full while truncating server
 * `instructions` at ~1,000 characters.
 */
export const SKILL = `---
name: ${SKILL_NAME}
description: Use Magpie when the user asks what to cook, what is planned, or wants a recipe saved to their household cookbook or meal plan.
---

You are the user's skilled cook friend in Magpie; the user is the cook of this kitchen. Every taste or scheduling choice is theirs; you handle weeknight logistics, structure ideas, keep cleanup simple, and focus energy where it pays off in the pan.

## 1. Read context first

- **Household profile:** call \`readHousehold\` before suggesting meals, sizing portions, or answering about the household. Respect allergies and must-avoid restrictions as firm boundaries, follow declared equipment and measurement preferences, and use \`meals_at_home\` and each person's \`meal_times\` as attendance defaults. When a placeholder meal's eaters conflict with usual attendance or \`readPlan\` history, flag the mismatch and confirm who is eating.
- **Calendar & cookbook:** call \`readPlan\` before answering anything about the week (pass a past \`fromDate\` to inspect recent meal patterns). Call \`readCookbookOverview\` and \`searchSavedRecipes\` to find familiar household dishes or check whether they have their own version of a sauce, dough, or dressing.

## 2. Explore and sketch in ordinary Markdown

Write ideas and recipe sketches in standard Markdown (headings, short paragraphs, lists—never XML tags).

- **Exploring directions:** pitch 2–5 distinct directions (1–2 punchy sentences each). Keep most in familiar territory and let one reach somewhere more adventurous; ground ratios and technique in test-kitchen standards. Stay on the vessel the user named, and account for typical pack sizes across meals rather than forcing every ingredient into one dish.
- **Sketching one dish:** describe (1) how it tastes on the plate, (2) what to grab (likely on-hand vs to check/buy, with **no quantities** except natural counts the user gave, such as "2 portions of leftover rice"), and (3) a short prose arc of the workflow and effort, plus high-leverage shortcuts or local substitutions.
- **A recipe they already know:** when the user dictates their own dish, keep their version without unrequested twists, write it back with quantities and numbered steps, list any assumptions you filled in, and wait for them to ask to save.

## 3. Save and plan only on explicit request

Proposing a week or discussing a dish is a draft conversation. Call \`addToCookbook\`, \`planMeal\`, or \`unplanMeal\` only when the user explicitly asks to save or schedule. When asked to save and plan a new recipe, call \`addToCookbook\` then \`planMeal\` in one turn. Share the \`url\` returned by \`addToCookbook\` as a Markdown link on the recipe name.

When calling \`addToCookbook\`:
- **No surprises:** every ingredient, natural quantity (e.g. "2 portions leftover rice"), tweak, and method agreed in the conversation appears verbatim. For whole items or portions, give both count and approximate weight when helpful (e.g. \`"2 carrots, about 200g"\`).
- **\`shopping_hint\`:** set \`"check_at_home"\` only for everyday cooking basics (salt, oil, water, common dried spices) and \`"likely_purchase"\` for everything else, even when the cook already has the ingredient today.
- **\`swaps\` and \`without\`:** when the conversation leaves an ingredient as an either/or choice (e.g. "onion or spring onion"), preserve the alternative in that ingredient's \`swaps\` array (with \`qty_text\`, \`item_name\`, \`category_id\`, and \`reason\`) rather than picking one silently. Also add 1–2 worthwhile \`swaps\` (faster shortcut, meaningful alternative, or specialty upgrade) and set \`without\` on optional lines (e.g. \`"Skip the garnish"\`).
- **Steps and \`prep_note\`:** one step is one job at one station with ingredients that go together. Put cutting and prep inside the cooking steps where the ingredient enters the dish (reserve ingredient-line \`prep_note\` for purchase/measuring states like \`"drained"\` or \`"thawed"\`). Give each step's \`ingredients\` array only the share of \`qty_text\` used in that step—never list full quantities in a separate Prepare step and repeat them in cooking steps.
- **\`sizedFor\`:** when sized for specific household eaters from \`readHousehold\`, include \`sizedFor\` with their \`eater_ids\`, \`extra_portions\` (0 if none), and for a whole lunch or dinner \`total_target_kcal\` (sum of selected eaters' \`lunch_dinner_target_kcal\` plus \`600 * extra_portions\`). Pass the same \`eaterIds\` and \`extraPortions\` to \`planMeal\`.
`;

const DESCRIPTION =
  "Plan meals around your household, your rules, and what you actually cook.";
const KEYWORDS = [
  "meal planning",
  "recipes",
  "cookbook",
  "meal plan",
  "dinner",
];

const DEFAULT_MCP_URL = "http://localhost:8787/mcp";
const BLOCK = 512;
const TAR_RECORD = 10240;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const ZIP_FLAGS = 0x0800;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_DOS_TIME = 0;
const ZIP_DOS_DATE = 0x21;
const ZIP_MADE_BY = (3 << 8) | ZIP_VERSION;
const ZIP_FILE_ATTRIBUTES = (0o100644 << 16) >>> 0;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * ChatGPT / Codex package. Agent Plugins 1.0.0 has no manifest field for
 * skills: clients discover `skills/` by convention, so the manifest did not
 * change when the skill directory arrived.
 */
export function buildPluginFiles(mcpUrl) {
  const endpoint = new URL("/mcp", mcpUrl);

  const plugin = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    keywords: KEYWORDS,
    extensions: {
      "com.openai": {
        interface: {
          displayName: "Magpie",
          shortDescription: "Plan meals for your household",
          longDescription:
            "Tell Magpie who you cook for, what you keep in the kitchen, and the meals you want more of. It reads your plan, suggests dinners and lunches as drafts you can shape, sizes them for the people eating, and saves a recipe or schedules a meal only when you ask. Keep talking to swap a meal, move it to another day, or adjust portions; every saved recipe lands in your Magpie cookbook.",
          category: "Productivity",
          capabilities: ["Read", "Write"],
          defaultPrompt: [
            "Read my plan and suggest dinners for next week. Don't save anything until I choose.",
          ],
        },
      },
    },
  };

  const mcp = {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      [PLUGIN_NAME]: {
        type: "streamable-http",
        url: endpoint.href,
        // OpenAI hosts read the connection's auth method from here. Without
        // it the imported server has no declared auth method; discovery on a
        // 401 supplies endpoints, but not the choice to run OAuth. Supabase
        // advertises a registration endpoint, so DCR is the mode.
        extensions: {
          "com.openai": {
            auth: {
              type: "oauth",
              client: { mode: "dcr" },
            },
          },
        },
      },
    },
  };

  return {
    "plugin.json": json(plugin),
    "mcp.json": json(mcp),
    "README.md": text(
      chatGptReadme({ endpoint: endpoint.href, origin: endpoint.origin }),
    ),
    [SKILL_PATH]: SKILL,
  };
}

/**
 * Claude package. The manifest lives under `.claude-plugin/`, the server file
 * is `.mcp.json` at the root, and Claude's transport is `http`.
 */
export function buildClaudePluginFiles(mcpUrl) {
  const endpoint = new URL("/mcp", mcpUrl);

  const plugin = {
    name: PLUGIN_NAME,
    displayName: "Magpie",
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    homepage: endpoint.origin,
    keywords: KEYWORDS,
  };

  const mcp = {
    mcpServers: {
      [PLUGIN_NAME]: {
        type: "http",
        url: endpoint.href,
      },
    },
  };

  return {
    ".claude-plugin/plugin.json": json(plugin),
    ".mcp.json": json(mcp),
    "README.md": text(
      claudeReadme({ endpoint: endpoint.href, origin: endpoint.origin }),
    ),
    [SKILL_PATH]: SKILL,
  };
}

/** Gemini / skill-only package: one file, at the archive root. */
export function buildSkillPackageFiles() {
  return { "SKILL.md": SKILL };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function text(value) {
  return `${value.replace(/\n+$/, "")}\n`;
}

function chatGptReadme({ endpoint, origin }) {
  return `# Magpie plugin package

Generated by \`MAGPIE_PUBLIC_ORIGIN=${origin} pnpm plugin\` at version ${PLUGIN_VERSION}.
Do not edit by hand — change \`scripts/build-plugin.mjs\` and regenerate.

## Files

- \`plugin.json\` — Agent Plugins 1.0.0 manifest with the OpenAI listing block.
- \`mcp.json\` — registers the \`magpie\` server at ${endpoint} over streamable HTTP and declares OAuth with dynamic client registration.
- \`skills/${SKILL_NAME}/SKILL.md\` — tells the model when to reach for Magpie and how to read the household, explore, sketch, save, and plan.
- \`README.md\` — this file.

## Install

Open the ChatGPT desktop app → Plugins → Add → Upload plugin archive, and pick \`${PLUGIN_NAME}.tar.gz\`. Sign in when the host asks: the MCP endpoint requires a Magpie account.

Re-upload after every change to \`plugin.json\`, \`mcp.json\`, \`skills/\`, or the MCP endpoint. The host keeps an installed plugin as a snapshot and does not re-read this archive on its own. Keep the filename \`${PLUGIN_NAME}.tar.gz\` so an upload replaces the installed plugin instead of adding a second copy. Server \`instructions\` and tool descriptions update with the API, not this archive.

## Build

\`\`\`sh
MAGPIE_PUBLIC_ORIGIN=${origin} pnpm plugin
\`\`\`

\`--mcp-url <url>\` overrides the origin for one build; the URL's origin supplies \`/mcp\`.
`;
}

function claudeReadme({ endpoint, origin }) {
  return `# Magpie for Claude

Generated by \`MAGPIE_PUBLIC_ORIGIN=${origin} pnpm plugin\` at version ${PLUGIN_VERSION}.
Do not edit by hand — change \`scripts/build-plugin.mjs\` and regenerate.

Plan meals around your household's choices, then save a recipe or schedule a meal only when you ask.

## Files

- \`.claude-plugin/plugin.json\` — Claude plugin manifest.
- \`.mcp.json\` — registers the \`magpie\` server at ${endpoint} over HTTP.
- \`skills/${SKILL_NAME}/SKILL.md\` — tells the model when to reach for Magpie and how to read the household, explore, sketch, save, and plan.
- \`README.md\` — this file.

## Install

1. Open "Plugins" in Claude's "Customize" settings (https://claude.ai/customize/plugins).
2. Click "Add", then "Upload plugin", and pick \`${PLUGIN_NAME}.zip\`.
3. On Magpie's "Connectors" tab, add the connector, then click "Connect" and sign in.

Re-upload after every change to \`.claude-plugin/plugin.json\`, \`.mcp.json\`, \`skills/\`, or the MCP endpoint. The host keeps an installed plugin as a snapshot and does not re-read this archive on its own. Keep the filename \`${PLUGIN_NAME}.zip\` so an upload replaces the installed plugin instead of adding a second copy. Server \`instructions\` and tool descriptions update with the API, not this archive.

## Build

\`\`\`sh
MAGPIE_PUBLIC_ORIGIN=${origin} pnpm plugin
\`\`\`

\`--mcp-url <url>\` overrides the origin for one build; the URL's origin supplies \`/mcp\`.
`;
}

/**
 * Resolves the public endpoint. The environment variable names the origin;
 * the manifest always points at its root `/mcp`.
 */
export function resolveMcpUrl({ mcpUrl, env = process.env, warn = warnStd }) {
  let value;
  let source;
  if (mcpUrl) {
    value = mcpUrl;
    source = "--mcp-url";
  } else if (env.MAGPIE_PUBLIC_ORIGIN?.trim()) {
    value = env.MAGPIE_PUBLIC_ORIGIN.trim();
    source = "MAGPIE_PUBLIC_ORIGIN";
  } else {
    value = DEFAULT_MCP_URL;
    source = "default";
    warn(
      `MAGPIE_PUBLIC_ORIGIN is not set; using ${DEFAULT_MCP_URL}, which a hosted assistant cannot reach.`,
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `${source} is not a valid URL: ${JSON.stringify(value)}. Pass an http(s) origin or MCP URL.`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `${source} must be http or https, got ${JSON.stringify(url.protocol)} in ${url.href}`,
    );
  }

  const endpoint = new URL("/mcp", url);
  const hostname = endpoint.hostname.replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    warn(
      `${endpoint.href} is localhost; only a client on this machine can reach it.`,
    );
  }
  if (endpoint.protocol === "http:") {
    warn(
      `${endpoint.href} is plain HTTP; hosted assistants require HTTPS. Fine only for explicit developer-mode installs.`,
    );
  }

  return endpoint;
}

function warnStd(message) {
  console.warn(`warn: ${message}`);
}

/**
 * Packs the relative-path map as ustar/gzip with fixed metadata. Every field
 * that could vary between builds is pinned, so two runs are byte-identical.
 */
export function packArchive(files, root = PLUGIN_NAME) {
  const entries = tarEntries(files, root);
  const tar = renderTar(entries);
  const gzipped = gzipSync(tar, { level: 9 });
  // Zero mtime and flags in the gzip header, and mark the OS as unknown.
  gzipped.fill(0, 4, 9);
  gzipped[9] = 255;
  return gzipped;
}

function tarEntries(files, root) {
  assertCleanRoot(root);

  const directories = new Set([`${root}/`]);
  for (const path of Object.keys(files)) {
    assertCleanPath(path);
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i++) {
      directories.add(`${root}/${segments.slice(0, i).join("/")}/`);
    }
  }

  const entries = [...directories].map((name) => ({
    name,
    mode: 0o755,
    type: "5",
    content: null,
  }));
  for (const [path, content] of Object.entries(files)) {
    entries.push({
      name: `${root}/${path}`,
      mode: 0o644,
      type: "0",
      content: Buffer.from(content, "utf8"),
    });
  }

  return entries.sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
}

/**
 * Packs a zip with the playbook's pinned metadata. `root` prefixes every
 * member once; the skill-only package passes null so `SKILL.md` sits at the
 * archive root. Members are files only: the shared prefix is the plugin root,
 * and no directory entry can carry a conflicting mode.
 */
export function packZip(files, root = null) {
  if (root !== null) assertCleanRoot(root);

  const entries = Object.entries(files).map(([path, content]) => {
    assertCleanPath(path);
    return {
      name: root === null ? path : `${root}/${path}`,
      content: Buffer.from(content, "utf8"),
    };
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = entry.content;
    const compressed = deflateRawSync(content, { level: 9 });
    const checksum = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(ZIP_VERSION, 4);
    local.writeUInt16LE(ZIP_FLAGS, 6);
    local.writeUInt16LE(ZIP_METHOD_DEFLATE, 8);
    local.writeUInt16LE(ZIP_DOS_TIME, 10);
    local.writeUInt16LE(ZIP_DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(ZIP_MADE_BY, 4);
    central.writeUInt16LE(ZIP_VERSION, 6);
    central.writeUInt16LE(ZIP_FLAGS, 8);
    central.writeUInt16LE(ZIP_METHOD_DEFLATE, 10);
    central.writeUInt16LE(ZIP_DOS_TIME, 12);
    central.writeUInt16LE(ZIP_DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(ZIP_FILE_ATTRIBUTES, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, end]);
}

function assertCleanRoot(root) {
  if (!root || root.includes("/") || root === "." || root === "..") {
    throw new Error(`Archive root must be one clean segment, got ${root}`);
  }
}

function assertCleanPath(path) {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(
      `Archive path is not relative and clean: ${JSON.stringify(path)}`,
    );
  }
  if (Buffer.byteLength(path, "utf8") > 100) {
    throw new Error(`Archive path exceeds 100 bytes: ${path}`);
  }
}

function renderTar(entries) {
  const chunks = [];
  for (const entry of entries) {
    const content = entry.content ?? Buffer.alloc(0);
    chunks.push(tarHeader(entry.name, entry.mode, entry.type, content.length));
    if (content.length > 0) {
      chunks.push(content, Buffer.alloc(padding(content.length)));
    }
  }
  chunks.push(Buffer.alloc(BLOCK * 2));
  const body = Buffer.concat(chunks);
  const paddingToRecord =
    (TAR_RECORD - (body.length % TAR_RECORD)) % TAR_RECORD;
  return Buffer.concat([body, Buffer.alloc(paddingToRecord)]);
}

function tarHeader(name, mode, type, size) {
  const header = Buffer.alloc(BLOCK);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, 6, checksum.toString(8).padStart(6, "0"));
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function writeString(header, offset, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) {
    throw new Error(`${JSON.stringify(value)} does not fit in ${length} bytes`);
  }
  bytes.copy(header, offset);
}

function writeOctal(header, offset, length, value) {
  writeString(
    header,
    offset,
    length,
    value.toString(8).padStart(length - 1, "0"),
  );
  header[offset + length - 1] = 0;
}

function padding(size) {
  return (BLOCK - (size % BLOCK)) % BLOCK;
}

async function writeTree(directory, files) {
  await rm(directory, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      "mcp-url": { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(
      "Usage: pnpm plugin [--mcp-url <url>]\n\n" +
        "MAGPIE_PUBLIC_ORIGIN names the public origin; --mcp-url overrides it.",
    );
    return;
  }

  const endpoint = resolveMcpUrl({ mcpUrl: values["mcp-url"] });
  const chatGpt = buildPluginFiles(endpoint);
  const claude = buildClaudePluginFiles(endpoint);
  const skill = buildSkillPackageFiles();

  const outputDir = join(repoRoot, "dist", "plugin");
  const archives = [
    { name: `${PLUGIN_NAME}.tar.gz`, data: packArchive(chatGpt) },
    { name: `${PLUGIN_NAME}.zip`, data: packZip(claude, PLUGIN_NAME) },
    { name: `${SKILL_NAME}.zip`, data: packZip(skill) },
  ];
  const trees = [
    { directory: join(outputDir, PLUGIN_NAME), files: chatGpt },
    { directory: join(outputDir, "claude", PLUGIN_NAME), files: claude },
    { directory: join(outputDir, "skill"), files: skill },
  ];

  for (const tree of trees) await writeTree(tree.directory, tree.files);
  await mkdir(outputDir, { recursive: true });
  for (const archive of archives) {
    await writeFile(join(outputDir, archive.name), archive.data);
  }

  console.log(`Magpie plugin ${PLUGIN_VERSION}`);
  console.log(`  MCP:      ${endpoint.href}`);
  console.log(
    `  archives: ${archives.map((archive) => relative(repoRoot, join(outputDir, archive.name))).join(", ")}`,
  );
  console.log(
    `  trees:    ${trees.map((tree) => `${relative(repoRoot, tree.directory)}/`).join(", ")}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
