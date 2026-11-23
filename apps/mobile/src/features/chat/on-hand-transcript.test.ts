import { createHash } from "node:crypto";
import { createIntl, type MessageDescriptor } from "react-intl";
import { expect, it } from "vitest";

import de from "../../../i18n/compiled/de.json";
import { formatOnHandTranscript } from "./on-hand-transcript";

it("formats the same saved selections for the current reader without translating their note", () => {
  function intl(locale: "en" | "de") {
    const base = createIntl({ locale, messages: locale === "de" ? de : {} });
    // Metro injects this ID from the source and description. Vitest does not.
    const formatMessage = (
      message: MessageDescriptor,
      values?: Parameters<typeof base.formatMessage>[1],
    ) => {
      const id = createHash("sha512")
        .update(`${message.defaultMessage}#${message.description}`)
        .digest("base64")
        .slice(0, 6);
      if (locale === "de") expect(de).toHaveProperty(id);
      // eslint-disable-next-line formatjs/enforce-description, formatjs/enforce-default-message, formatjs/no-id
      return base.formatMessage({ ...message, id }, values);
    };
    return { ...base, formatMessage } as typeof base;
  }
  const entry = {
    target: { date: "2026-11-27", slot: "lunch" as const },
    ingredients: ["Cabbage", "Frozen green beans", "Grandma's mix"],
    note: "No oven, please.",
  };
  expect(formatOnHandTranscript(intl("en"), entry)).toMatch(
    /Cabbage, Frozen green beans, and Grandma's mix/,
  );
  expect(formatOnHandTranscript(intl("de"), entry)).toMatch(
    /Kohl, Tiefgekühlte grüne Bohnen und Grandma's mix/,
  );
  expect(formatOnHandTranscript(intl("de"), entry)).toMatch(
    /Mittagessen.*\n.*\nNo oven, please\.$/,
  );
});
