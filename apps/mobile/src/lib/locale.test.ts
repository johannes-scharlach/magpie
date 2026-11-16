import { describe, expect, it } from "vitest";

import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("accepts a supported language with or without a region", () => {
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("de-AT")).toBe("de");
    expect(resolveLocale("en-GB")).toBe("en");
  });

  it("falls back to the source locale for unsupported or missing languages", () => {
    expect(resolveLocale("fr-FR")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
