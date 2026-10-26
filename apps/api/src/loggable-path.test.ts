import assert from "node:assert/strict";
import { test } from "node:test";

import { loggablePath } from "./loggable-path.js";

test("invitation and share secrets never reach logs", () => {
  assert.equal(loggablePath("/join/s3cret-token"), "/join/:token");
  assert.equal(loggablePath("/r/s3cret-token"), "/r/:token");
});

test("other paths are logged as they are", () => {
  assert.equal(
    loggablePath("/v1/recipes/import-from-url"),
    "/v1/recipes/import-from-url",
  );
  assert.equal(loggablePath("/report"), "/report");
});
