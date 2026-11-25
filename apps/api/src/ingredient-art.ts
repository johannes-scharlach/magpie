import { createHash } from "node:crypto";
import {
  bundledIngredientArtCatalog,
  ingredientNameKey,
  knownIngredientArt,
} from "@magpie/profile";

export type IngredientArtResolution =
  { artId: string } | { ingredientName: string };

export type IngredientArtStore = {
  listPublished(): Promise<ReadonlyMap<string, string>>;
  read(keys: string[]): Promise<ReadonlyMap<string, IngredientArtResolution>>;
  save(entries: ReadonlyMap<string, IngredientArtResolution>): Promise<void>;
};

export type IngredientArtJudgment = ({ artId: string } | { missing: true }) & {
  confidence: number;
};
export type MatchIngredientArt = (
  names: string[],
  catalog: ReadonlyMap<string, string>,
) => Promise<ReadonlyMap<string, IngredientArtJudgment>>;

const clearMatch = 0.9;
const knownUndrawnNames = new Set([
  "eggplant",
  "spring onions",
  "tomato paste",
  "zucchini",
]);
export function canonicalArtName(label: string): string | undefined {
  const subject = ingredientNameKey(label).replaceAll("-", " ");
  return knownUndrawnNames.has(subject) ? subject : undefined;
}
// Not a food classifier. This excludes obvious notes, amounts and sentences
// with punctuation before Jev judges whether it is a plain ingredient name.
const namePattern = /^[\p{L}\p{M}]+(?:[ ’'-][\p{L}\p{M}]+){0,7}$/u;

/** Returns only art IDs, in input order. Never use them as ingredient keys. */
export async function resolveIngredientArt(
  labels: readonly string[],
  store: IngredientArtStore,
  match: MatchIngredientArt,
): Promise<(string | null)[]> {
  const art = labels.map((label) => knownIngredientArt(label) ?? null);
  const names = labels.map((label, index) => {
    if (art[index] !== null) return "";
    const name = label
      .normalize("NFC")
      .trim()
      .toLowerCase()
      .replace(/ +/g, " ");
    return name.length <= 96 && namePattern.test(name) ? name : "";
  });
  const keys = new Map(
    [...new Set(names.filter(Boolean))].map((name) => [
      name,
      createHash("sha256").update(name).digest("hex"),
    ]),
  );
  if (!keys.size) return art;

  const [existing, published] = await Promise.all([
    store.read([...keys.values()]),
    store.listPublished(),
  ]);
  let saved = existing;
  const byName = new Map(
    [...published].map(([id, name]) => [canonicalArtName(name) ?? name, id]),
  );
  const catalog = new Map([...bundledIngredientArtCatalog, ...published]);
  const learned = new Map<string, IngredientArtResolution>();
  const unmatched = [...keys].filter(([name, key]) => {
    if (saved.has(key)) return false;
    const canonical = canonicalArtName(name);
    if (byName.has(canonical ?? name)) return false;
    if (!canonical) return true;
    learned.set(key, { ingredientName: canonical });
    return false;
  });
  if (unmatched.length) {
    const judgments = await match(
      unmatched.map(([name]) => name),
      catalog,
    );
    for (const [name, key] of unmatched) {
      const answer = judgments.get(name);
      if (!answer || !(answer.confidence >= clearMatch)) continue;
      if ("missing" in answer) learned.set(key, { ingredientName: name });
      else if (catalog.has(answer.artId)) {
        learned.set(key, { artId: answer.artId });
      }
    }
  }
  if (learned.size) {
    await store.save(learned);
    // A concurrent request may have saved the alias first.
    saved = await store.read([...keys.values()]);
  }

  return art.map((id, index) => {
    if (id) return id;
    const name = names[index]!;
    const key = keys.get(name);
    const learned = key ? saved.get(key) : undefined;
    if (learned && "artId" in learned)
      return catalog.has(learned.artId) ? learned.artId : null;
    const subject = learned?.ingredientName ?? name;
    return byName.get(canonicalArtName(subject) ?? subject) ?? null;
  });
}

/** Revisit queued misses against artwork that didn't exist at lookup time. */
export async function reconsiderIngredientArt(
  names: string[],
  published: ReadonlyMap<string, string>,
  match?: MatchIngredientArt,
) {
  const byName = new Map(
    [...published].map(([id, name]) => [canonicalArtName(name) ?? name, id]),
  );
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const key = canonicalArtName(name) ?? name;
    groups.set(key, [...(groups.get(key) ?? []), name]);
  }
  const pending: string[] = [];
  const aliases = new Map<string, string>();
  const unmatched: string[] = [];
  const reuse = (key: string, id: string) => {
    for (const name of groups.get(key)!) aliases.set(name, id);
  };
  for (const key of groups.keys()) {
    const artId = knownIngredientArt(key) ?? byName.get(key);
    if (artId) reuse(key, artId);
    else unmatched.push(key);
  }
  if (!match || !published.size) return { pending: unmatched, aliases };
  for (let i = 0; i < unmatched.length; i += 12) {
    const batch = unmatched.slice(i, i + 12);
    const judgments = await match(batch, published);
    for (const key of batch) {
      const answer = judgments.get(key);
      if (!answer || !(answer.confidence >= clearMatch)) continue;
      if ("missing" in answer) pending.push(key);
      else if (published.has(answer.artId)) reuse(key, answer.artId);
    }
  }
  return { pending, aliases };
}
