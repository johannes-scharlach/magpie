import { profileChangesSchema, type Shop } from "@magpie/profile";
import { expect, it } from "vitest";
import { createDraft, restoreDraft } from "../onboarding/draft";
import { saveShopEntry, shopChanges, shopsHaveRules } from "./shop-entry";

it("saving a shop writes only the shop list and clears the legacy main-shop field", () => {
  const shops: Shop[] = [{ name: "Aldi", rule: "everyday" }];
  expect(profileChangesSchema.parse(shopChanges(shops))).toEqual({
    main_supermarket: "",
    shops,
  });
});

it("Save adds a complete shop that survives validation and onboarding recovery", () => {
  const shops: Shop[] = [{ name: "Asian supermarket", rule: "worth-trip" }];
  const saved = saveShopEntry(shops, null, {
    name: " Aldi ",
    rule: "everyday",
  });
  expect(shopsHaveRules(saved)).toBe(true);
  expect(shops).toEqual([{ name: "Asian supermarket", rule: "worth-trip" }]);

  expect(profileChangesSchema.parse({ shops: saved })).toEqual({
    shops: [
      { name: "Asian supermarket", rule: "worth-trip" },
      { name: "Aldi", rule: "everyday" },
    ],
  });

  const draft = createDraft(
    "a17c9a92-784c-4dfe-b282-20bcfd877b11",
    "e6169ef8-eb42-4fd3-ae4d-2932d9372381",
  );
  draft.profile.other_shops = "Weekly market on Saturdays";
  draft.profile = { ...draft.profile, ...shopChanges(saved) };
  draft.step = "kitchen";
  expect(restoreDraft(JSON.stringify(draft))?.profile.shops).toEqual([
    { name: "Asian supermarket", rule: "worth-trip" },
    { name: "Aldi", rule: "everyday" },
  ]);
  expect(restoreDraft(JSON.stringify(draft))?.profile.other_shops).toBe(
    "Weekly market on Saturdays",
  );
});

it("an incomplete Save cannot add a shop or erase an existing one", () => {
  const shops: Shop[] = [
    { name: "Aldi", rule: "everyday" },
    { name: "Asian supermarket", rule: "worth-trip" },
  ];
  expect(() =>
    saveShopEntry(shops, 0, { name: "   ", rule: "everyday" }),
  ).toThrow("Enter a shop name.");
  expect(() => saveShopEntry(shops, null, { name: "Butcher" })).toThrow(
    "Choose how Magpie should use this shop.",
  );
  expect(shops).toEqual([
    { name: "Aldi", rule: "everyday" },
    { name: "Asian supermarket", rule: "worth-trip" },
  ]);
  expect(shopsHaveRules([])).toBe(true);
  expect(shopsHaveRules([{ name: "Aldi", access: "easy" }])).toBe(false);
});

it("Save replaces the edited shop in place without changing other shops", () => {
  const shops: Shop[] = [
    { name: "Aldi", rule: "everyday" },
    { name: "Butcher", rule: "upgrade" },
  ];
  const renamed = saveShopEntry(shops, 0, { name: "Rewe", rule: "everyday" });
  expect(renamed).toEqual([
    { name: "Rewe", rule: "everyday" },
    { name: "Butcher", rule: "upgrade" },
  ]);
  expect(() =>
    saveShopEntry(shops, 4, { name: "Rewe", rule: "everyday" }),
  ).toThrow("This shop is no longer in your list.");
});
