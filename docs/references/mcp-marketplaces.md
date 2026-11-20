# MCP marketplaces and directories

Where a remote MCP server can be listed, what each listing costs in review
effort, and whether a listing removes the re-upload pain Magpie hits today.

A public ChatGPT listing does fix the update pain, but only for the half of the
plugin that lives on the server. After the first approval, OpenAI scans
`https://magpiemeals.com/mcp` daily and pushes eligible tool changes live with no
ZIP and no publish action; bundled skills and listing metadata still need a new
package version and a new review. No channel lets a new skill reach an installed
personal ChatGPT plugin without a review.

| #   | Option                  | Review gate                                | Review per version                   | Reaches installed user unaided   | Cost to Magpie                                                 |
| --- | ----------------------- | ------------------------------------------ | ------------------------------------ | -------------------------------- | -------------------------------------------------------------- |
| 1   | OpenAI public directory | People plus scanners, per package version  | Hosted tools no; skills/metadata yes | Yes, for hosted tools            | Verification, 4 legal URLs, icon, 5+3 test cases, demo account |
| 2   | Anthropic MCP connector | Automated scan; Community by default       | No                                   | Yes (server is live)             | OAuth, annotations, icon, privacy URL                          |
| 3   | Anthropic plugin bundle | First listing reviewed; auto-publish after | Usually no                           | Yes (`version` drives detection) | Public repo, README ≥40 words, licence                         |
| 4   | Official MCP Registry   | None                                       | No                                   | No — aggregators only            | `server.json`, DNS or GitHub namespace                         |
| 5   | mcp.so                  | None on the paid path                      | No                                   | No — copy-paste configs          | $39                                                            |
| 6   | Cursor Marketplace      | Manual                                     | Not documented                       | Yes                              | Git repo, contact the Cursor team                              |
| 7   | Gemini CLI gallery      | None (crawler)                             | No                                   | Yes, CLI prompts                 | Public repo + topic                                            |
| 8   | VS Code / Copilot       | No self-serve path found                   | —                                    | —                                | —                                                              |

## 1. The OpenAI / ChatGPT directory

