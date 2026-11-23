import { defineMessage } from "react-intl";

/** The way into the import sheet, shared by the cookbook's add button and its
 *  empty state. */
export const importRecipeAction = defineMessage({
  defaultMessage: "Import recipe",
  description:
    "Action that opens the recipe import sheet, where recipes come in from a link, pasted text, photos or a recording.",
});
