# Shipping an MCP server as a plugin

A self-contained playbook for turning one MCP server into installable packages for ChatGPT/Codex,
Claude, and skill-only assistants such as Gemini, plus the instructions users follow to add it.
Copy this file into the target repository and replace the placeholders. It covers packaging and
install UX only; server implementation, authentication, and widgets are out of scope.

The spine is **one skill, three wrappers**. The skill is the only copy of model-facing behavior.
Each package wraps that same `SKILL.md` in a host-specific manifest and points it at the public MCP
endpoint. Both plugin builders read the same skill string, so the packages cannot drift.

## Placeholders

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `<plugin>` | Kebab-case package name; also the MCP server key and component namespace | `dioramic` |
| `<Display>` | User-facing product name | `Dioramic` |
| `<skill>` | Kebab-case skill folder name | `dioramic-design` |
| `<version>` | Plugin package version, independent of the server version | `0.10.2` |
| `<origin>` | Public HTTPS origin that serves `/mcp` and `/install/` | `https://dioramic.example` |
| `<APP>` | Environment variable prefix | `DIORAMIC` |

Keep `<plugin>` identical in every manifest, every archive root, and the `mcpServers` key. Keep the
archive filenames stable and version-free (`<plugin>.tar.gz`, `<plugin>.zip`, `<skill>.zip`):
re-uploading then replaces the installed plugin instead of adding a second copy. The version lives
inside the manifests.

## What you ship

| Host | User installs | File | Archive root | Package contents |
| --- | --- | --- | --- | --- |
| ChatGPT / Codex | Plugin archive | `<plugin>.tar.gz` | `<plugin>/` | `plugin.json`, `mcp.json`, `README.md`, `skills/<skill>/SKILL.md` |
| Claude | Plugin | `<plugin>.zip` | `<plugin>/` | `.claude-plugin/plugin.json`, `.mcp.json`, `README.md`, `skills/<skill>/SKILL.md` |
| Gemini / skill-only clients | MCP URL and skill separately | `<skill>.zip` | archive root | `SKILL.md` |

Ship the hosts you support. The skill comes first because every package uses it; the host sections
after it are independent. For a ChatGPT-only launch, read sections 1, 2, 5, 6, 7, 8 (ChatGPT), 9,
and 10.

The plugin packages register the server over HTTP. stdio is a local-client connection with no
archive: the client launches the server binary directly. The install instructions below target
hosted assistants.

## 1. Write the skill once

Place the skill at `skills/<skill>/SKILL.md`:

```markdown
---
name: <skill>
description: >-
  <When to use the server, in the model's words: the tasks and artifacts the server produces.>
---

<Imperative instructions: the flow, the tools in order, what to present and when, and what to do
when the server rejects a call or cannot support the request.>
```

Rules that matter:

- `name` matches the folder and is kebab-case.
- The `description` does the triggering. It is the only text the model sees before deciding to load
  the skill, so name the user intents and artifacts, not the implementation.
- The body is a procedure, not code documentation: name the tools in call order, the presentation
  step, and the recovery path for errors and unsupported needs.
- Conventions the model must not guess, such as units, axes, and spatial semantics, belong here.
- Per-tool detail belongs in tool descriptions. The skill carries the cross-tool flow.

Define the skill once in code and have both package builders place it:

```ts
const SKILL = `...`.trim();
```

In the Dioramic source, `buildPluginFiles` (ChatGPT/Codex) and `buildClaudePluginFiles` (Claude)
both put this exact string at `skills/<skill>/SKILL.md`, and a test asserts the two are identical.

**Done when:** the frontmatter alone tells a model when to reach for the server, and the body names
every tool in the flow.

## 2. Build the ChatGPT/Codex package

Tree:

```text
<plugin>/
  plugin.json
  mcp.json
  README.md
  skills/<skill>/SKILL.md
```

