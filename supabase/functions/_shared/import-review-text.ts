// Import review push (ADR 35): an import found several recipes and waits for
// the cook to choose which to keep.

export type ImportReview = { recipe_count: number; skipped_count: number };

export function importReviewText({ recipe_count, skipped_count }: ImportReview) {
  const found = recipe_count === 1 ? 'Found 1 recipe' : `Found ${recipe_count} recipes`;
  return {
    title: skipped_count ? `${found}, ${skipped_count} incomplete` : found,
    body: 'Choose which ones go to your cookbook.',
  };
}
