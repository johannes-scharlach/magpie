/** What sits at the end of the composer. Like a messenger, the microphone
 *  holds Send's place until there is something to send, and a recording in
 *  progress counts. A screen's own idle action, like the recipe's Cook,
 *  keeps that place until the field is focused. */
export function composerTrailing({
  text,
  attachmentCount,
  focused,
  hasEmptyAction,
  recording,
}: {
  text: string;
  attachmentCount: number;
  focused: boolean;
  hasEmptyAction: boolean;
  recording: boolean;
}): "send" | "mic" | "emptyAction" {
  if (recording || text.trim() || attachmentCount) return "send";
  return hasEmptyAction && !focused ? "emptyAction" : "mic";
}
