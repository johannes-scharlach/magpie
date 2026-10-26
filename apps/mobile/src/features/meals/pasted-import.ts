export type PastedImport =
  { kind: "link"; url: string } | { kind: "text"; text: string };

/** A copied link alone imports the page behind it. Anything else, such as a
 *  caption or a recipe from a message, is the recipe itself. */
export function pastedImport(pasted: string): PastedImport | null {
  const text = pasted.trim();
  if (!text) return null;
  if (/^https?:\/\/\S+$/i.test(text) && URL.canParse(text)) {
    return { kind: "link", url: text };
  }
  return { kind: "text", text };
}
