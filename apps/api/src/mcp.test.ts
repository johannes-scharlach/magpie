import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";

import { importJWK, SignJWT } from "jose";
import { Client } from "pg";
import { z } from "zod";

/**
 * A local JWKS stub is the auth seam: `auth.ts` builds its key set URL at
 * import, so the public half of the repo's Supabase signing key is served
 * before the app is imported, and every request below carries a token the
 * app really verifies.
 */
type SigningKey = Parameters<typeof importJWK>[0] & { kid: string };

const signingKeys = JSON.parse(
  await readFile(
    new URL("../../../supabase/signing_keys.json", import.meta.url),
    "utf8",
  ),
) as SigningKey[];
const signingKey = signingKeys[0]!;

function publicKeyOf(key: SigningKey) {
  return {
    kty: key.kty,
    kid: key.kid,
    use: key.use,
    alg: key.alg,
    crv: key.crv,
    x: key.x,
    y: key.y,
  };
}

const jwks = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  // WebCrypto rejects a key whose key_ops names both sign and verify.
  res.end(JSON.stringify({ keys: signingKeys.map(publicKeyOf) }));
});
await new Promise<void>((resolve) => jwks.listen(0, "127.0.0.1", resolve));
const jwksAddress = jwks.address() as AddressInfo;
process.env.SUPABASE_URL = `http://127.0.0.1:${jwksAddress.port}`;
process.env.GOOGLE_GENERATIVE_AI_API_KEY ??= "unused";
process.env.SUPABASE_PUBLISHABLE_KEY ??= "test-publishable";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.DATABASE_URL ??= "postgres://unused:unused@localhost/unused";

after(() => new Promise<void>((resolve) => jwks.close(() => resolve())));

const userId = "a1200000-0000-4000-8000-000000000001";
const listId = "b1200000-0000-4000-8000-000000000001";
const personId = "c1200000-0000-4000-8000-000000000001";
const today = new Date().toISOString().slice(0, 10);
const MODERN = "2026-07-28";
const LEGACY = "2025-06-18";

const privateKey = await importJWK(
  { ...publicKeyOf(signingKey), d: signingKey.d },
  "ES256",
);
const token = await new SignJWT({ email: "tester@example.com" })
  .setProtectedHeader({ alg: "ES256", kid: signingKey.kid })
  .setSubject(userId)
  .setAudience("authenticated")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(privateKey);

async function databaseReachable(): Promise<boolean> {
  if (!databaseUrl) return false;
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return false;
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return false;
  const probe = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500,
  });
  try {
    await probe.connect();
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

const databaseUp = await databaseReachable();

type Rpc = {
  status: number;
  contentType: string;
  headers: Headers;
  message: {
    result?: Record<string, unknown>;
    error?: { code: number | string; message: string };
  };
};

async function rpc(
  body: unknown,
  headers: Record<string, string> = {},
  bearer: string | null = token,
): Promise<Rpc> {
  const { app } = await import("./app.js");
  const res = await app.request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const message = contentType.includes("text/event-stream")
    ? JSON.parse(
        text
          .split(/\n\n/)
          .flatMap((event) =>
            event
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice("data:".length).trim()),
          )
          .filter(Boolean)
          .at(-1) ?? "{}",
      )
    : JSON.parse(text);
  return { status: res.status, contentType, headers: res.headers, message };
}

function modern(method: string, params: Record<string, unknown> = {}) {
  return {
    body: {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MODERN,
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "magpie-test",
            version: "1.0.0",
          },
        },
      },
    },
    headers: {
      "mcp-protocol-version": MODERN,
      "mcp-method": method,
    },
  };
}

function toolResult(rpcResponse: Rpc): unknown {
  assert.equal(rpcResponse.status, 200);
  const content = rpcResponse.message.result?.content as
    { type: string; text: string }[] | undefined;
  assert.ok(content?.[0]?.text, JSON.stringify(rpcResponse.message));
  return JSON.parse(content[0].text);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const call = modern("tools/call", { name, arguments: args });
  return toolResult(
    await rpc(call.body, { ...call.headers, "mcp-name": name }),
  );
}