`plugin.json` is an [Agent Plugins](https://agent-plugins.org) 1.0.0 manifest with the OpenAI
presentation block:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "<plugin>",
  "version": "<version>",
  "description": "<one sentence>",
  "keywords": ["<keyword>", "<keyword>"],
  "extensions": {
    "com.openai": {
      "interface": {
        "displayName": "<Display>",
        "shortDescription": "<short, store-card length>",
        "longDescription": "<long, full listing>",
        "category": "Creativity",
        "capabilities": ["Read", "Write"],
        "defaultPrompt": ["<example prompt the host seeds into the composer>"]
      }
    }
  }
}
```

- `displayName`, `shortDescription`, and `longDescription` are what the host shows in its plugin
  directory; write the long one around the user's workflow, not the implementation.
- `category` is a host category; Dioramic uses `Creativity`.
- `capabilities` is `["Read", "Write"]` for a design tool.
- `defaultPrompt` seeds the composer with a concrete, representative request.

`mcp.json` registers the remote server:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "<plugin>": {
      "type": "streamable-http",
      "url": "<origin>/mcp"
    }
  }
}
```

`README.md` is generated, never hand-edited. State the build command, the version, the file map,
the upload path, and the re-upload rule. For example:

```markdown
# <Display> plugin package

Generated by `<build command>` at version <version>.
Do not edit by hand — change the templates in `<source file>` and regenerate.

- `plugin.json` and `mcp.json` register the `<plugin>` MCP server (streamable HTTP).
- `skills/<skill>/SKILL.md` teaches the flow so the model picks <Display> unprompted.

Upload the packed archive to chatgpt.com → Plugins directory → Add → Upload plugin archive.
Re-upload after every change to tool descriptions, skill text, or the MCP URL; the host does not
re-read an installed archive on its own.
```

**Done when:** both JSON files parse, `url` is the public endpoint, and the tree matches the list.

## 3. Build the Claude package

Claude's layout follows [its plugin docs](https://claude.com/docs/plugins/build). Tree:

```text
<plugin>/
  .claude-plugin/plugin.json
  .mcp.json
  README.md
  skills/<skill>/SKILL.md
```

`.claude-plugin/plugin.json`:

```json
{
  "name": "<plugin>",
  "displayName": "<Display>",
  "version": "<version>",
  "description": "<one sentence>",
  "homepage": "<origin>",
  "keywords": ["<keyword>", "<keyword>"]
}
```

`.mcp.json`:

```json
{
  "mcpServers": {
    "<plugin>": {
      "type": "http",
      "url": "<origin>/mcp"
    }
  }
}
```

Differences that bite:

- The manifest lives under `.claude-plugin/`; the server file is `.mcp.json` at the package root.
- Claude's server type is `http`; ChatGPT's is `streamable-http`.
- The Claude manifest has no `$schema`.
- `homepage` is the public origin, not the `/mcp` URL.
- claude.ai lists the bundled server on the plugin's **Connectors** tab; the user must click
  **Connect**. Put that in the install steps, not in the package.

The README can be the long description.

**Done when:** the skill bytes equal the ChatGPT package's skill, both JSON files parse, and the
server URL is the public endpoint.

## 4. Build the skill-only package

For assistants that accept a skill but not a plugin, such as Gemini:

```text
SKILL.md
```

Zip the same skill with `SKILL.md` at the archive root and name the file `<skill>.zip`. The archive
root is the skill itself; do not add the plugin folder. The user adds the MCP URL as a connector
separately, then uploads this skill.

**Done when:** `unzip -l` shows `SKILL.md` at the root and its content equals the packaged skill.

## 5. Pack deterministically

Build a `Record<relative path, string>` first, then pack it. Validate that every path is relative
and clean: no empty, `.` or `..` segments. Prefix `<plugin>/` once, at pack time.

Serialize JSON with two-space indent and a trailing newline; give text exactly one trailing newline.
Sort entries by name before writing. Deterministic archives diff cleanly across releases, CI can
assert byte equality, and no timestamp or host OS leaks into the artifact.

### tar.gz for ChatGPT/Codex

- ustar, 512-byte headers and blocks.
- Explicit directory entries with a trailing slash and mode `0755`; files `0644`.
- uid/gid `0`, mtime `0`.
- End-of-archive: 1024 zero bytes, then pad the tar to a multiple of 10240.
- gzip level 9, then normalize the header: zero bytes 4–9 and set OS byte 9 to `255` (unknown).
- ASCII paths only, at most 100 bytes per name in this writer. Longer names need a pax or
  ustar-prefix writer, or shorter paths.

### zip for Claude and the skill-only package

