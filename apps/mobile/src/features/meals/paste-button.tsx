import * as Clipboard from "expo-clipboard";
import { useResolveClassNames } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

function color(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

/** iOS 16+ gets the system paste control: one tap and no "Allow Paste?"
 *  prompt, at the price of a fixed "Paste" label. Android reads the
 *  clipboard without a prompt, so an ordinary button does the same. */
export function PasteButton({
  onPaste,
  disabled = false,
}: {
  onPaste: (text: string) => void;
  disabled?: boolean;
}) {
  const primary = color(useResolveClassNames("bg-primary").backgroundColor);
  const onPrimary = color(
    useResolveClassNames("text-primary-foreground").color,
  );

  if (Clipboard.isPasteButtonAvailable) {
    return (
      <Clipboard.ClipboardPasteButton
        acceptedContentTypes={["plain-text", "url"]}
        backgroundColor={primary}
        foregroundColor={onPrimary}
        cornerStyle="capsule"
        displayMode="iconAndLabel"
        style={{ width: 100, height: 40, opacity: disabled ? 0.4 : 1 }}
        pointerEvents={disabled ? "none" : "auto"}
        onPress={(data) => {
          if (data.type === "text") onPaste(data.text);
        }}
      />
    );
  }
  return (
    <Button
      size="sm"
      className="rounded-full"
      disabled={disabled}
      onPress={async () => onPaste(await Clipboard.getStringAsync())}
    >
      <Text>Paste</Text>
    </Button>
  );
}