test("an MCP request without a user token is rejected", async () => {
  const unsigned = await rpc(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    {},
    null,
  );
  assert.equal(unsigned.status, 401);
  assert.deepEqual(unsigned.message, {
    error: { code: "UNAUTHORIZED", message: "Unauthorized" },
  });
  assert.match(
    unsigned.headers.get("www-authenticate") ?? "",
    /^Bearer resource_metadata=".*\/\.well-known\/oauth-protected-resource"$/,
  );
});

test("MCP refuses a foreign browser origin but lets a chat host through", async () => {
  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {},
  };
  const foreign = await rpc(
    initialize,
    { origin: "https://evil.example" },
    null,
  );
  assert.equal(foreign.status, 403);
  assert.equal(foreign.message.error?.code, "FORBIDDEN_ORIGIN");

  const allowed = await rpc(
    initialize,
    { origin: "https://chatgpt.com" },
    null,
  );
  assert.equal(allowed.status, 401);
});

test("OAuth discovery and the consent page are served at the origin root", async () => {
  const { app } = await import("./app.js");
  const metadata = await app.request("/.well-known/oauth-protected-resource");
  assert.equal(metadata.status, 200);
  const body = (await metadata.json()) as {
    resource: string;
    authorization_servers: string[];
    bearer_methods_supported: string[];
  };
  assert.match(body.resource, /\/mcp$/);
  assert.equal(body.authorization_servers.length, 1);
  assert.match(body.authorization_servers[0]!, /\/auth\/v1$/);
  assert.deepEqual(body.bearer_methods_supported, ["header"]);

  const consent = await app.request("/oauth/consent");
  assert.equal(consent.status, 200);
  const csp = consent.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'nonce-/);
  assert.match(csp, /connect-src 'self' /);
  assert.match(consent.headers.get("cache-control") ?? "", /no-store/);
  const html = await consent.text();
  assert.match(html, /authorization_id/);
  assert.match(html, /SUPABASE_URL \+ "\/auth\/v1" \+ path/);
  assert.match(html, /"\/otp"/);
  assert.match(html, /"\/verify"/);
  assert.match(html, /"\/oauth\/households"/);
  assert.match(html, /"\/oauth\/household"/);
  assert.match(html, /id="household"/);
});

test("MCP refuses a user in no household or several households with distinct codes", async (t) => {
  const { pool } = await import("./db.js");
  let members: { list_id: string }[] = [];
  t.mock.method(pool, "query", (async (text: string) => {
    if (text.includes("FROM mcp_households")) return { rows: [], rowCount: 0 };
    return { rows: members, rowCount: members.length };
  }) as unknown as typeof pool.query);

  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LEGACY,
      capabilities: {},
      clientInfo: { name: "magpie-test", version: "1.0.0" },
    },
  };
  const none = await rpc(initialize);
  assert.equal(none.status, 403);
  assert.equal(none.message.error?.code, "NO_HOUSEHOLD");

  members = [{ list_id: listId }, { list_id: personId }];
  const several = await rpc(initialize);
  assert.equal(several.status, 409);
  assert.equal(several.message.error?.code, "CHOOSE_HOUSEHOLD");
  assert.match(several.message.error?.message ?? "", /reconnect/i);
});

test("MCP uses the stored household choice before membership", async (t) => {
  const { pool } = await import("./db.js");
  const { resolveListId } = await import("./routes/mcp.js");
  const stored = "b1200000-0000-4000-8000-000000000002";
  t.mock.method(pool, "query", (async (text: string) => {
    if (text.includes("FROM mcp_households"))
      return { rows: [{ list_id: stored }], rowCount: 1 };
    throw new Error(`Unexpected query: ${text}`);
  }) as unknown as typeof pool.query);

  assert.equal(await resolveListId(userId), stored);
});

test("MCP accepts a sole household without a stored choice", async (t) => {
  const { pool } = await import("./db.js");
  const { resolveListId } = await import("./routes/mcp.js");
  t.mock.method(pool, "query", (async (text: string) => {
    if (text.includes("FROM mcp_households")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM list_members"))
      return { rows: [{ list_id: listId }], rowCount: 1 };
    throw new Error(`Unexpected query: ${text}`);
  }) as unknown as typeof pool.query);

  assert.equal(await resolveListId(userId), listId);
});

test("choosing a household the user does not belong to is refused", async (t) => {
  const { pool } = await import("./db.js");
  t.mock.method(pool, "query", (async (text: string) => {
    if (text.includes("FROM list_members")) return { rows: [], rowCount: 0 };
    throw new Error(`Unexpected query: ${text}`);
  }) as unknown as typeof pool.query);

  const { app } = await import("./app.js");
  const response = await app.request("/oauth/household", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ listId: personId }),
  });
  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "HOUSEHOLD_ACCESS_DENIED");
});

