import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const readCatalog = (locale) =>
  JSON.parse(
    readFileSync(new URL(`../i18n/${locale}.json`, import.meta.url), "utf8"),
  );

function placeholders(message) {
  const signatures = new Set();
  function visit(elements) {
    for (const element of elements) {
      const { type, value } = element;
      if (type === TYPE.literal || type === TYPE.pound) continue;
      let detail;
      if (type === TYPE.select || type === TYPE.plural) {
        const keys = Object.keys(element.options).sort();
        detail =
          type === TYPE.select
            ? keys
            : [
                element.pluralType,
                element.offset,
                keys.filter((key) => key.startsWith("=")),
              ];
        for (const option of Object.values(element.options))
          visit(option.value);
      } else if (type === TYPE.tag) {
        visit(element.children);
      }
      signatures.add(JSON.stringify([type, value, detail]));
    }
  }
  visit(parse(message));
  return [...signatures].sort();
}

const source = readCatalog("en");
const target = readCatalog("de");
assert(Object.keys(source).length > 0, "Source catalog is empty");

const problems = [];
for (const [id, { defaultMessage, description }] of Object.entries(source)) {
  const label = `${id} (${defaultMessage})`;
  const translation = target[id]?.defaultMessage;
  try {
    assert(description?.trim(), "missing source description");
    assert(defaultMessage?.trim(), "empty source message");
    assert(translation?.trim(), "missing German translation");
    assert.deepEqual(
      placeholders(translation),
      placeholders(defaultMessage),
      "ICU arguments or selectors differ",
    );
  } catch (error) {
    problems.push(`${label}: ${error.message}`);
  }
}
for (const id of Object.keys(target)) {
  if (!Object.hasOwn(source, id)) problems.push(`${id}: stale German message`);
}
assert(problems.length === 0, problems.join("\n"));
console.log(
  `Checked ${Object.keys(source).length} English and German messages.`,
);