- Sorted entries, deflate level 9, CRC32.
- Version 2.0; UTF-8 name flag `0x0800`.
- DOS timestamp fixed at 1980-01-01 00:00.
- Unix regular-file mode `0644` in the external attributes; "version made by" Unix (3).
- No extra fields, comments, or data descriptors.
- Claude zip: one `<plugin>/` root. Skill zip: `SKILL.md` at the root.

Node's built-ins are enough: `node:zlib` provides `crc32`, `deflateRawSync`, and `gzipSync`, so no
zip dependency is needed. The reference is `plugin-archive.ts`, about 350 lines of pure rendering
and packing with no network or filesystem access.

**Done when:** packing twice produces byte-identical archives, and system `tar`/`unzip` round-trip
every file byte for byte.

## 6. Generate with a CLI

One command writes the archives plus an unpacked tree for inspection:

```sh
pnpm plugin
# dist/plugin/<plugin>.tar.gz
# dist/plugin/<plugin>/
```

The CLI resolves the public MCP URL in this order:

1. `--mcp-url <url>`
2. `<APP>_PLUGIN_MCP_URL` environment variable
3. Tailscale auto-detection: `tailscale status --json` → `Self.DNSName` (strip trailing dots) →
   `https://<dns>/mcp`
4. `http://localhost:<port>/mcp`, with warnings

Use the flag or environment variable in CI. Auto-detection is a local convenience, and it cannot
verify that Funnel is active.

Warn at build time when:

- the URL is localhost, which hosted assistants cannot reach;
- the URL is plain `http`, which is acceptable only for explicit developer-mode entries; prefer
  HTTPS;
- the URL came from Tailscale, where the node is reachable only while `tailscale funnel <port>`
  runs.

`--no-tailscale-detect` skips detection. Validate that `mcpUrl` starts with `http://` or
`https://` before rendering anything.

The package version is separate from the server version. Bump it whenever any generated file
changes; the in-package README prints it so a support request can identify the build.

Generated archives are build output: commit the generator, not the archives.

**Done when:** the archive's `mcp.json` or `.mcp.json` contains the intended public URL and a
rebuild uses the same bytes.

## 7. Serve the downloads from your origin

Build the archives on the server for its own public origin, so a downloaded package always points
at the deployment that served it.

Route: `GET|HEAD /install/<archive>`

- `<plugin>.tar.gz` → ChatGPT/Codex archive, `application/gzip`
- `<plugin>.zip` → Claude archive, `application/zip`
- `<skill>.zip` → skill-only archive, `application/zip`
- Unknown name → 404; other methods → 405 with `Allow: GET, HEAD`; origin unset → 503.
- Build on first request and cache in-process, keyed by origin and name. Restart or redeploy after
  changing templates, skill text, or the MCP URL.
- Headers: `Content-Disposition: attachment; filename="<name>"`, `Cache-Control: no-cache`,
  `X-Content-Type-Options: nosniff`.

The origin comes from `<APP>_PUBLIC_ORIGIN`, defaulting to `http://localhost:<PORT>` outside
production and required in production. Build the MCP URL as `new URL("/mcp", origin)`. This setting
is separate from the CLI's plugin URL; set both to the same public origin in deployment.

Wire the route after any canonical-host redirect and before the 404. Redirect `www.` to the apex so
every connector and download uses one origin. This playbook assumes the MCP endpoint is `/mcp` at
the origin root; change that path in one place if yours differs.

**Done when:** each download returns 200 with the right content type, and the extracted manifest
points at the serving origin.

## 8. Publish the user instructions

Keep the install steps as data, one list per host, so copy and rendering stay in one place. A step
has text plus one optional action:

```ts
type Step = {
  text: string;
  action?:
    | { kind: "download"; href: string }
    | { kind: "open"; href: string; label: string }
    | { kind: "copy" };
};
```

In the i18n version, `text` and `label` are message descriptors rather than raw strings.

### ChatGPT

1. Download the <Display> plugin.
2. Open the ChatGPT app on your computer and go to “Plugins”.
3. Click “Add”, then “Upload a plugin archive”, and pick the file you downloaded.

Then start a new chat and describe your room.

Step 2 links to `https://chatgpt.com/download` with the label “Get the ChatGPT app”. The upload
works in the desktop app, not in the browser.

### Claude

1. Download the <Display> plugin.
2. Open “Plugins” in Claude’s “Customize” settings.
3. Click “Add”, then “Upload plugin”, and pick the file you downloaded.
4. On <Display>’s “Connectors” tab, click “Connect”.

