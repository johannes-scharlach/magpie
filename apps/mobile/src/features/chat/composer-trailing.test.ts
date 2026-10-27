import { expect, it } from "vitest";

import { composerTrailing } from "./composer-trailing";

const idle = {
  text: "",
  attachmentCount: 0,
  focused: false,
  hasEmptyAction: false,
  recording: false,
};

it("offers the microphone while there is nothing to send", () => {
  expect(composerTrailing(idle)).toBe("mic");
});

it("swaps the microphone for Send once there is text or an attachment", () => {
  expect(composerTrailing({ ...idle, text: "more salt" })).toBe("send");
  expect(composerTrailing({ ...idle, attachmentCount: 1 })).toBe("send");
});

it("sends a recording in progress, even on a screen with its own idle action", () => {
  expect(
    composerTrailing({ ...idle, hasEmptyAction: true, recording: true }),
  ).toBe("send");
});

it("treats whitespace as nothing to send", () => {
  expect(composerTrailing({ ...idle, text: "  \n" })).toBe("mic");
});

it("leaves an idle screen's own action in place until the field is focused", () => {
  expect(composerTrailing({ ...idle, hasEmptyAction: true })).toBe(
    "emptyAction",
  );
  expect(
    composerTrailing({ ...idle, hasEmptyAction: true, focused: true }),
  ).toBe("mic");
});