| Tier      | What it is                                                                                                                                                                                               | Update path                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Personal  | "Created by me" under **Personal** ([learn.chatgpt.com](https://learn.chatgpt.com/docs/plugins#universal-plugin-directory))                                                                              | None documented for remote archive uploads                                                           |
| Workspace | Admin console → Plugins; "stays within your workspace and organization boundary" ([developers.openai.com](https://developers.openai.com/plugins/build/plugins#publish-a-local-plugin-to-your-workspace)) | **Upload new version** ([help.openai.com](https://help.openai.com/articles/20001256)) or GitHub sync |
| Public    | "the universal plugin directory shared by ChatGPT and Codex" ([developers.openai.com](https://developers.openai.com/plugins/build/plugins))                                                              | Hosted tools automatically; package versions on approval                                             |

Magpie's archive lands in the personal tier: the desktop upload writes to
`~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`
([developers.openai.com](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work)),
and "A plugin named `magpie` already exists" appears in no first-party page I
read.

### Submission and requirements

- Upload the complete ZIP at [platform.openai.com/plugins](https://platform.openai.com/plugins)
  from an organisation where you have `api.apps.write` and a verified publishing
  identity — "Publishing under an unverified individual or business name will
  result in rejection". The MCP server must be in that first ZIP: "Adding an MCP
  server to an existing skills-only plugin is not currently supported"
  ([submission](https://developers.openai.com/plugins/deploy/submission#create-the-draft),
  [app-review](https://developers.openai.com/plugins/deploy/app-review#organization-verification)).
- "Only one MCP server can be connected per plugin", template URLs are reserved
  for "trusted developers", and OAuth works via `provided`, `dcr` or `cimd` —
  there is no API-key flow ([submission](https://developers.openai.com/plugins/deploy/submission#authentication-limitations)).
  Magpie's DCR setup is the supported case; the portal token goes at
  `https://<host>/.well-known/openai-apps-challenge`
  ([domain verification](https://developers.openai.com/plugins/deploy/submission#domain-verification-details)).
- The MCP origin cannot change: scheme, host or port means "create a new plugin"
  and repeat review, though a path change can ride a new version. Packages with
  `apps` / `.app.json` references or lifecycle hooks cannot be submitted
  ([app-review](https://developers.openai.com/plugins/deploy/app-review#other-changes)).
- MCP review requires `websiteURL`, `supportURL`, `privacyPolicyURL`,
  `termsOfServiceURL` and a square icon at least 48×48. Plugins "may conduct
  commerce only for physical goods"; selling subscriptions is banned, but users
  "may sign in to an existing paid account"
  ([listing](https://developers.openai.com/plugins/deploy/submission#listing-metadata),
  [commerce](https://developers.openai.com/plugins/plugin-guidelines#5-1-commerce-and-monetization)).
- All three hints should be explicit booleans, and mismatches are a named
  rejection reason ([guidelines](https://developers.openai.com/plugins/plugin-guidelines#6-3-correct-annotation)).
  `apps/api/src/mcp-tools.ts` sets `readOnlyHint` on reads and `destructiveHint`
  only on `unplanMeal`; `openWorldHint` is never set.

### Review

A plugin with an MCP server is reviewed by people as well as scanners: the review
team needs a dedicated account that works "without MFA approval, email or SMS
codes, magic links, or private-network access", five positive and three negative
test cases, a video walkthrough and release notes — importable from
`extensions.com.openai.review` and `publication` in `plugin.json`
([submission](https://developers.openai.com/plugins/deploy/submission#complete-review-information)).
Timing is unstated: "Review timelines may vary … Please do not contact support to
request expedited review"; for updates, "we are unable to offer estimated times"
([FAQ](https://developers.openai.com/plugins/deploy/app-review#review-and-approval-faqs)).

### Updates

"After initial publication, changes to your MCP server are picked up
automatically … changes to plugin metadata or skills still require a new ZIP"
([submission](https://developers.openai.com/plugins/deploy/submission#update-your-published-plugin)).
Hosted tools are scanned daily or on **Rescan**: additions and edits appear after
automated checks, deletions apply immediately, and a held change keeps the old
definition live. Listing text, assets and skills need a new ZIP, version and
review, and publishing that version replaces the previous one. A URL change needs
support and an origin change needs a new plugin
([app-review](https://developers.openai.com/plugins/deploy/app-review#continuous-review-and-tool-updates)).

## 2. Lower-barrier alternatives

**Official MCP Registry.** Metadata only, no artifacts, in preview
([about](https://modelcontextprotocol.io/registry/about)). A remote-only server
needs one `server.json` with a `remotes` entry, then `mcp-publisher login` and
`publish` — no form, no reviewer
([quickstart](https://modelcontextprotocol.io/registry/quickstart#remote-only-servers)).
Namespace proof is the gate: GitHub auth forces `io.github.<user>/*`, while DNS
auth needs a public key as a TXT record **on the apex**, not a selector
([authentication](https://modelcontextprotocol.io/registry/authentication#dns-authentication));
Magpie owns `magpiemeals.com`, so `com.magpiemeals/magpie` is available once the
TXT record exists. The
registry "does not verify that you control the remote URL"
([remote servers](https://modelcontextprotocol.io/registry/remote-servers#ownership-verification)),
and OAuth is not excluded — the schema has no auth field, so clients discover it
from the `401` challenge. Versions are immutable, so an update is a new version
([versioning](https://modelcontextprotocol.io/registry/versioning),
[FAQ](https://modelcontextprotocol.io/registry/faq)). Clients do not read it:
"not intended to be directly consumed by host applications", and aggregators pull
"for example, once per hour" ([about](https://modelcontextprotocol.io/registry/about)).

**Anthropic.** Anyone on a paid Claude plan submits from
[claude.ai/directory/manage](https://claude.ai/directory/manage)
([publish](https://claude.com/docs/directory/publish)), and the server and the
skills are separate submissions. **MCP connector:** one remote HTTPS server, OAuth
2.0 for authenticated services, a `title` plus `readOnlyHint`/`destructiveHint` on
every tool, and a privacy policy URL
([checklist](https://claude.com/docs/connectors/building/submission#pre-submission-checklist-for-connectors)).
"Anthropic scans your submission automatically for policy compliance and, by
default, lists it as a Community connector with no action from you"; a person
reviews only when Anthropic escalates to Verified, and tool changes then ship on
deploy — "You don't resubmit to Anthropic to change a listed MCP server's tools"
([submission](https://claude.com/docs/connectors/building/submission#after-you-submit),
[after publishing](https://claude.com/docs/connectors/building/after-publishing#mcp-server-changes)).

**Plugin bundle:** a public GitHub repo with a tracked branch or tag; every version
gets automated validation and a security scan, and "a person reviews a new listing
before it goes live" ([publish](https://claude.com/docs/directory/publish#prepare-for-review)).
Pushes then produce versions automatically, but which go live depends on the
**Auto-publish** setting Anthropic applies — the default is a reviewer publishes
each, and "The reviewer publishes only the first version" is possible. Magpie's
`.claude-plugin/plugin.json` already exists in the packaging script; the gaps are a
public repo, a README of at least 40 words, and a `license` or `LICENSE`
([submit](https://claude.com/docs/plugins/submit#publish-a-passing-version),
[build](https://claude.com/docs/plugins/build)).

**Google.** Gemini CLI extensions are crawled, not submitted:
public repo, `gemini-cli-extension` topic, `gemini-extension.json` at the archive
root; "You don't need to submit an issue or email us", "Our system crawls tagged
repositories daily", and updates follow the git ref with a CLI prompt
([releasing](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/releasing.md)).
Gemini app connectors are a per-user custom URL, as
[`plugin-packaging.md`](../plugin-packaging.md) documents; I found no first-party
self-serve submission path for a Gemini app directory [UNVERIFIED].

**Cursor and VS Code.** Cursor takes submissions "through the Cursor team" and
"Every plugin is manually reviewed before it's listed"; no self-serve portal is
documented, community servers go to `cursor.directory`, and it loads Agent Plugins
packages directly ([plugins](https://cursor.com/docs/plugins#the-marketplace),
[MCP](https://cursor.com/docs/mcp)). VS Code has no MCP submission form: discovery
runs through the Customization Marketplace (Preview) with its "Experimental"
**GitHub Feed**, through plugin marketplaces, or by pasting a URL
([MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers)).
Its linked GitHub MCP Registry is "a curated list of MCP servers from partners and
the community" in public preview, with no publishing instructions
([docs.github.com](https://docs.github.com/en/copilot/concepts/customizations/mcp#about-the-github-mcp-registry)).

**Third-party registries.** mcp.so: "A paid listing is a one-time $39 fee: it is
published immediately without review and gets a verified badge"; it accepts a
hosted remote URL and generates copy-paste configs, pushing nothing to a client
([mcp.so/submit](https://mcp.so/submit)). Smithery is now part of Arcade and its
MCP proxy shut down on 31 October ([smithery.ai](https://smithery.ai)) — no longer
a target. Glama indexes 123,470 servers and exposes a directory API; how a single
server is added is undocumented [UNVERIFIED] and reads as crawler-fed
([glama.ai](https://glama.ai/mcp/servers)). PulseMCP returned HTTP 403 here
[UNVERIFIED].

## 3. Does a listing make updates smoother?

For the server half, yes. For the packaged half, no.

| Host                     | Publish and clients see it                       | Resubmit and wait                  | Reinstall                                             |
| ------------------------ | ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------- |
| ChatGPT public           | Hosted tools, instructions, live results         | Listing text, skills, assets, auth | Not documented for approved package updates           |
| ChatGPT personal archive | Nothing                                          | Nothing                            | Yes — remove, re-upload, sign in again                |
| Claude connector         | Tool changes on deploy                           | Tool _names_ on the listing        | No                                                    |
| Claude plugin bundle     | Commits to the tracked branch, with auto-publish | First listing; any held version    | No; `version` tells installed copies an update exists |
| MCP Registry             | New version is immediate                         | Never                              | No — but no client is watching                        |
| Gemini CLI               | New tag or release; CLI prompts                  | Never                              | No                                                    |
| mcp.so / Glama           | Edit the listing if the URL changes              | Never                              | No — user config already points at the URL            |

Every channel that skips review also skips the client. Of the hosts that keep
talking to the live server, OpenAI, Anthropic and Cursor all let a server change
land without a fresh human decision; the first two are the ones that reach a
cooking audience. Anthropic's connector is the cheaper of those because its default
path is automated.

### Re-authentication after an update

No first-party page states what happens to an existing OAuth connection when a
_package_ version is replaced. Two statements bear on it: tool calls "continue to
use your live MCP server", and server changes "take effect before a scan can
discover or approve them"
([app-review](https://developers.openai.com/plugins/deploy/app-review#continuous-review-and-tool-updates)).
Together with the persistence above, a hosted tool update should not disturb the
connection, because the connection is not part of the bundle. Whether replacing a
published _package_ version preserves it is not stated: [UNVERIFIED]. This also
corrects `docs/plugin-packaging.md` §9: the help centre says uninstalling leaves
separately connected integrations intact
([help.openai.com](https://help.openai.com/articles/20001256)).

## 4. Recommendation

1. **Submit the existing ZIP to the OpenAI public directory.** It is the only
   option that both reaches the surface Magpie already runs on and removes the
   re-upload loop for what changes most (tools and instructions): one approval,
   then daily scans. Cost: verification, four legal URLs, an icon, a demo account,
   5+3 test cases and a video; no fee is documented.
2. **Submit the same server as an Anthropic MCP connector.** Automated scan,
   Community listing, no human review by default, tool changes on deploy. OAuth
   and annotations are already done; add an icon, and bundle the skill later if it
   matters — the first bundle listing does get a person.
3. **Publish to the official MCP Registry.** An hour with DNS auth, no review, and
   visibility to every aggregator that polls it. Fixes discovery, not updates.
4. **mcp.so** only if a backlink is worth $39; **Cursor** if developers become an
   audience. **Gemini CLI** and **VS Code** are not worth it here.

**Does any option remove the human review cycle?** For hosted MCP changes, yes:
OpenAI's continuous review and Anthropic's Community connector both ship tool
updates without a reviewer. For bundled skills, tool descriptions carried in
`plugin.json`, or listing copy, only Anthropic's plugin bundle can skip it — and
only once Anthropic has applied the auto-publish setting. Everywhere else a
package change either gets re-reviewed or does not reach the client at all.

**Next step.** Add `GET /.well-known/openai-apps-challenge` to `apps/api`,
returning the portal token as `text/plain` on the `magpiemeals.com` origin — the
same shape as the discovery endpoints in `apps/api/src/routes/oauth.ts` — then
open a draft at platform.openai.com/plugins and let its scanner report the rest.
Settle the legal URLs first: this repo has no privacy, terms, support or website
page (`apps/api/src/routes/` has no such route), and all four are required. Also
set `openWorldHint` and the missing `destructiveHint` on the write tools in
`apps/api/src/mcp-tools.ts`, since hint mismatches are an explicit rejection reason.

## Sources

All accessed 2026-11-18.

| URL                                                                                | What it establishes                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| https://developers.openai.com/plugins/build/plugins                                | Package layout, local marketplace cache paths, workspace publishing, universal directory       |
| https://developers.openai.com/plugins/deploy/submission                            | Upload path, verification, domain challenge, auth methods, review materials, updates, appeals  |
| https://developers.openai.com/plugins/deploy/app-review                            | Verification enforcement, template URLs, one review at a time, continuous review, origin rules |
| https://developers.openai.com/plugins/plugin-guidelines                            | Annotation requirements, commerce limits, verification, listing rules                          |
| https://help.openai.com/articles/20001256                                          | Personal/workspace/public tiers, **Upload new version**, connections surviving uninstall       |
| https://learn.chatgpt.com/docs/plugins                                             | Directory tabs, "Created by me", install and uninstall behaviour                               |
| https://modelcontextprotocol.io/registry/about                                     | Registry scope, no private servers, aggregator-only consumption, namespace trust               |
| https://modelcontextprotocol.io/registry/quickstart                                | Remote-only `server.json`, publisher CLI flow                                                  |
| https://modelcontextprotocol.io/registry/authentication                            | GitHub vs DNS namespace proof, apex TXT requirement                                            |
| https://modelcontextprotocol.io/registry/remote-servers                            | `remotes` schema, URL not verified against publisher                                           |
| https://modelcontextprotocol.io/registry/versioning                                | Immutable, unique version strings; updates are new versions; deletion                          |
| https://claude.com/docs/directory/publish                                          | Who can submit, bundle vs connector, per-version checks, updates without resubmitting          |
| https://claude.com/docs/plugins/submit                                             | GitHub source, tracked branch, auto-publish, update flow, README and licence rules             |
| https://claude.com/docs/connectors/building/submission                             | Connector checklist, automated scan → Community, no resubmission for tool changes              |
| https://code.visualstudio.com/docs/agent-customization/mcp-servers                 | VS Code discovery paths; no MCP submission form                                                |
| https://docs.github.com/en/copilot/concepts/customizations/mcp                     | GitHub MCP Registry is a curated preview list                                                  |
| https://cursor.com/docs/plugins                                                    | Git submissions through the Cursor team, manual review, community servers via cursor.directory |
| https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/releasing.md | Gallery auto-indexing, daily crawl, git/release update detection                               |
| https://mcp.so/submit                                                              | $39 paid listing, immediate publication without review                                         |
| https://smithery.ai                                                                | Part of Arcade; proxy shut down 31 October                                                     |
| https://glama.ai/mcp/servers                                                       | Index size and shape; no submission documentation found                                        |
