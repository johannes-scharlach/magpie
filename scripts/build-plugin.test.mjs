import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { crc32, gunzipSync, inflateRawSync } from "node:zlib";
import {
  buildClaudePluginFiles,
  buildPluginFiles,
  buildSkillPackageFiles,
  packArchive,
  packZip,
  PLUGIN_VERSION,
  resolveMcpUrl,
  SKILL,
  SKILL_NAME,
  SKILL_PATH,
} from "./build-plugin.mjs";

function cstring(buffer, offset, length) {
  const end = buffer.indexOf(0, offset);
  return buffer.toString(
    "utf8",
    offset,
    end === -1 || end > offset + length ? offset + length : end,
  );
}

function octal(buffer, offset, length) {
  return Number.parseInt(cstring(buffer, offset, length), 8);
}

// Reads the ustar subset this packer writes, verifying every checksum.
function parseTar(tar) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = cstring(header, 0, 100);
    const size = octal(header, 124, 12);
    const checksum = octal(header, 148, 8);
    const copy = Buffer.from(header);
    copy.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of copy) sum += byte;
    assert.equal(checksum, sum, `checksum for ${name}`);

    entries.push({
      name,
      mode: octal(header, 100, 8),
      uid: octal(header, 108, 8),
      gid: octal(header, 116, 8),
      size,
      mtime: octal(header, 136, 12),
      type: String.fromCharCode(header[156]),
      content: tar.subarray(offset + 512, offset + 512 + size),
    });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return { entries, end: offset };
}

// Reads the zip subset this packer writes and checks local against central.
function parseZip(zip) {
  const endOffset = zip.length - 22;
  assert.equal(zip.readUInt32LE(endOffset), 0x06054b50);
  assert.equal(zip.readUInt16LE(endOffset + 4), 0);
  assert.equal(zip.readUInt16LE(endOffset + 6), 0);
  const count = zip.readUInt16LE(endOffset + 10);
  assert.equal(zip.readUInt16LE(endOffset + 8), count);
  assert.equal(zip.readUInt16LE(endOffset + 20), 0);
  const centralSize = zip.readUInt32LE(endOffset + 12);
  const centralOffset = zip.readUInt32LE(endOffset + 16);
  assert.equal(centralOffset + centralSize, endOffset);

  const entries = [];
  let offset = centralOffset;
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const entry = {
      versionMadeBy: zip.readUInt16LE(offset + 4),
      versionNeeded: zip.readUInt16LE(offset + 6),
      flags: zip.readUInt16LE(offset + 8),
      method: zip.readUInt16LE(offset + 10),
      time: zip.readUInt16LE(offset + 12),
      date: zip.readUInt16LE(offset + 14),
      crc: zip.readUInt32LE(offset + 16),
      compressedSize: zip.readUInt32LE(offset + 20),
      size: zip.readUInt32LE(offset + 24),
      nameLength: zip.readUInt16LE(offset + 28),
      extraLength: zip.readUInt16LE(offset + 30),
      commentLength: zip.readUInt16LE(offset + 32),
      disk: zip.readUInt16LE(offset + 34),
      internal: zip.readUInt16LE(offset + 36),
      external: zip.readUInt32LE(offset + 38),
      localOffset: zip.readUInt32LE(offset + 42),
    };
    entry.name = zip.toString(
      "utf8",
      offset + 46,
      offset + 46 + entry.nameLength,
    );
    entry.content = readLocalFile(zip, entry);
    entries.push(entry);
    offset += 46 + entry.nameLength + entry.extraLength + entry.commentLength;
  }
  assert.equal(offset, endOffset);
  return entries;
}

