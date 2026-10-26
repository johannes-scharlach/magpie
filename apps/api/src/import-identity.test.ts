import assert from "node:assert/strict";
import { test } from "node:test";

import { contentSource, deriveVariantIdForImport } from "./import-identity.js";

const request = {
  operationId: "operation",
  source: "https://example.com/recipe",
  locale: "en",
  plan: { listId: "list", date: "2026-09-08", slot: "dinner" },
} as const;

test("retries derive the same identity regardless of object key order", () => {
  assert.equal(
    deriveVariantIdForImport("user", {
      ...request,
      plan: { slot: "dinner", date: "2026-09-08", listId: "list" },
    }),
    deriveVariantIdForImport("user", request),
  );
});

test("another caller, operation, or destination cannot reuse the saved result", () => {
  const id = deriveVariantIdForImport("user", request);
  assert.notEqual(deriveVariantIdForImport("another-user", request), id);
  assert.notEqual(
    deriveVariantIdForImport("user", {
      ...request,
      operationId: "next-operation",
    }),
    id,
  );
  assert.notEqual(
    deriveVariantIdForImport("user", {
      ...request,
      plan: { ...request.plan, slot: "lunch" },
    }),
    id,
  );
  assert.notEqual(
    deriveVariantIdForImport("user", { ...request, plan: undefined }),
    id,
  );
});

test("retrying the same content finds the earlier import; other content does not", () => {
  const page = new TextEncoder().encode("page one");
  const other = new TextEncoder().encode("page two");
  assert.equal(
    contentSource("page 2 is the sauce", [page]),
    contentSource("page 2 is the sauce", [new Uint8Array(page)]),
  );
  assert.notEqual(
    contentSource(undefined, [page]),
    contentSource(undefined, [other]),
  );
  assert.notEqual(
    contentSource(undefined, [page, other]),
    contentSource(undefined, [page]),
  );
  assert.notEqual(
    contentSource("a recipe", []),
    contentSource("another recipe", []),
  );
  assert.notEqual(contentSource("a", [page]), contentSource(undefined, [page]));
});
