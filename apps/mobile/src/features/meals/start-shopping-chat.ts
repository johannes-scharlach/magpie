import * as Crypto from "expo-crypto";
import { router } from "expo-router";

import type { PlannedMeal } from "@/db/schema";
import { queueMessage } from "@/features/chat/message-queue";
import { slotWhen } from "./slots";

export function startShoppingChat(
  meal: Pick<PlannedMeal, "id" | "list_id" | "name" | "slot_date" | "meal">,
) {
  if (!meal.list_id) return;
  const chatId = Crypto.randomUUID();
  queueMessage({
    chatId,
    listId: meal.list_id,
    mealContext: { plannedMealId: meal.id },
    messageId: Crypto.randomUUID(),
    text: `Help me choose what to buy for ${meal.name} (${slotWhen(meal.slot_date, meal.meal)}).`,
    attachments: [],
  });
  router.push({ pathname: "/chats/[id]", params: { id: chatId } });
}
