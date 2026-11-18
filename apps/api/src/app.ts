import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { type AppBindings, requireUser } from "./auth.js";
import { chats } from "./routes/chats.js";
import { items } from "./routes/items.js";
import { AppError } from "./errors.js";
import { env } from "./env.js";
import { loggablePath } from "./loggable-path.js";
import { oauth } from "./routes/oauth.js";
import { mcp } from "./routes/mcp.js";
import { posthogApiLogger } from "./posthog-logs.js";
import { plannedMeals } from "./routes/planned-meals.js";
import { recipes } from "./routes/recipes.js";
import { invitations } from "./routes/invitations.js";
import { favicons } from "./routes/favicons.js";
import { sharedRecipes } from "./routes/shared-recipes.js";
import { mealRecommendations } from "./routes/meal-recommendations.js";

export const app = new Hono<AppBindings>();

// Invitation and share paths contain a bearer secret. Keep them out of logs.
app.use("*", (c, next) =>
  c.req.path.startsWith("/join/") || c.req.path.startsWith("/r/")
    ? next()
    : logger()(c, next),
);

// The apex is the origin shared links and OAuth discovery use. Sending www
// there permanently avoids serving the same pages under a second origin.
const canonicalOrigin = env.publicOrigin ? new URL(env.publicOrigin) : null;
app.use("*", async (c, next) => {
  if (canonicalOrigin) {
    const requested = new URL(c.req.url);
    if (requested.hostname === `www.${canonicalOrigin.hostname}`) {
      return c.redirect(
        new URL(
          `${requested.pathname}${requested.search}`,
          canonicalOrigin,
        ).toString(),
        301,
      );
    }
  }
  await next();
});

// The native app is not subject to CORS; Expo web and browser testing are.
app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowHeaders: ["authorization", "content-type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

// Unauthenticated on purpose: Fly's health check has no token to present.
app.get("/health", (c) => c.json({ ok: true }));
app.route("/", favicons);
app.route("/join", invitations);
app.route("/r", sharedRecipes);

// Everything under /v1 needs a Supabase access token. Mounted after cors so
// preflight requests, which carry no Authorization header, are not rejected.
app.use("/v1/*", requireUser);
app.route("/v1/chats", chats);
app.route("/v1/items", items);
app.route("/v1/recipes", recipes);
app.route("/v1/planned-meals", plannedMeals);
app.route("/v1/meal-recommendations", mealRecommendations);

// OAuth discovery and the consent page sit at the origin root, not under /v1.
app.route("/", oauth);

// MCP is a second transport, not a /v1 resource. Its own middleware checks
// the same Supabase token; the SDK then receives the resolved user and list.
app.route("/mcp", mcp);

app.notFound((c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
);

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.status,
    );
  }
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: err.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
          message: err.message,
        },
      },
      err.status,
    );
  }

  console.error(err);
  posthogApiLogger.error("unexpected api error", {
    method: c.req.method,
    path: loggablePath(c.req.path),
    error_name: err.name,
    error_message: err.message,
    stack: err.stack ?? "",
  });
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    500,
  );
});