test("the households route lists choices and the stored selection", async (t) => {
  const { pool } = await import("./db.js");
  t.mock.method(pool, "query", (async () => ({
    rows: [{ id: listId, name: "Home", selected: true }],
    rowCount: 1,
  })) as unknown as typeof pool.query);

  const { app } = await import("./app.js");
  const response = await app.request("/oauth/households", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    households: [{ id: listId, name: "Home" }],
    selected: listId,
  });

  const anonymous = await app.request("/oauth/households");
  assert.equal(anonymous.status, 401);
});

test("choosing a household stores it for the signed-in user", async (t) => {
  const { pool } = await import("./db.js");
  let upserted: unknown[] | undefined;
  t.mock.method(pool, "query", (async (text: string, values?: unknown[]) => {
    if (text.includes("INSERT INTO mcp_households")) {
      upserted = values;
      return { rows: [], rowCount: 0 };
    }
    return { rows: [{}], rowCount: 1 };
  }) as unknown as typeof pool.query);

  const { app } = await import("./app.js");
  const response = await app.request("/oauth/household", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ listId }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { listId });
  assert.deepEqual(upserted, [userId, listId]);
});

test("the MCP tool list is built from the chat tools with read and destructive hints", async () => {
  const { buildMcpTools } = await import("./mcp-tools.js");
  const tools = buildMcpTools(userId, listId, today);
  const readOnly = new Set([
    "getMealSizing",
    "searchVariants",
    "readVariant",
    "readPlannedMeal",
    "readPlan",
    "searchSavedRecipes",
    "readCookbookOverview",
  ]);

  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    "addToCookbook",
    "getMealSizing",
    "planMeal",
    "readCookbookOverview",
    "readPlan",
    "readPlannedMeal",
    "readVariant",
    "searchSavedRecipes",
    "searchVariants",
    "unplanMeal",
  ]);
  for (const tool of tools) {
    assert.ok(tool.description.trim(), tool.name);
    const schema = z.toJSONSchema(tool.inputSchema, { io: "input" });
    assert.equal(schema.type, "object", tool.name);
    assert.equal(
      tool.annotations?.readOnlyHint === true,
      readOnly.has(tool.name),
      tool.name,
    );
    assert.equal(
      tool.annotations?.destructiveHint === true,
      tool.name === "unplanMeal",
      tool.name,
    );
  }
  const readPlan = z.toJSONSchema(
    tools.find((tool) => tool.name === "readPlan")!.inputSchema,
    { io: "input" },
  );
  assert.deepEqual(readPlan.required, ["fromDate"]);
});

