import type { Href } from "expo-router";

/**
 * Where a tapped household-activity push opens. A meal or a meal reminder
 * opens Meals on its day; `at` makes a second push for the same day select it
 * again. The List opens Shop, a chat reply its chat, an import review the
 * review.
 */
export function notificationRoute(
  data: Record<string, unknown>,
  responseId: string,
): Href {
  if (data.kind === "chat_reply" && typeof data.chatId === "string") {
    return { pathname: "/chats/[id]", params: { id: data.chatId } };
  }
  if (data.kind === "import_review" && typeof data.operationId === "string") {
    return {
      pathname: "/cookbook/review",
      params: { operationId: data.operationId },
    };
  }
  if (data.kind === "items_added" || data.kind === "items_bought") {
    return "/(tabs)/shop";
  }
  if (data.kind !== "member_joined" && typeof data.slotDate === "string") {
    return {
      pathname: "/meals",
      params: { date: data.slotDate, at: responseId },
    };
  }
  return "/household-activity";
}
