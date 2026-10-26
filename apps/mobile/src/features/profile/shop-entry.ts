import type { CookingProfile, Shop } from "@magpie/profile";

export type ShopsProfile = Pick<
  CookingProfile,
  "main_supermarket" | "shops" | "other_shops"
>;

export function shopChanges(
  shops: Shop[],
): Pick<ShopsProfile, "main_supermarket" | "shops"> {
  return {
    main_supermarket: "",
    shops,
  };
}

export function shopsHaveRules(shops: readonly Shop[]): boolean {
  return shops.every((shop) => !!shop.rule);
}

/** The editor stays local; only Save publishes a complete entry to the list. */
export function saveShopEntry(
  shops: readonly Shop[],
  index: number | null,
  shop: Shop,
): Shop[] {
  const value = { ...shop, name: shop.name.trim() };
  if (!value.name) throw new Error("Enter a shop name.");
  if (!value.rule) throw new Error("Choose how Magpie should use this shop.");
  if (index === null) return [...shops, value];
  if (!Number.isInteger(index) || index < 0 || !shops[index]) {
    throw new Error("This shop is no longer in your list.");
  }
  return shops.map((entry, position) => (position === index ? value : entry));
}