test("MCP answers a 2025 initialize and a 2026 server/discover with the same instructions", async (t) => {
  const { pool } = await import("./db.js");
  // The three reads the route makes before it can answer: household choice,
  // profile and people. The write loop below uses temp tables instead.
  const profileRow = {
    id: listId,
    goals: {},
    kitchen_equipment: {},
    measurements: {},
    pantry: {},
    fresh_ingredients: {},
    restrictions: "",
    ingredient_avoidances: [],
    meals_at_home: "Dinner",
    meal_ideas_brief: "Quick suppers, mostly vegetable-led.",
    main_supermarket: "",
    other_shops: "",
    shops: [],
    keeps: [],
    cuisines: [],
    extras: {},
    day_habits: [],
    new_dishes: null,
  };
  const personRow = {
    id: personId,
    user_id: userId,
    name: "Sam",
    age_group: "Adult",
    diet: "omnivore",
    diet_other: "",
    meal_times: "All meals",
    portion_reference: 1,
  };
  t.mock.method(pool, "query", (async (text: string) => {
    if (text.includes("FROM mcp_households")) return { rows: [], rowCount: 0 };
    if (text.includes("FROM list_members"))
      return { rows: [{ list_id: listId }], rowCount: 1 };
    if (text.includes("FROM household_profiles"))
      return { rows: [profileRow], rowCount: 1 };
    if (text.includes("FROM household_people"))
      return { rows: [personRow], rowCount: 1 };
    if (text.includes("FROM planned_meals")) return { rows: [], rowCount: 0 };
    throw new Error(`Unexpected query: ${text}`);
  }) as unknown as typeof pool.query);

  const initialized = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LEGACY,
      capabilities: {},
      clientInfo: { name: "magpie-test", version: "1.0.0" },
    },
  });
  assert.equal(initialized.status, 200);
  assert.match(initialized.contentType, /text\/event-stream/);
  const instructions = initialized.message.result?.instructions as string;
  assert.ok(instructions);
  assert.match(instructions, /Quick suppers/);
  assert.match(instructions, /"name":"Sam"/);
  assert.match(instructions, /## The plan/);
  assert.match(instructions, /<ideas>/);
  assert.match(instructions, /ordinary Markdown/);
  assert.match(instructions, /`updateRecipe`/);
  assert.match(instructions, /`addMealShoppingItems`/);
  assert.match(instructions, /`addToCookbook`/);
  assert.match(instructions, /added in Magpie/);

  const discovered = await rpc(
    modern("server/discover").body,
    modern("server/discover").headers,
  );
  assert.equal(discovered.status, 200);
  assert.match(discovered.contentType, /application\/json/);
  assert.equal(discovered.message.result?.instructions, instructions);

  const listed = await rpc(
    modern("tools/list").body,
    modern("tools/list").headers,
  );
  assert.equal(listed.status, 200);
  const tools = listed.message.result?.tools as
    | {
        name: string;
        description?: string;
        annotations?: { destructiveHint?: boolean };
      }[]
    | undefined;
  assert.equal(tools?.length, 10);
  assert.ok(tools?.every((tool) => tool.description));
  assert.equal(
    tools?.find((tool) => tool.name === "unplanMeal")?.annotations
      ?.destructiveHint,
    true,
  );

  const unknown = await rpc(
    modern("tools/call", { name: "noSuchTool", arguments: {} }).body,
    {
      "mcp-protocol-version": MODERN,
      "mcp-method": "tools/call",
      "mcp-name": "noSuchTool",
    },
  );
  assert.equal(unknown.status, 200, JSON.stringify(unknown.message));
  assert.match(unknown.message.error?.message ?? "", /not found/i);
  assert.equal(unknown.message.result, undefined);

  const plan = await callTool("readPlan", { fromDate: today, days: 1 });
  assert.deepEqual(plan, []);
});

