import { pastedImport, type PastedImport } from "./pasted-import";

/** What another app handed over in the share sheet. */
export type SharedContent = {
  webUrl?: string | null;
  text?: string | null;
};

/**
 * A shared link imports the page behind it; a caption that also holds a link
 * still imports the page. Only text without a link is the recipe itself, the
 * same as pasting it (ADR 31).
 */
export function sharedImportSource({
  webUrl,
  text,
}: SharedContent): PastedImport | null {
  const link = pastedImport(webUrl ?? "");
  if (link?.kind === "link") return link;
  return pastedImport(text ?? "");
}
