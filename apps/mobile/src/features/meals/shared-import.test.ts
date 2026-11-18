import { describe, expect, it } from "vitest";

import { sharedImportSource } from "./shared-import";

describe("sharedImportSource", () => {
  it("imports the shared link even when the app also shares a caption", () => {
    expect(
      sharedImportSource({
        webUrl: "https://vm.tiktok.com/ZGdXbBDjC/",
        text: "Spaghetti-Eis-Plätzchen 🍝",
      }),
    ).toEqual({ kind: "link", url: "https://vm.tiktok.com/ZGdXbBDjC/" });
  });

  it("imports shared text as the recipe itself", () => {
    const caption = "Zutaten:\n- 90 g weiche Butter\n- 160 g Mehl";
    expect(sharedImportSource({ text: caption })).toEqual({
      kind: "text",
      text: caption,
    });
  });

  it("reads a link shared as plain text as the page behind it", () => {
    expect(
      sharedImportSource({ text: "https://www.tiktok.com/t/ZTabc123/" }),
    ).toEqual({ kind: "link", url: "https://www.tiktok.com/t/ZTabc123/" });
  });

  it("has nothing to import when the app shared no usable text", () => {
    expect(sharedImportSource({ webUrl: null, text: " \n" })).toBeNull();
  });
});