function readLocalFile(zip, entry) {
  const offset = entry.localOffset;
  assert.equal(zip.readUInt32LE(offset), 0x04034b50);
  assert.equal(zip.readUInt16LE(offset + 4), entry.versionNeeded);
  assert.equal(zip.readUInt16LE(offset + 6), entry.flags);
  assert.equal(zip.readUInt16LE(offset + 8), entry.method);
  assert.equal(zip.readUInt16LE(offset + 10), entry.time);
  assert.equal(zip.readUInt16LE(offset + 12), entry.date);
  assert.equal(zip.readUInt32LE(offset + 14), entry.crc);
  assert.equal(zip.readUInt32LE(offset + 18), entry.compressedSize);
  assert.equal(zip.readUInt32LE(offset + 22), entry.size);
  assert.equal(zip.readUInt16LE(offset + 26), entry.nameLength);
  assert.equal(zip.readUInt16LE(offset + 28), 0);

  const name = zip.toString(
    "utf8",
    offset + 30,
    offset + 30 + entry.nameLength,
  );
  assert.equal(name, entry.name);
  const start = offset + 30 + entry.nameLength;
  const content = inflateRawSync(
    zip.subarray(start, start + entry.compressedSize),
  );
  assert.equal(content.length, entry.size);
  assert.equal(crc32(content), entry.crc);
  return content;
}

function expectedZipMetadata(entry) {
  assert.equal(entry.versionMadeBy, 0x0314);
  assert.equal(entry.versionNeeded, 20);
  assert.equal(entry.flags, 0x0800);
  assert.equal(entry.flags & 0x08, 0, "no data descriptor");
  assert.equal(entry.method, 8);
  assert.equal(entry.time, 0);
  assert.equal(entry.date, 0x21);
  assert.equal(entry.extraLength, 0);
  assert.equal(entry.commentLength, 0);
  assert.equal(entry.disk, 0);
  assert.equal(entry.internal, 0);
  assert.equal(entry.external, 0x81a40000);
}

