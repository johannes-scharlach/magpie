import { Host } from "@expo/ui";
import { Slider } from "@expo/ui/jetpack-compose";
import { portionReferenceRange } from "@magpie/profile";
import type { PortionSliderProps } from "./portion-slider";

export function PortionSlider({
  value,
  onValueChange,
  activeColor,
  inactiveColor,
}: PortionSliderProps) {
  return (
    <Host
      matchContents={{ vertical: true }}
      style={{ width: "100%", height: 32 }}
    >
      <Slider
        min={portionReferenceRange.min}
        max={portionReferenceRange.max}
        steps={
          Math.round(
            (portionReferenceRange.max - portionReferenceRange.min) /
              portionReferenceRange.step,
          ) - 1
        }
        value={value}
        onValueChange={onValueChange}
        colors={{
          activeTrackColor: activeColor,
          inactiveTrackColor: inactiveColor,
          thumbColor: activeColor,
          // Keep native snapping without drawing a dot for every 0.05 step.
          activeTickColor: "transparent",
          inactiveTickColor: "transparent",
        }}
      />
    </Host>
  );
}
