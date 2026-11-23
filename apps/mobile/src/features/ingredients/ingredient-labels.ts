import {
  defineMessages,
  type IntlShape,
  type MessageDescriptor,
} from "react-intl";
import { ingredientNameKey } from "@magpie/profile";

// Standalone food names are shared only where we present picker selections.
// Unknown household and recipe labels stay exactly as entered.
const ingredientMessages: Record<string, MessageDescriptor> = defineMessages({
  rice: {
    defaultMessage: "Rice",
    description:
      "Default ingredient tile for rice in the use-what-I-have picker.",
  },
  potatoes: {
    defaultMessage: "Potatoes",
    description:
      "Default ingredient tile for potatoes in the use-what-I-have picker.",
  },
  pasta: {
    defaultMessage: "Pasta",
    description:
      "Default ingredient tile for pasta in the use-what-I-have picker.",
  },
  cabbage: {
    defaultMessage: "Cabbage",
    description:
      "Ingredient label for a head of cabbage, not kale or Napa cabbage.",
  },
  eggplant: {
    defaultMessage: "Eggplant",
    description: "Ingredient label for eggplant, also known as aubergine.",
  },
  kale: {
    defaultMessage: "Kale",
    description: "Ingredient label for kale, not a head of cabbage.",
  },
  "chinese-cabbage": {
    defaultMessage: "Chinese cabbage",
    description:
      "Ingredient label for Napa cabbage, distinct from a regular head of cabbage.",
  },
  "tomato-paste": {
    defaultMessage: "Tomato paste",
    description:
      "Ingredient label for concentrated tomato paste, not canned tomatoes.",
  },
  "canned-tomatoes": {
    defaultMessage: "Canned tomatoes",
    description:
      "Ingredient label for tomatoes from a tin or can, not concentrated paste.",
  },
  "canned-beans": {
    defaultMessage: "Canned beans",
    description: "Ingredient label for beans from a tin or can.",
  },
  "canned-tuna": {
    defaultMessage: "Tinned tuna",
    description: "Ingredient label for tuna from a tin or can.",
  },
  sweetcorn: {
    defaultMessage: "Sweetcorn",
    description: "Ingredient label for sweet corn kernels.",
  },
  "canned-corn": {
    defaultMessage: "Canned sweetcorn",
    description: "Ingredient label for sweet corn kernels from a tin or can.",
  },
  chickpeas: {
    defaultMessage: "Chickpeas",
    description:
      "Ingredient label for chickpeas, also known as garbanzo beans.",
  },
  lentils: {
    defaultMessage: "Lentils",
    description: "Ingredient label for lentils of any kind.",
  },
  "red-lentils": {
    defaultMessage: "Red lentils",
    description: "Ingredient label for red lentils.",
  },
  "olive-oil": {
    defaultMessage: "Olive oil",
    description: "Ingredient label for olive oil.",
  },
  "soy-sauce": {
    defaultMessage: "Soy sauce",
    description: "Ingredient label for soy sauce.",
  },
  vinegar: {
    defaultMessage: "Vinegar",
    description: "Ingredient label for vinegar of any kind.",
  },
  "peanut-butter": {
    defaultMessage: "Peanut butter",
    description: "Ingredient label for peanut butter.",
  },
  oats: {
    defaultMessage: "Oats",
    description: "Ingredient label for oats used in cooking.",
  },
  flour: {
    defaultMessage: "Flour",
    description: "Ingredient label for ordinary flour.",
  },
  "coconut-milk": {
    defaultMessage: "Coconut milk",
    description: "Ingredient label for coconut milk.",
  },
  honey: {
    defaultMessage: "Honey",
    description: "Ingredient label for honey.",
  },
  sugar: {
    defaultMessage: "Sugar",
    description: "Ingredient label for ordinary sugar.",
  },
  "stock-broth": {
    defaultMessage: "Stock & broth",
    description: "Ingredient label for cooking stock or broth.",
  },
  "spices-herbs": {
    defaultMessage: "Spices & herbs",
    description:
      "Ingredient label for the household's general stock of seasonings.",
  },
  eggs: { defaultMessage: "Eggs", description: "Ingredient label for eggs." },
  milk: { defaultMessage: "Milk", description: "Ingredient label for milk." },
  butter: {
    defaultMessage: "Butter",
    description: "Ingredient label for butter.",
  },
  cheese: {
    defaultMessage: "Cheese",
    description: "Ingredient label for cheese of any kind.",
  },
  "greek-yoghurt": {
    defaultMessage: "Greek yoghurt",
    description: "Ingredient label for thick Greek yoghurt.",
  },
  "plain-yoghurt": {
    defaultMessage: "Plain yoghurt",
    description: "Ingredient label for unflavored plain yoghurt.",
  },
  cream: {
    defaultMessage: "Cream",
    description: "Ingredient label for liquid dairy cream.",
  },
  "sour-cream": {
    defaultMessage: "Sour cream",
    description: "Ingredient label for cultured dairy sour cream.",
  },
  onions: {
    defaultMessage: "Onions",
    description: "Ingredient label for onions.",
  },
  garlic: {
    defaultMessage: "Garlic",
    description: "Ingredient label for garlic.",
  },
  carrots: {
    defaultMessage: "Carrots",
    description: "Ingredient label for carrots.",
  },
  tomatoes: {
    defaultMessage: "Tomatoes",
    description: "Ingredient label for fresh tomatoes, not canned tomatoes.",
  },
  lemons: {
    defaultMessage: "Lemons",
    description: "Ingredient label for fresh lemons.",
  },
  broccoli: {
    defaultMessage: "Broccoli",
    description: "Ingredient label for broccoli.",
  },
  spinach: {
    defaultMessage: "Spinach",
    description: "Ingredient label for fresh spinach, not frozen spinach.",
  },
  "bell-peppers": {
    defaultMessage: "Bell peppers",
    description: "Ingredient label for sweet bell peppers, not hot chiles.",
  },
  mushrooms: {
    defaultMessage: "Mushrooms",
    description: "Ingredient label for mushrooms of any kind.",
  },
  apples: {
    defaultMessage: "Apples",
    description: "Ingredient label for apples.",
  },
  "maple-syrup": {
    defaultMessage: "Maple syrup",
    description: "Ingredient label for maple syrup.",
  },
  "puff-pastry": {
    defaultMessage: "Puff pastry",
    description: "Ingredient label for puff pastry dough.",
  },
  bacon: {
    defaultMessage: "Bacon",
    description: "Ingredient label for bacon.",
  },
  limes: {
    defaultMessage: "Limes",
    description: "Ingredient label for fresh limes.",
  },
  "basmati-rice": {
    defaultMessage: "Basmati rice",
    description: "Ingredient label for basmati rice, not generic rice.",
  },
  "jasmine-rice": {
    defaultMessage: "Jasmine rice",
    description: "Ingredient label for jasmine rice, not generic rice.",
  },
  "egg-noodles": {
    defaultMessage: "Egg noodles",
    description: "Ingredient label for noodles made with egg.",
  },
  noodles: {
    defaultMessage: "Noodles",
    description: "Ingredient label for noodles without a specific variety.",
  },
  "sesame-oil": {
    defaultMessage: "Sesame oil",
    description: "Ingredient label for sesame oil.",
  },
  "toasted-sesame-seeds": {
    defaultMessage: "Toasted sesame seeds",
    description: "Ingredient label for toasted, not raw, sesame seeds.",
  },
  "rice-vinegar": {
    defaultMessage: "Rice vinegar",
    description: "Ingredient label for rice vinegar.",
  },
  "fish-sauce": {
    defaultMessage: "Fish sauce",
    description: "Ingredient label for fish sauce.",
  },
  "oyster-sauce": {
    defaultMessage: "Oyster sauce",
    description: "Ingredient label for oyster sauce.",
  },
  "hoisin-sauce": {
    defaultMessage: "Hoisin sauce",
    description: "Ingredient label for hoisin sauce.",
  },
  "coconut-oil": {
    defaultMessage: "Coconut oil",
    description: "Ingredient label for coconut oil.",
  },
  lemongrass: {
    defaultMessage: "Lemongrass",
    description: "Ingredient label for lemongrass.",
  },
  "palm-sugar": {
    defaultMessage: "Palm sugar",
    description: "Ingredient label for palm sugar.",
  },
  "curry-leaves": {
    defaultMessage: "Curry leaves",
    description: "Ingredient label for curry leaves, not curry powder.",
  },
  "star-anise": {
    defaultMessage: "Star anise",
    description: "Ingredient label for star anise.",
  },
  "smoked-paprika": {
    defaultMessage: "Smoked paprika",
    description: "Ingredient label for smoked paprika powder.",
  },
  saffron: {
    defaultMessage: "Saffron",
    description: "Ingredient label for saffron.",
  },
  "dried-mint": {
    defaultMessage: "Dried mint",
    description: "Ingredient label for dried mint.",
  },
  cardamom: {
    defaultMessage: "Cardamom",
    description: "Ingredient label for cardamom.",
  },
  horseradish: {
    defaultMessage: "Horseradish",
    description: "Ingredient label for horseradish.",
  },
  "black-beans": {
    defaultMessage: "Black beans",
    description: "Ingredient label for black beans.",
  },
  anchovies: {
    defaultMessage: "Anchovies",
    description: "Ingredient label for anchovies.",
  },
  capers: {
    defaultMessage: "Capers",
    description: "Ingredient label for capers.",
  },
  "dried-porcini": {
    defaultMessage: "Dried porcini",
    description: "Ingredient label for dried porcini mushrooms.",
  },
  "balsamic-vinegar": {
    defaultMessage: "Balsamic vinegar",
    description: "Ingredient label for balsamic vinegar.",
  },
  "risotto-rice": {
    defaultMessage: "Risotto rice",
    description: "Ingredient label for rice intended for risotto.",
  },
  shallots: {
    defaultMessage: "Shallots",
    description: "Ingredient label for shallots.",
  },
  "dijon-mustard": {
    defaultMessage: "Dijon mustard",
    description: "Ingredient label for Dijon mustard.",
  },
  "sherry-vinegar": {
    defaultMessage: "Sherry vinegar",
    description: "Ingredient label for sherry vinegar.",
  },
  "paella-rice": {
    defaultMessage: "Paella rice",
    description: "Ingredient label for rice intended for paella.",
  },
  "kalamata-olives": {
    defaultMessage: "Kalamata olives",
    description: "Ingredient label for Kalamata olives.",
  },
  "vine-leaves": {
    defaultMessage: "Vine leaves",
    description: "Ingredient label for grapevine leaves used in cooking.",
  },
  "juniper-berries": {
    defaultMessage: "Juniper berries",
    description: "Ingredient label for juniper berries.",
  },
  "caraway-seeds": {
    defaultMessage: "Caraway seeds",
    description: "Ingredient label for caraway seed, not cumin.",
  },
  "dried-marjoram": {
    defaultMessage: "Dried marjoram",
    description: "Ingredient label for dried marjoram.",
  },
  "rye-flour": {
    defaultMessage: "Rye flour",
    description: "Ingredient label for rye flour.",
  },
  buckwheat: {
    defaultMessage: "Buckwheat",
    description: "Ingredient label for buckwheat.",
  },
  beetroot: {
    defaultMessage: "Beetroot",
    description: "Ingredient label for beetroot.",
  },
  "pickled-cucumbers": {
    defaultMessage: "Pickled cucumbers",
    description: "Ingredient label for pickled cucumbers.",
  },
  "dried-limes": {
    defaultMessage: "Dried limes",
    description: "Ingredient label for whole dried limes used as a seasoning.",
  },
  "rose-water": {
    defaultMessage: "Rose water",
    description: "Ingredient label for culinary rose water.",
  },
  "preserved-lemons": {
    defaultMessage: "Preserved lemons",
    description:
      "Ingredient label for salt-preserved lemons, not fresh lemons.",
  },
  "orange-blossom-water": {
    defaultMessage: "Orange blossom water",
    description: "Ingredient label for culinary orange blossom water.",
  },
  "argan-oil": {
    defaultMessage: "Argan oil",
    description: "Ingredient label for edible argan oil.",
  },
  "teff-flour": {
    defaultMessage: "Teff flour",
    description: "Ingredient label for teff flour.",
  },
  "cumin-seeds": {
    defaultMessage: "Cumin seeds",
    description: "Ingredient label for cumin seed, not caraway.",
  },
  "mustard-seeds": {
    defaultMessage: "Mustard seeds",
    description: "Ingredient label for mustard seeds.",
  },
  "desiccated-coconut": {
    defaultMessage: "Desiccated coconut",
    description: "Ingredient label for grated dried coconut.",
  },
  "ceylon-cinnamon": {
    defaultMessage: "Ceylon cinnamon",
    description: "Ingredient label for Ceylon cinnamon.",
  },
  "sichuan-peppercorns": {
    defaultMessage: "Sichuan peppercorns",
    description: "Ingredient label for Sichuan peppercorns, not black pepper.",
  },
  "dried-red-chillies": {
    defaultMessage: "Dried red chillies",
    description: "Ingredient label for dried red chillies.",
  },
  "dark-soy-sauce": {
    defaultMessage: "Dark soy sauce",
    description: "Ingredient label for dark soy sauce, not generic soy sauce.",
  },
  "dried-shiitake": {
    defaultMessage: "Dried shiitake",
    description: "Ingredient label for dried shiitake mushrooms.",
  },
  "white-pepper": {
    defaultMessage: "White pepper",
    description: "Ingredient label for white pepper.",
  },
  "glass-noodles": {
    defaultMessage: "Glass noodles",
    description: "Ingredient label for translucent starch noodles.",
  },
  "flat-rice-noodles": {
    defaultMessage: "Flat rice noodles",
    description: "Ingredient label for flat noodles made from rice.",
  },
  "japanese-short-grain-rice": {
    defaultMessage: "Japanese short-grain rice",
    description: "Ingredient label for Japanese short-grain rice.",
  },
  "thai-curry-paste": {
    defaultMessage: "Thai curry paste",
    description: "Ingredient label for Thai curry paste.",
  },
  "rice-paper": {
    defaultMessage: "Rice paper",
    description: "Ingredient label for edible rice paper wrappers.",
  },
  "rice-vermicelli": {
    defaultMessage: "Rice vermicelli",
    description: "Ingredient label for thin rice vermicelli noodles.",
  },
  "corn-tortillas": {
    defaultMessage: "Corn tortillas",
    description: "Ingredient label for tortillas made with corn, not wheat.",
  },
  "mexican-oregano": {
    defaultMessage: "Mexican oregano",
    description: "Ingredient label for Mexican oregano.",
  },
  "purple-corn": {
    defaultMessage: "Purple corn",
    description: "Ingredient label for purple corn.",
  },
  "guava-paste": {
    defaultMessage: "Guava paste",
    description: "Ingredient label for guava paste.",
  },
  allspice: {
    defaultMessage: "Allspice",
    description:
      "Ingredient label for the single spice also called pimento, not a spice blend.",
  },
  cornmeal: {
    defaultMessage: "Cornmeal",
    description: "Ingredient label for ground dried corn.",
  },
  buttermilk: {
    defaultMessage: "Buttermilk",
    description: "Ingredient label for buttermilk.",
  },
  molasses: {
    defaultMessage: "Molasses",
    description: "Ingredient label for molasses.",
  },
  "apple-cider-vinegar": {
    defaultMessage: "Apple cider vinegar",
    description: "Ingredient label for apple cider vinegar.",
  },
  cayenne: {
    defaultMessage: "Cayenne",
    description: "Ingredient label for ground cayenne pepper.",
  },
  leeks: {
    defaultMessage: "Leeks",
    description: "Ingredient label for leeks, not onions.",
  },
  "frozen-peas": {
    defaultMessage: "Frozen peas",
    description: "Ingredient label for peas kept in the freezer.",
  },
  "frozen-green-beans": {
    defaultMessage: "Frozen green beans",
    description: "Ingredient label for green beans kept in the freezer.",
  },
  "frozen-spinach": {
    defaultMessage: "Frozen spinach",
    description:
      "Ingredient label for spinach kept in the freezer, not fresh spinach.",
  },
  "frozen-prawns": {
    defaultMessage: "Frozen prawns",
    description: "Ingredient label for prawns kept in the freezer.",
  },
  "frozen-minced-meat": {
    defaultMessage: "Frozen minced meat",
    description: "Ingredient label for ground meat kept in the freezer.",
  },
  "frozen-chicken-breast": {
    defaultMessage: "Frozen chicken breast",
    description: "Ingredient label for chicken breast kept in the freezer.",
  },
  "frozen-salmon-fillets": {
    defaultMessage: "Frozen salmon fillets",
    description: "Ingredient label for salmon fillets kept in the freezer.",
  },
  "frozen-cod-fillets": {
    defaultMessage: "Frozen cod fillets",
    description: "Ingredient label for cod fillets kept in the freezer.",
  },
});

export function formatPickerIngredient(intl: IntlShape, label: string): string {
  const key = ingredientNameKey(label);
  return Object.hasOwn(ingredientMessages, key)
    ? intl.formatMessage(ingredientMessages[key]!)
    : label;
}
