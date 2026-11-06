import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import {
  font,
  minimumScaleFactor,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { useResolveClassNames } from "uniwind";

import type { ReelProps } from "./reel";

/** iOS: a native wheel. It reports a value only once it comes to rest. */
export function Reel({ label, values, value, onChange }: ReelProps) {
  const primary = useResolveClassNames("text-primary").color;
  return (
    <Host seedColor={primary} style={{ height: 150 }}>
      <Picker
        label={label}
        selection={value}
        onSelectionChange={(next: string) => {
          if (next !== value) onChange(next);
        }}
        modifiers={[pickerStyle("wheel")]}
      >
        {values.map((option) => (
          <Text
            key={option}
            modifiers={[
              tag(option),
              font({
                textStyle: "body",
                design: "rounded",
                weight: "semibold",
              }),
              minimumScaleFactor(0.6),
            ]}
          >
            {option}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
