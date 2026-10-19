import { Image } from "expo-image";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { CookingProfile } from "@magpie/profile";
import {
  equipmentOptions,
  freshOptions,
  ingredientOptions,
  pantryOptions,
} from "@magpie/profile";
import { kitchenPortrait } from "./kitchen-portrait";

// Every ID has a production brief in art/README.md. Ship the transparent WebP
// exports from pnpm assets:optimize, not the PNG masters; missing art gets a placeholder.
export type ArtworkId =
  | "welcome-market-find"
  | `equipment-${keyof typeof equipmentOptions}`
  | `pantry-${keyof typeof pantryOptions}`
  | `fresh-${keyof typeof freshOptions}`
  | `ingredient-${keyof typeof ingredientOptions}`;

const deliveredAssets: Partial<Record<ArtworkId, number>> = {
  "welcome-market-find": require("./art/optimized/welcome-market-find.webp"),
  "equipment-oven": require("./art/optimized/equipment-oven.webp"),
  "equipment-stove": require("./art/optimized/equipment-stove.webp"),
  "equipment-microwave": require("./art/optimized/equipment-microwave.webp"),
  "equipment-slow-cooker": require("./art/optimized/equipment-slow-cooker.webp"),
  "equipment-air-fryer": require("./art/optimized/equipment-air-fryer.webp"),
  "equipment-blender": require("./art/optimized/equipment-blender.webp"),
  "equipment-food-processor": require("./art/optimized/equipment-food-processor.webp"),
  "equipment-rice-cooker": require("./art/optimized/equipment-rice-cooker.webp"),
  "pantry-pasta": require("./art/optimized/pantry-pasta.webp"),
  "pantry-rice": require("./art/optimized/pantry-rice.webp"),
  "pantry-canned-tomatoes": require("./art/optimized/pantry-canned-tomatoes.webp"),
  "pantry-noodles": require("./art/optimized/pantry-noodles.webp"),
  "pantry-canned-corn": require("./art/optimized/pantry-canned-corn.webp"),
  "pantry-canned-tuna": require("./art/optimized/pantry-canned-tuna.webp"),
  "pantry-chickpeas": require("./art/optimized/pantry-chickpeas.webp"),
  "pantry-lentils": require("./art/optimized/pantry-lentils.webp"),
  "pantry-canned-beans": require("./art/optimized/pantry-canned-beans.webp"),
  "pantry-olive-oil": require("./art/optimized/pantry-olive-oil.webp"),
  "pantry-soy-sauce": require("./art/optimized/pantry-soy-sauce.webp"),
  "pantry-vinegar": require("./art/optimized/pantry-vinegar.webp"),
  "pantry-peanut-butter": require("./art/optimized/pantry-peanut-butter.webp"),
  "pantry-oats": require("./art/optimized/pantry-oats.webp"),
  "pantry-flour": require("./art/optimized/pantry-flour.webp"),
  "pantry-coconut-milk": require("./art/optimized/pantry-coconut-milk.webp"),
  "pantry-honey": require("./art/optimized/pantry-honey.webp"),
  "pantry-sugar": require("./art/optimized/pantry-sugar.webp"),
  "pantry-stock": require("./art/optimized/pantry-stock.webp"),
  "pantry-spices": require("./art/optimized/pantry-spices.webp"),
  "fresh-eggs": require("./art/optimized/fresh-eggs.webp"),
  "fresh-milk": require("./art/optimized/fresh-milk.webp"),
  "fresh-butter": require("./art/optimized/fresh-butter.webp"),
  "fresh-cheese": require("./art/optimized/fresh-cheese.webp"),
  "fresh-greek-yoghurt": require("./art/optimized/fresh-greek-yoghurt.webp"),
  "fresh-plain-yoghurt": require("./art/optimized/fresh-plain-yoghurt.webp"),
  "fresh-cream": require("./art/optimized/fresh-cream.webp"),
  "ingredient-soy-sauce": require("./art/optimized/pantry-soy-sauce.webp"),
  "ingredient-canned-corn": require("./art/optimized/pantry-canned-corn.webp"),
  "ingredient-canned-tuna": require("./art/optimized/pantry-canned-tuna.webp"),
  "ingredient-chickpeas": require("./art/optimized/pantry-chickpeas.webp"),
  "ingredient-lentils": require("./art/optimized/pantry-lentils.webp"),
  "ingredient-canned-beans": require("./art/optimized/pantry-canned-beans.webp"),
  "ingredient-peanut-butter": require("./art/optimized/pantry-peanut-butter.webp"),
  "ingredient-noodles": require("./art/optimized/pantry-noodles.webp"),
  "ingredient-oats": require("./art/optimized/pantry-oats.webp"),
  "ingredient-coconut-milk": require("./art/optimized/pantry-coconut-milk.webp"),
  "ingredient-advieh": require("./art/optimized/ingredient-advieh.webp"),
  "ingredient-aji-amarillo": require("./art/optimized/ingredient-aji-amarillo.webp"),
  "ingredient-aji-panca": require("./art/optimized/ingredient-aji-panca.webp"),
  "ingredient-allspice": require("./art/optimized/ingredient-allspice.webp"),
  "ingredient-amchur": require("./art/optimized/ingredient-amchur.webp"),
  "ingredient-ancho-chiles": require("./art/optimized/ingredient-ancho-chiles.webp"),
  "ingredient-anchovies": require("./art/optimized/ingredient-anchovies.webp"),
  "ingredient-annatto": require("./art/optimized/ingredient-annatto.webp"),
  "ingredient-arborio-rice": require("./art/optimized/ingredient-arborio-rice.webp"),
  "ingredient-argan-oil": require("./art/optimized/ingredient-argan-oil.webp"),
  "ingredient-asafoetida": require("./art/optimized/ingredient-asafoetida.webp"),
  "ingredient-baharat": require("./art/optimized/ingredient-baharat.webp"),
  "ingredient-balsamic-vinegar": require("./art/optimized/ingredient-balsamic-vinegar.webp"),
  "ingredient-barberries": require("./art/optimized/ingredient-barberries.webp"),
  "ingredient-beetroot": require("./art/optimized/ingredient-beetroot.webp"),
  "ingredient-belacan": require("./art/optimized/ingredient-belacan.webp"),
  "ingredient-berbere": require("./art/optimized/ingredient-berbere.webp"),
  "ingredient-besan": require("./art/optimized/ingredient-besan.webp"),
  "ingredient-black-beans": require("./art/optimized/ingredient-black-beans.webp"),
  "ingredient-black-cardamom": require("./art/optimized/ingredient-black-cardamom.webp"),
  "ingredient-brunost": require("./art/optimized/ingredient-brunost.webp"),
  "ingredient-buckwheat": require("./art/optimized/ingredient-buckwheat.webp"),
  "ingredient-bulgur": require("./art/optimized/ingredient-bulgur.webp"),
  "ingredient-capers": require("./art/optimized/ingredient-capers.webp"),
  "ingredient-caraway-seeds": require("./art/optimized/ingredient-caraway-seeds.webp"),
  "ingredient-cardamom": require("./art/optimized/ingredient-cardamom.webp"),
  "ingredient-chilli-crisp": require("./art/optimized/ingredient-chilli-crisp.webp"),
  "ingredient-chinese-sesame-paste": require("./art/optimized/ingredient-chinese-sesame-paste.webp"),
  "ingredient-chinkiang-vinegar": require("./art/optimized/ingredient-chinkiang-vinegar.webp"),
  "ingredient-chipotles-in-adobo": require("./art/optimized/ingredient-chipotles-in-adobo.webp"),
  "ingredient-chorizo": require("./art/optimized/ingredient-chorizo.webp"),
  "ingredient-coconut-oil": require("./art/optimized/ingredient-coconut-oil.webp"),
  "ingredient-corn-tortillas": require("./art/optimized/ingredient-corn-tortillas.webp"),
  "ingredient-cornichons": require("./art/optimized/ingredient-cornichons.webp"),
  "ingredient-couscous": require("./art/optimized/ingredient-couscous.webp"),
  "ingredient-creme-fraiche": require("./art/optimized/ingredient-creme-fraiche.webp"),
  "ingredient-crispbread": require("./art/optimized/ingredient-crispbread.webp"),
  "ingredient-cumin-seeds": require("./art/optimized/ingredient-cumin-seeds.webp"),
  "ingredient-curry-leaves": require("./art/optimized/ingredient-curry-leaves.webp"),
  "ingredient-dark-soy-sauce": require("./art/optimized/ingredient-dark-soy-sauce.webp"),
  "ingredient-dashi-powder": require("./art/optimized/ingredient-dashi-powder.webp"),
  "ingredient-desiccated-coconut": require("./art/optimized/ingredient-desiccated-coconut.webp"),
  "ingredient-dijon-mustard": require("./art/optimized/ingredient-dijon-mustard.webp"),
  "ingredient-dill": require("./art/optimized/ingredient-dill.webp"),
  "ingredient-doubanjiang": require("./art/optimized/ingredient-doubanjiang.webp"),
  "ingredient-dried-limes": require("./art/optimized/ingredient-dried-limes.webp"),
  "ingredient-dried-porcini": require("./art/optimized/ingredient-dried-porcini.webp"),
  "ingredient-dried-red-chillies": require("./art/optimized/ingredient-dried-red-chillies.webp"),
  "ingredient-dried-shiitake": require("./art/optimized/ingredient-dried-shiitake.webp"),
  "ingredient-dried-shrimp": require("./art/optimized/ingredient-dried-shrimp.webp"),
  "ingredient-english-mustard": require("./art/optimized/ingredient-english-mustard.webp"),
  "ingredient-fermented-black-beans": require("./art/optimized/ingredient-fermented-black-beans.webp"),
  "ingredient-feta": require("./art/optimized/ingredient-feta.webp"),
  "ingredient-filo-pastry": require("./art/optimized/ingredient-filo-pastry.webp"),
  "ingredient-fish-sauce": require("./art/optimized/ingredient-fish-sauce.webp"),
  "ingredient-freekeh": require("./art/optimized/ingredient-freekeh.webp"),
  "ingredient-fried-shallots": require("./art/optimized/ingredient-fried-shallots.webp"),
  "ingredient-furikake": require("./art/optimized/ingredient-furikake.webp"),
  "ingredient-galangal": require("./art/optimized/ingredient-galangal.webp"),
  "ingredient-garam-masala": require("./art/optimized/ingredient-garam-masala.webp"),
  "ingredient-ghee": require("./art/optimized/ingredient-ghee.webp"),
  "ingredient-gochugaru": require("./art/optimized/ingredient-gochugaru.webp"),
  "ingredient-gochujang": require("./art/optimized/ingredient-gochujang.webp"),
  "ingredient-golden-syrup": require("./art/optimized/ingredient-golden-syrup.webp"),
  "ingredient-gruyere": require("./art/optimized/ingredient-gruyere.webp"),
  "ingredient-guajillo-chiles": require("./art/optimized/ingredient-guajillo-chiles.webp"),
  "ingredient-guanciale": require("./art/optimized/ingredient-guanciale.webp"),
  "ingredient-halloumi": require("./art/optimized/ingredient-halloumi.webp"),
  "ingredient-harissa": require("./art/optimized/ingredient-harissa.webp"),
  "ingredient-herbes-de-provence": require("./art/optimized/ingredient-herbes-de-provence.webp"),
  "ingredient-hoisin-sauce": require("./art/optimized/ingredient-hoisin-sauce.webp"),
  "ingredient-horseradish": require("./art/optimized/ingredient-horseradish.webp"),
  "ingredient-jerk-seasoning": require("./art/optimized/ingredient-jerk-seasoning.webp"),
  "ingredient-juniper-berries": require("./art/optimized/ingredient-juniper-berries.webp"),
  "ingredient-kalamata-olives": require("./art/optimized/ingredient-kalamata-olives.webp"),
  "ingredient-kashk": require("./art/optimized/ingredient-kashk.webp"),
  "ingredient-kashmiri-chilli": require("./art/optimized/ingredient-kashmiri-chilli.webp"),
  "ingredient-kasuri-methi": require("./art/optimized/ingredient-kasuri-methi.webp"),
  "ingredient-katsuobushi": require("./art/optimized/ingredient-katsuobushi.webp"),
  "ingredient-kecap-manis": require("./art/optimized/ingredient-kecap-manis.webp"),
  "ingredient-kimchi": require("./art/optimized/ingredient-kimchi.webp"),
  "ingredient-kombu": require("./art/optimized/ingredient-kombu.webp"),
  "ingredient-labneh": require("./art/optimized/ingredient-labneh.webp"),
  "ingredient-lemongrass": require("./art/optimized/ingredient-lemongrass.webp"),
  "ingredient-lingonberry-jam": require("./art/optimized/ingredient-lingonberry-jam.webp"),
  "ingredient-malt-vinegar": require("./art/optimized/ingredient-malt-vinegar.webp"),
  "ingredient-manchego": require("./art/optimized/ingredient-manchego.webp"),
  "ingredient-marjoram": require("./art/optimized/ingredient-marjoram.webp"),
  "ingredient-masa-harina": require("./art/optimized/ingredient-masa-harina.webp"),
  "ingredient-massa-de-pimentao": require("./art/optimized/ingredient-massa-de-pimentao.webp"),
  "ingredient-mature-cheddar": require("./art/optimized/ingredient-mature-cheddar.webp"),
  "ingredient-mexican-oregano": require("./art/optimized/ingredient-mexican-oregano.webp"),
  "ingredient-mirin": require("./art/optimized/ingredient-mirin.webp"),
  "ingredient-miso": require("./art/optimized/ingredient-miso.webp"),
  "ingredient-mitmita": require("./art/optimized/ingredient-mitmita.webp"),
  "ingredient-mustard-seeds": require("./art/optimized/ingredient-mustard-seeds.webp"),
  "ingredient-nduja": require("./art/optimized/ingredient-nduja.webp"),
  "ingredient-niter-kibbeh": require("./art/optimized/ingredient-niter-kibbeh.webp"),
  "ingredient-nori": require("./art/optimized/ingredient-nori.webp"),
  "ingredient-orange-blossom-water": require("./art/optimized/ingredient-orange-blossom-water.webp"),
  "ingredient-orzo": require("./art/optimized/ingredient-orzo.webp"),
  "ingredient-oyster-sauce": require("./art/optimized/ingredient-oyster-sauce.webp"),
  "ingredient-palm-sugar": require("./art/optimized/ingredient-palm-sugar.webp"),
  "ingredient-pandan-leaves": require("./art/optimized/ingredient-pandan-leaves.webp"),
  "ingredient-paneer": require("./art/optimized/ingredient-paneer.webp"),
  "ingredient-panko": require("./art/optimized/ingredient-panko.webp"),
  "ingredient-parmesan": require("./art/optimized/ingredient-parmesan.webp"),
  "ingredient-pecorino": require("./art/optimized/ingredient-pecorino.webp"),
  "ingredient-piccalilli": require("./art/optimized/ingredient-piccalilli.webp"),
  "ingredient-pickled-cucumbers": require("./art/optimized/ingredient-pickled-cucumbers.webp"),
  "ingredient-pickled-herring": require("./art/optimized/ingredient-pickled-herring.webp"),
  "ingredient-piquillo-peppers": require("./art/optimized/ingredient-piquillo-peppers.webp"),
  "ingredient-piri-piri": require("./art/optimized/ingredient-piri-piri.webp"),
  "ingredient-polenta": require("./art/optimized/ingredient-polenta.webp"),
  "ingredient-pomegranate-molasses": require("./art/optimized/ingredient-pomegranate-molasses.webp"),
  "ingredient-preserved-lemons": require("./art/optimized/ingredient-preserved-lemons.webp"),
  "ingredient-pul-biber": require("./art/optimized/ingredient-pul-biber.webp"),
  "ingredient-puy-lentils": require("./art/optimized/ingredient-puy-lentils.webp"),
  "ingredient-quark": require("./art/optimized/ingredient-quark.webp"),
  "ingredient-queso-fresco": require("./art/optimized/ingredient-queso-fresco.webp"),
  "ingredient-quinoa": require("./art/optimized/ingredient-quinoa.webp"),
  "ingredient-ras-el-hanout": require("./art/optimized/ingredient-ras-el-hanout.webp"),
  "ingredient-rice-cakes": require("./art/optimized/ingredient-rice-cakes.webp"),
  "ingredient-rice-noodles": require("./art/optimized/ingredient-rice-noodles.webp"),
  "ingredient-rice-paper": require("./art/optimized/ingredient-rice-paper.webp"),
  "ingredient-rice-vinegar": require("./art/optimized/ingredient-rice-vinegar.webp"),
  "ingredient-rose-water": require("./art/optimized/ingredient-rose-water.webp"),
  "ingredient-rye-flour": require("./art/optimized/ingredient-rye-flour.webp"),
  "ingredient-saffron": require("./art/optimized/ingredient-saffron.webp"),
  "ingredient-sake": require("./art/optimized/ingredient-sake.webp"),
  "ingredient-sambal-oelek": require("./art/optimized/ingredient-sambal-oelek.webp"),
  "ingredient-sambar-powder": require("./art/optimized/ingredient-sambar-powder.webp"),
  "ingredient-sauerkraut": require("./art/optimized/ingredient-sauerkraut.webp"),
  "ingredient-scotch-bonnets": require("./art/optimized/ingredient-scotch-bonnets.webp"),
  "ingredient-sesame-oil": require("./art/optimized/ingredient-sesame-oil.webp"),
  "ingredient-shallots": require("./art/optimized/ingredient-shallots.webp"),
  "ingredient-shaoxing-wine": require("./art/optimized/ingredient-shaoxing-wine.webp"),
  "ingredient-sherry-vinegar": require("./art/optimized/ingredient-sherry-vinegar.webp"),
  "ingredient-shichimi-togarashi": require("./art/optimized/ingredient-shichimi-togarashi.webp"),
  "ingredient-shiro": require("./art/optimized/ingredient-shiro.webp"),
  "ingredient-sichuan-peppercorns": require("./art/optimized/ingredient-sichuan-peppercorns.webp"),
  "ingredient-smetana": require("./art/optimized/ingredient-smetana.webp"),
  "ingredient-smoked-paprika": require("./art/optimized/ingredient-smoked-paprika.webp"),
  "ingredient-soba": require("./art/optimized/ingredient-soba.webp"),
  "ingredient-spaetzle": require("./art/optimized/ingredient-spaetzle.webp"),
  "ingredient-speck": require("./art/optimized/ingredient-speck.webp"),
  "ingredient-sriracha": require("./art/optimized/ingredient-sriracha.webp"),
  "ingredient-star-anise": require("./art/optimized/ingredient-star-anise.webp"),
  "ingredient-sumac": require("./art/optimized/ingredient-sumac.webp"),
  "ingredient-tahini": require("./art/optimized/ingredient-tahini.webp"),
  "ingredient-tamarind": require("./art/optimized/ingredient-tamarind.webp"),
  "ingredient-teff-flour": require("./art/optimized/ingredient-teff-flour.webp"),
  "ingredient-teriyaki-sauce": require("./art/optimized/ingredient-teriyaki-sauce.webp"),
  "ingredient-tomatillos": require("./art/optimized/ingredient-tomatillos.webp"),
  "ingredient-udon": require("./art/optimized/ingredient-udon.webp"),
  "ingredient-umeboshi": require("./art/optimized/ingredient-umeboshi.webp"),
  "ingredient-urad-dal": require("./art/optimized/ingredient-urad-dal.webp"),
  "ingredient-urfa-biber": require("./art/optimized/ingredient-urfa-biber.webp"),
  "ingredient-vine-leaves": require("./art/optimized/ingredient-vine-leaves.webp"),
  "ingredient-zaatar": require("./art/optimized/ingredient-zaatar.webp"),
};

