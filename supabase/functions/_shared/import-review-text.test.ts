import { assertEquals } from 'jsr:@std/assert@^1';
import { importReviewText } from './import-review-text.ts';

Deno.test('says what was found and what the cook does next', () => {
  assertEquals(importReviewText({ recipe_count: 24, skipped_count: 0 }), {
    title: 'Found 24 recipes',
    body: 'Choose which ones go to your cookbook.',
  });
});

Deno.test('names the incomplete ones, which the cook may want to retake', () => {
  assertEquals(importReviewText({ recipe_count: 1, skipped_count: 2 }), {
    title: 'Found 1 recipe, 2 incomplete',
    body: 'Choose which ones go to your cookbook.',
  });
});