Then start a new chat and describe your room.

Step 2 links to `https://claude.ai/customize/plugins` with the label “Open Claude”.

### Gemini

1. Copy <Display>’s address.
2. In Gemini, open “More”, then “Customize”, then “Connectors”.
3. Click “+ Custom”, paste the address, and save.
4. Download <Display>’s skill, which teaches Gemini to draw with it.
5. In “Customize”, open “Skills”, click “Create”, then “Upload skill”, and pick the file.

Then start a new chat and describe your room.

Step 2 links to `https://gemini.google.com/` with the label “Open Gemini”. The copy action writes
`${location.origin}/mcp`, not a hard-coded URL.

### Presentation

- Split button: primary “Add to ChatGPT”; a small arrow labelled “Other assistants” opens a menu
  with “Add to Claude” and “Add to Gemini”.
- Dialog title: “Add <Display> to {assistant}”.
- Download steps render a **Download** button; open steps render a link in a new tab; the copy step
  renders the address plus **Copy**, changing to **Copied** for two seconds.
- End every list with the same done line. Dioramic uses “Then start a new chat and describe your
  room.”; name your product's first task instead.
- Quoted strings are host UI labels. In translations, use the host's label in that language when
  known; otherwise keep the English label. Product names stay unchanged.

**Done when:** every download action resolves to a served archive, every open action points at the
right host page, and the copy action uses the page's own origin.

## 9. Update an installed plugin

Installed plugins are snapshots; hosts do not re-read the archive.

- Bump the package version on any change to the skill, tool descriptions, manifests, or MCP URL.
- Regenerate both plugin archives from the same skill source.
- Re-upload the ChatGPT archive in the Plugins directory (Add → Upload plugin archive). The stable
  filename replaces the old install.
- Re-upload the Claude plugin, then confirm the Connectors entry is connected.
- Update the Gemini connector URL if it changed, and re-upload the skill.
- The HTTP route rebuilds on the next process start; the CLI writes files for manual upload. Do
  both when both channels exist.

**Done when:** the version changed, both archives were rebuilt, and each host received the new
upload.

## 10. Verify

- [ ] `tar -tf` shows every expected path under `<plugin>/`.
- [ ] `unzip -l` shows one `<plugin>/` root for Claude, and `SKILL.md` alone for the skill package.
- [ ] Extracted files equal the inputs byte for byte.
- [ ] Packing twice gives identical bytes.
- [ ] The extracted `mcp.json` or `.mcp.json` contains `<origin>/mcp`, not localhost.
- [ ] `HEAD` on each `/install/...` returns 200.
- [ ] Unknown archive returns 404; POST returns 405; a missing origin returns 503.
- [ ] A non-http MCP URL is rejected at build time.
- [ ] The skill frontmatter `name` matches its folder, and both plugin packages carry identical
      skill bytes.
- [ ] The server's tool descriptions and the skill agree on names and order.

Useful commands:

```sh
tar -tf dist/plugin/<plugin>.tar.gz
unzip -l dist/plugin/<plugin>.zip
unzip -l dist/plugin/<skill>.zip
```

## Reference implementation

In the Dioramic repository this playbook comes from:

| File | Owns |
| --- | --- |
| `apps/mcp-server/src/plugin-archive.ts` | Skill template, package maps, manifests, filenames, version, zip and tar |
| `apps/mcp-server/src/build-plugin.ts` | CLI, URL resolution, warnings, output tree |
| `apps/mcp-server/src/install-http.ts` | `/install/<archive>` handler, per-origin cache, headers |
| `apps/mcp-server/src/landing/install.ts` | Install steps per host as data |
| `apps/mcp-server/src/landing/messages.ts` | User-facing copy and host labels |
| `apps/mcp-server/src/plugin-archive.test.ts` | Round-trip, determinism, skill identity, URL rejection |
| `apps/mcp-server/src/install-http.test.ts` | Download types, extracted URLs, 404 |
| `apps/mcp-server/src/landing-install.test.ts` | Every download href is served (HEAD 200) |

Copy `plugin-archive.ts`, `build-plugin.ts`, and `install-http.ts` into a Node/TypeScript target
and rename the constants. For another language, reimplement the formats from sections 2–5 and use
section 10 as the acceptance criteria.