test("builds the ChatGPT package with the pointer skill", () => {
  const files = buildPluginFiles(new URL("https://magpiemeals.com"));
  assert.deepEqual(Object.keys(files).sort(), [
    "README.md",
    "mcp.json",
    "plugin.json",
    SKILL_PATH,
  ]);
  assert.equal(files[SKILL_PATH], SKILL);

  const plugin = JSON.parse(files["plugin.json"]);
  assert.equal(
    plugin.$schema,
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  );
  assert.equal(plugin.name, "magpie");
  assert.equal(plugin.version, PLUGIN_VERSION);
  assert.match(plugin.description, /^Plan meals .+\.$/);
  assert.ok(Array.isArray(plugin.keywords) && plugin.keywords.length > 0);

  const face = plugin.extensions["com.openai"].interface;
  assert.equal(face.displayName, "Magpie");
  assert.ok(face.shortDescription.length <= 30);
  assert.ok(face.longDescription.length > face.shortDescription.length);
  assert.equal(face.category, "Productivity");
  assert.deepEqual(face.capabilities, ["Read", "Write"]);
  assert.equal(face.defaultPrompt.length, 1);
  assert.ok(face.defaultPrompt[0].length <= 128);
  assert.match(face.defaultPrompt[0], /Don't save anything/);

  const mcp = JSON.parse(files["mcp.json"]);
  assert.equal(
    mcp.$schema,
    "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  );
  assert.deepEqual(mcp.mcpServers, {
    magpie: {
      type: "streamable-http",
      url: "https://magpiemeals.com/mcp",
      extensions: {
        "com.openai": {
          auth: {
            type: "oauth",
            client: { mode: "dcr" },
          },
        },
      },
    },
  });

  const readme = files["README.md"];
  assert.match(
    readme,
    /MAGPIE_PUBLIC_ORIGIN=https:\/\/magpiemeals\.com pnpm plugin/,
  );
  assert.match(readme, new RegExp(PLUGIN_VERSION));
  assert.ok(readme.includes(SKILL_PATH));
  assert.match(readme, /ChatGPT desktop app/);
  assert.match(readme, /Upload plugin archive/);
  assert.match(readme, /Re-upload/);
  assert.doesNotMatch(readme, /No `skills\/` directory/);
  assert.equal(readme.endsWith("\n\n"), false);
});

test("builds the Claude package with its own manifest and HTTP transport", () => {
  const files = buildClaudePluginFiles("https://magpiemeals.com");
  assert.deepEqual(Object.keys(files).sort(), [
    ".claude-plugin/plugin.json",
    ".mcp.json",
    "README.md",
    SKILL_PATH,
  ]);
  assert.equal(files[SKILL_PATH], SKILL);

  const plugin = JSON.parse(files[".claude-plugin/plugin.json"]);
  assert.deepEqual(plugin, {
    name: "magpie",
    displayName: "Magpie",
    version: PLUGIN_VERSION,
    description:
      "Plan meals around your household, your rules, and what you actually cook.",
    homepage: "https://magpiemeals.com",
    keywords: ["meal planning", "recipes", "cookbook", "meal plan", "dinner"],
  });

  assert.deepEqual(JSON.parse(files[".mcp.json"]), {
    mcpServers: {
      magpie: {
        type: "http",
        url: "https://magpiemeals.com/mcp",
      },
    },
  });

  const readme = files["README.md"];
  assert.match(readme, /Claude's "Customize" settings/);
  assert.match(readme, /Upload plugin/);
  assert.match(readme, /magpie\.zip/);
  assert.match(
    readme,
    /"Connectors" tab, add the connector, then click "Connect"/,
  );
  assert.match(readme, new RegExp(PLUGIN_VERSION));
  assert.match(readme, /Re-upload/);
  assert.doesNotMatch(readme, /ChatGPT/);
});

test("one skill string serves all three packages", () => {
  const chatGpt = buildPluginFiles("https://magpiemeals.com");
  const claude = buildClaudePluginFiles("https://magpiemeals.com");
  const skill = buildSkillPackageFiles();

  assert.equal(chatGpt[SKILL_PATH], SKILL);
  assert.equal(claude[SKILL_PATH], SKILL);
  assert.equal(skill["SKILL.md"], SKILL);
  assert.equal(chatGpt[SKILL_PATH], claude[SKILL_PATH]);
  assert.equal(claude[SKILL_PATH], skill["SKILL.md"]);

  const folder = SKILL_PATH.split("/")[1];
  assert.equal(folder, SKILL_NAME);
  assert.match(SKILL, /^---\nname: magpie-cooking\ndescription: .+\n---\n\n/);
  assert.match(SKILL, /what to cook, what is planned/);
  assert.match(SKILL, /saved to their household cookbook or meal plan/);
  assert.match(SKILL, /readHousehold/);
  assert.match(SKILL, /readPlan/);
  assert.match(SKILL, /addToCookbook/);
  assert.match(SKILL, /planMeal/);
  assert.match(SKILL, /swaps/);
  assert.match(SKILL, /shopping_hint/);
  assert.match(SKILL, /check_at_home/);
  assert.match(SKILL, /likely_purchase/);
  assert.doesNotMatch(SKILL, /<ideas>/);
  assert.doesNotMatch(SKILL, /<sketch/);
  assert.doesNotMatch(SKILL, /getMealSizing/);
});

test("resolves the URL from the flag, then the environment, then localhost", () => {
  assert.equal(
    resolveMcpUrl({
      mcpUrl: "https://flag.example/base",
      env: { MAGPIE_PUBLIC_ORIGIN: "https://env.example" },
      warn: () => {},
    }).href,
    "https://flag.example/mcp",
  );
  assert.equal(
    resolveMcpUrl({
      env: { MAGPIE_PUBLIC_ORIGIN: "https://env.example" },
      warn: () => {},
    }).href,
    "https://env.example/mcp",
  );

  const warnings = [];
  assert.equal(
    resolveMcpUrl({ env: {}, warn: (message) => warnings.push(message) }).href,
    "http://localhost:8787/mcp",
  );
  assert.ok(
    warnings.some((message) => /MAGPIE_PUBLIC_ORIGIN is not set/.test(message)),
  );
  assert.ok(warnings.some((message) => /localhost/.test(message)));
  assert.ok(warnings.some((message) => /plain HTTP/.test(message)));

  assert.throws(
    () => resolveMcpUrl({ mcpUrl: "ftp://example.com/mcp", warn: () => {} }),
    /must be http or https/,
  );
  assert.throws(
    () => resolveMcpUrl({ mcpUrl: "not a url", warn: () => {} }),
    /not a valid URL/,
  );
});

test("packs the ChatGPT ustar with the skill folder and pinned metadata", () => {
  const files = buildPluginFiles("https://magpiemeals.com");
  const archive = packArchive(files);
  assert.deepEqual([...archive.subarray(0, 3)], [0x1f, 0x8b, 0x08]);
  assert.deepEqual([...archive.subarray(4, 9)], [0, 0, 0, 0, 0]);
  assert.equal(archive[9], 255);
  assert.ok(archive.equals(packArchive(files)));

  const tar = gunzipSync(archive);
  assert.equal(tar.length % 10240, 0);
  const { entries, end } = parseTar(tar);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [
      "magpie/",
      "magpie/README.md",
      "magpie/mcp.json",
      "magpie/plugin.json",
      "magpie/skills/",
      "magpie/skills/magpie-cooking/",
      "magpie/skills/magpie-cooking/SKILL.md",
    ],
  );

  for (const entry of entries) {
    assert.equal(entry.uid, 0);
    assert.equal(entry.gid, 0);
    assert.equal(entry.mtime, 0);
    if (entry.type === "5") {
      assert.ok(entry.name.endsWith("/"));
      assert.equal(entry.mode, 0o755);
      assert.equal(entry.size, 0);
    } else {
      assert.equal(entry.type, "0");
      assert.equal(entry.mode, 0o644);
      assert.equal(
        entry.content.toString("utf8"),
        files[entry.name.slice("magpie/".length)],
      );
    }
  }

  // 1024 zero bytes end the archive before the 10240-byte record padding.
  assert.ok(tar.length - end >= 1024);
  assert.ok(tar.subarray(end).every((byte) => byte === 0));
});

test("packs the Claude zip with one root and pinned metadata", () => {
  const files = buildClaudePluginFiles("https://magpiemeals.com");
  const zip = packZip(files, "magpie");
  assert.ok(zip.equals(packZip(files, "magpie")));

  const entries = parseZip(zip);
  const names = entries.map((entry) => entry.name);
  assert.deepEqual(names, [
    "magpie/.claude-plugin/plugin.json",
    "magpie/.mcp.json",
    "magpie/README.md",
    "magpie/skills/magpie-cooking/SKILL.md",
  ]);
  assert.deepEqual(names, [...names].sort());
  assert.deepEqual(
    [...new Set(names.map((name) => name.split("/")[0]))],
    ["magpie"],
  );

  for (const entry of entries) {
    expectedZipMetadata(entry);
    assert.equal(
      entry.content.toString("utf8"),
      files[entry.name.slice("magpie/".length)],
    );
  }

  assert.equal(entries[0].localOffset, 0);
});

test("packs the skill zip with SKILL.md alone at the root", () => {
  const files = buildSkillPackageFiles();
  const zip = packZip(files);
  assert.ok(zip.equals(packZip(files)));

  const entries = parseZip(zip);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ["SKILL.md"],
  );
  assert.equal(entries[0].content.toString("utf8"), SKILL);
  expectedZipMetadata(entries[0]);
});

test("rebuilding each package is byte-identical", () => {
  const mcpUrl = "https://magpiemeals.com";
  assert.ok(
    packArchive(buildPluginFiles(mcpUrl)).equals(
      packArchive(buildPluginFiles(mcpUrl)),
    ),
  );
  assert.ok(
    packZip(buildClaudePluginFiles(mcpUrl), "magpie").equals(
      packZip(buildClaudePluginFiles(mcpUrl), "magpie"),
    ),
  );
  assert.ok(
    packZip(buildSkillPackageFiles()).equals(packZip(buildSkillPackageFiles())),
  );
});

test("rejects paths that are not relative and clean", () => {
  for (const pack of [
    (files) => packArchive(files),
    (files) => packZip(files, "magpie"),
    (files) => packZip(files),
  ]) {
    assert.throws(() => pack({ "../escape": "x" }), /relative and clean/);
    assert.throws(() => pack({ "/absolute": "x" }), /relative and clean/);
    assert.throws(() => pack({ "a//b": "x" }), /relative and clean/);
    assert.throws(() => pack({ "a/./b": "x" }), /relative and clean/);
  }
  assert.throws(() => packZip({ "a.txt": "x" }, ""), /one clean segment/);
  assert.throws(() => packZip({ "a.txt": "x" }, "a/b"), /one clean segment/);
});
