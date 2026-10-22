import { Host } from "@expo/ui";
import type { ComponentProps } from "react";

export function CollapsibleHost(
  props: Pick<ComponentProps<typeof Host>, "children" | "seedColor">,
) {
  return <Host {...props} matchContents={{ vertical: true }} />;
}
