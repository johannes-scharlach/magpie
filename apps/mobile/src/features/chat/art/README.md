# Quick meal idea artwork

Claymation icons per seeded idea in `../seeded-ideas.json`, mapped by title in
`../seeded-art.ts`. Shown at 56pt on Home (`SeededRow` in `seeded-deck.tsx`),
so each image is a thumbnail first: bold simple silhouettes, recognisable as
small thumbnails over `bg-card`.

## Art style & pipeline

Generated as 3×3 sprite sheet grids (2048×2048 JPEG) on solid neutral mid-grey
`#808080` backgrounds, then sliced and matted into transparent PNGs using
`pnpm assets:slice` (powered by `scripts/slice-spritesheet.mjs` and
`scripts/art-matting.py`).

### Prompt formula

> A 3x3 grid of nine separate small claymation meal idea dish compositions, each centered in its own cell with generous clear space between cells and 15% clear margin inside each cell. Every cell shows one single compact meal idea, same apparent object scale and consistent front three-quarter view across all nine cells. Bold simple silhouettes, recognisable as small thumbnails.
>
> [Cell descriptions in row-major order]
>
> Handcrafted stop-motion claymation art style, soft matte modeling clay with rounded edges, pillowy volume, cute tactile feel. Non-reflective, unglazed matte surface with zero specular highlights or shine. Sauces, egg whites, and toppings are sculpted from solid opaque clay, no wet or oily sheen. Soft diffused ambient lighting with gentle shadows. Solid flat uniform neutral mid-grey background, exact colour #808080, plain and seamless across all cells, no grid lines, no ground plane, no cast shadows on the background. No blue tones in any subject. No text, words, labels, lettering, brand marks, flags, borders, checkmarks, sparkles, or mascot.

### Slicing & optimization commands

1. Slice sprite sheet:
```bash
pnpm assets:slice apps/mobile/src/features/chat/art/spritesheet-ideas-N.jpg \
  --rows 3 --cols 3 \
  --output apps/mobile/src/features/chat/art \
  --ids id1,id2,id3,id4,id5,id6,id7,id8,id9
```

2. Export tiny WebP assets for bundling:
```bash
pnpm assets:optimize
```
(Exports to `apps/mobile/src/features/chat/art/optimized/*.webp`. `../seeded-art.ts` bundles only these WebPs, keeping PNGs as masters.)

## Delivered Sheets

### Sheet 1 (`spritesheet-ideas-1.jpg`)
1. `pork-chops-plums` — Pan-Seared Pork Chops with Jammy Zwetschgen (Plums)
2. `corn-zucchini-feta` — Late-Summer Charred Sweet Corn, Zucchini & Feta Skillet
3. `chanterelles-toast` — Brown-Butter Pfifferlinge (Chanterelles) on Toasted Sourdough
4. `sausage-peppers-potatoes` — Sheet-Pan Roasted Sausage, Sweet Bell Peppers & New Potatoes
5. `tomato-ricotta-pasta` — Jammy Cherry Tomato & Ricotta Pasta
6. `flammkuchen` — Flammkuchen with Schmand, bacon and onions
7. `cacio-e-pepe` — Classic Spaghetti Cacio e Pepe
8. `tortilla-patatas` — Spanish Tortilla de Patatas
9. `amatriciana` — Pasta all’Amatriciana

### Sheet 2 (`spritesheet-ideas-2.jpg`)
1. `white-bean-tuna` — Tuscan White Bean & Tuna Salad
2. `gnocchi-pancetta` — Garlic & Herb Gnocchi with Crispy Pancetta
3. `shakshuka` — North African Shakshuka
4. `bean-quesadillas` — Quesadillas with Refried Black Beans & Roasted Poblanos/Peppers
5. `pork-apples-mustard` — Pan-Seared Pork Chops with Apples & Mustard Cream Sauce
6. `spanakorizo` — Greek Spanakorizo (Spinach & Rice Pilaf)
7. `tofu-peanut-broccoli` — Crispy Tofu with Peanut-Soy Glaze & Steamed Broccoli
8. `trout-potato-hash` — Smoked Trout, Potato & Horseradish Hash
9. `sausage-fennel-traybake` — Roasted Sausage, Fennel & Sweet Potato Traybake

### Sheet 3 (`spritesheet-ideas-3.jpg`)
1. `baked-feta` — Baked Feta with Cherry Tomatoes & Kalamata Olives
2. `sheet-pan-gnocchi` — Crispy Sheet-Pan Gnocchi with Bell Peppers & Mozzarella
3. `lemon-chicken-potatoes` — Lemon-Herb Roasted Chicken Thighs & Baby Potatoes
4. `pork-kimchi` — Korean Stir-Fried Pork Belly with Kimchi (Jaeyuk / Duri-chigi style)
5. `gyudon` — Japanese Gyudon (Beef Rice Bowl)
6. `tomato-egg` — Chinese Tomato & Egg Stir-Fry (Fan Qie Chao Dan)
7. `miso-salmon` — Miso-Butter Salmon & Green Beans
8. `egg-fried-rice` — Egg Fried Rice with Char Siu or Ham
9. `ajvar-pinsa` — Smoky Ajvar & Burrata Pinsa with Prosciutto

### Sheet 4 (`spritesheet-ideas-4.jpg`)
1. `thai-curry-noodles` — Weeknight Red Thai Curry Noodles with Salmon & Sugar Snaps
2. `red-pesto-gnocchi` — Sheet-Pan Red Pesto Gnocchi with Roasted Zucchini & Halloumi
3. `bean-ajvar-merguez` — Silky White Bean & Ajvar Skillet with Crispy Merguez / Salsiccia
4. `lahmacun-flatbreads` — Crispy Hummus & Spiced Lamb/Beef Flatbreads (Lahmacun-Style)
5. `harissa-chicken-couscous` — Harissa & Apricot Glazed Chicken Thighs with Steamed Couscous
6. `corn-kimchi-quesadillas` — Charred Sweet Corn & Kimchi Quesadillas
7. `gochujang-pork-cucumber` — Gochujang & Honey Glazed Pork Belly with Cucumber Sesame Crunch
8. `nasu-dengaku` — Miso-Glazed Roasted Aubergine (Nasu Dengaku) with Steamed Rice
9. `creamy-tuscan-chicken` — (Bonus 9th cell) Creamy Tuscan Chicken