export function hasArtwork(id: string): id is ArtworkId {
  return id in deliveredAssets;
}

export function Artwork({
  id,
  hero = false,
}: {
  id: ArtworkId;
  hero?: boolean;
}) {
  const asset = deliveredAssets[id];
  if (asset) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="items-center justify-center overflow-hidden"
        style={{ aspectRatio: hero ? 1.5 : 1, width: "100%" }}
      >
        <Image
          source={asset}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      </View>
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/50 px-2"
      style={{
        aspectRatio: hero ? 1.5 : 1,
        width: "100%",
        borderCurve: "continuous",
      }}
    >
      <Text
        className={
          hero
            ? "text-center text-sm text-muted-foreground"
            : "text-center text-[10px] leading-3.5 text-muted-foreground"
        }
      >
        {id}
      </Text>
    </View>
  );
}

// Fixed per position, so the pile never reshuffles between renders.
function jitter(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const PILE_ASPECT = 1.25;

/**
 * A mound seen from the front: the first ingredients stand largest in the
 * middle of the front row; each row behind is smaller, narrower and tucked
 * closer to the one before, so the pile thickens toward the back.
 */
function stillLife(count: number) {
  if (count === 1) {
    return { aspectRatio: 1.7, items: [{ left: 18, top: 0, width: 64, rotate: 0 }] };
  }
  // Start large and shrink until the whole pile fits the box.
  for (let front = 46; ; front -= 2) {
    const items: { left: number; top: number; width: number; rotate: number }[] = [];
    let top = 100 - front * PILE_ASPECT;
    for (let row = 0; items.length < count; row++) {
      const width = front * 0.84 ** row;
      const span = 100 - row * 3;
      const step = width * 0.62;
      const capacity = Math.max(1, Math.floor((span - width) / step) + 1);
      const inRow = Math.min(capacity, count - items.length);
      // Fill from the middle outward: centre, right, left, further right…
      const slots = Array.from({ length: inRow }, (_, i) => i - (inRow - 1) / 2)
        .sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
      for (const slot of slots) {
        const index = items.length;
        const size = width * (1 + 0.1 * jitter(index, 1));
        items.push({
          left: 50 - size / 2 + slot * step + step * 0.25 * jitter(index, 2),
          top: top + width * PILE_ASPECT * 0.12 * jitter(index, 3),
          width: size,
          rotate: 8 * jitter(index, 4),
        });
      }
      top -= width * PILE_ASPECT * 0.42;
    }
    if (top + items.at(-1)!.width * PILE_ASPECT * 0.42 >= 0 || front <= 12) {
      return { aspectRatio: PILE_ASPECT, items };
    }
  }
}

/** A loose still life of their kitchen, never padded with unrelated available art. */
export function KitchenArtwork({ profile }: { profile: CookingProfile }) {
  const portrait = kitchenPortrait(profile);
  if (!portrait) return null;
  // Missing art stays absent; the caption still recognises those selections.
  const ids = portrait.artworkIds.filter(hasArtwork);
  const { aspectRatio, items } = stillLife(ids.length);
  return (
    <View className="gap-3">
      {ids.length ? (
        // Bleeds through the screen's 24pt gutters; the caption keeps them.
        <View
          className="-mx-6"
          style={{ aspectRatio }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {/* Drawn back to front, so the first ingredients stand in front. */}
          {ids
            .map((id, index) => ({ id, ...items[index]! }))
            .reverse()
            .map(({ id, left, top, width, rotate }) => (
              <View
                key={id}
                className="absolute"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  transform: [{ rotate: `${rotate}deg` }],
                }}
              >
                <Artwork id={id} />
              </View>
            ))}
        </View>
      ) : null}
      <Text className="text-base leading-6 text-muted-foreground">
        {portrait.caption}
      </Text>
    </View>
  );
}