test(
  "MCP runs the write loop against a household",
  { skip: !databaseUp },
  async (t) => {
    const { pool } = await import("./db.js");
    const client = new Client({ connectionString: databaseUrl! });
    await client.connect();
    try {
      // Connection-private copies: the dev household's rows are untouched.
      await client.query(`
        CREATE TEMP TABLE list_members (list_id uuid, user_id uuid, joined_at timestamptz DEFAULT now());
        CREATE TEMP TABLE household_profiles (
          id uuid PRIMARY KEY,
          goals jsonb DEFAULT '{}',
          kitchen_equipment jsonb DEFAULT '{}',
          pantry jsonb DEFAULT '{}',
          fresh_ingredients jsonb DEFAULT '{}',
          restrictions text DEFAULT '',
          ingredient_avoidances jsonb DEFAULT '[]',
          meals_at_home text DEFAULT 'Dinner',
          meal_ideas_brief text DEFAULT '',
          main_supermarket text DEFAULT '',
          other_shops text DEFAULT '',
          shops jsonb DEFAULT '[]',
          keeps jsonb DEFAULT '[]',
          cuisines jsonb DEFAULT '[]',
          extras jsonb DEFAULT '{}',
          day_habits jsonb DEFAULT '[]',
          new_dishes text,
          measurements jsonb DEFAULT '{}'
        );
        CREATE TEMP TABLE household_people (
          id uuid PRIMARY KEY, list_id uuid, user_id uuid, name text,
          age_group text DEFAULT 'Adult', diet text DEFAULT 'omnivore',
          diet_other text DEFAULT '', meal_times text DEFAULT 'All meals',
          portion_reference double precision DEFAULT 1,
          created_at timestamptz DEFAULT now()
        );
        CREATE TEMP TABLE recipes (
          id uuid PRIMARY KEY, list_id uuid, cuisine text, tags jsonb DEFAULT '[]',
          next_ingredient_id integer DEFAULT 1, from_name text, from_url text,
          created_by uuid, origin text
        );
        CREATE TEMP TABLE variants (
          id uuid PRIMARY KEY, recipe_id uuid, list_id uuid, name text,
          description text, locale text, total_time text, recipe_yield text,
          content_markdown text, equipment jsonb DEFAULT '[]', effort text,
          ingredient_lines jsonb DEFAULT '[]', instructions jsonb DEFAULT '[]',
          sized_for jsonb, created_at timestamptz DEFAULT now()
        );
        CREATE TEMP TABLE planned_meals (
          id uuid PRIMARY KEY, list_id uuid, recipe_id uuid, variant_id uuid,
          name text, content_id uuid DEFAULT gen_random_uuid(),
          slot_date text, meal text, eater_ids jsonb, extra_portions double precision,
          shopping_reviewed_variant_id uuid,
          ingredient_swaps jsonb NOT NULL DEFAULT '{}',
          ingredients_at_home jsonb NOT NULL DEFAULT '[]',
          updated_at timestamptz DEFAULT now()
        );
        CREATE TEMP TABLE list_items (
          id uuid PRIMARY KEY, list_id uuid, name text, name_key text,
          category_id text, spec text, status text, purchase_count integer DEFAULT 0,
          planned_meal_id uuid, variant_id uuid
        );
      `);
      await client.query(
        `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)`,
        [listId, userId],
      );
      await client.query(
        `INSERT INTO household_profiles (id, meal_ideas_brief)
         VALUES ($1, 'Quick suppers, mostly vegetable-led.')`,
        [listId],
      );
      await client.query(
        `INSERT INTO household_people (id, list_id, user_id, name)
         VALUES ($1, $2, $3, 'Sam')`,
        [personId, listId, userId],
      );

      t.mock.method(pool, "connect", async () =>
        Object.assign(client, { release: () => undefined }),
      );
      t.mock.method(
        pool,
        "query",
        client.query.bind(client) as typeof pool.query,
      );

      const added = (await callTool("addToCookbook", {
        name: "Test pasta",
        description: "A test recipe.",
        locale: "en",
        totalTime: "20 minutes",
        recipeYield: "2 servings",
        recipeIngredient: [
          {
            qty_text: "200g",
            item_name: "pasta",
            category_id: "grains",
            shopping_hint: "likely_purchase",
          },
        ],
        recipeInstructions: [
          {
            name: "Boil",
            ingredients: [{ qty_text: null, item_name: "pasta" }],
            text: "Boil the pasta.",
          },
        ],
        recipeCuisine: "italian",
        tags: ["pasta"],
        equipment: [],
        effort: "easy",
      })) as { variantId: string; name: string; url: string };
      assert.equal(added.name, "Test pasta");
      assert.equal(added.url, `magpie://variant/${added.variantId}`);
      const saved = await client.query<{
        origin: string | null;
        created_by: string;
      }>(
        `SELECT recipes.origin, recipes.created_by FROM recipes
         JOIN variants ON variants.recipe_id = recipes.id
         WHERE variants.id = $1`,
        [added.variantId],
      );
      assert.equal(saved.rows[0]?.origin, null);
      assert.equal(saved.rows[0]?.created_by, userId);

      const planned = (await callTool("planMeal", {
        variantId: added.variantId,
        date: today,
        meal: "dinner",
      })) as { plannedMealId: string; name: string };
      assert.equal(planned.name, "Test pasta");

      const readBack = (await callTool("readPlan", {
        fromDate: today,
        days: 1,
      })) as { date: string; meal: string; name: string }[];
      assert.deepEqual(readBack, [
        {
          date: today,
          meal: "dinner",
          variantId: added.variantId,
          name: "Test pasta",
          eaters: ["Sam"],
          everyone: true,
          extraPortions: 0,
        },
      ]);

      const unplanned = await callTool("unplanMeal", {
        date: today,
        meal: "dinner",
      });
      assert.deepEqual(unplanned, { removed: true });

      const emptyPlan = await callTool("readPlan", {
        fromDate: today,
        days: 1,
      });
      assert.deepEqual(emptyPlan, []);

      // The signed-in user is still a member; nothing above wrote real rows.
      assert.equal((await client.query("SELECT 1")).rowCount, 1);
    } finally {
      await client.end();
    }
  },
);
