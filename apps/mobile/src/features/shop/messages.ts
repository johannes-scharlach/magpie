import { defineMessages } from "react-intl";

/** Short alerts for shopping writes. They say what failed and that the user's
 *  text is safe, without a second sentence where the next step is obvious. */
export const shopMessages = defineMessages({
  saveDetails: {
    defaultMessage: "Couldn’t save details",
    description:
      "Alert title when saving a shopping item's note failed, such as when leaving the entry sheet.",
  },
  addItem: {
    defaultMessage: "Couldn’t add item",
    description: "Alert title when adding an item to the shopping list failed.",
  },
  saveItem: {
    defaultMessage: "Couldn’t save item",
    description:
      "Alert title when renaming a standalone shopping item or saving its note failed.",
  },
  restoreItem: {
    defaultMessage: "Couldn’t restore item",
    description:
      "Alert title when putting a checked-off shopping item back on the list failed.",
  },
  checkOffItem: {
    defaultMessage: "Couldn’t check off item",
    description: "Alert title when marking a shopping item as bought failed.",
  },
  tryAgain: {
    defaultMessage: "Please try again.",
    description:
      "Alert body after an action failed. The user can repeat the action.",
  },
  detailsKept: {
    defaultMessage: "Your details are still here. Please try again.",
    description:
      "Alert body when a shopping item's note could not be saved. Nothing was lost.",
  },
  entryKept: {
    defaultMessage: "Your entry is still here. Please try again.",
    description:
      "Alert body when a shopping item could not be added. The typed text was not cleared.",
  },
});
