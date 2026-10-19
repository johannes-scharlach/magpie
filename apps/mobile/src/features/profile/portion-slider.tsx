import { Slider } from "@expo/ui/community/slider";
import { portionReferenceRange } from "@magpie/profile";
import type { ColorValue } from "react-native";

export type PortionSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  activeColor?: ColorValue;
  inactiveColor?: ColorValue;
};

export function PortionSlider({
  value,
  onValueChange,
  activeColor,
  inactiveColor,
}: PortionSliderProps) {
  return (
    <Slider
      minimumValue={portionReferenceRange.min}
      maximumValue={portionReferenceRange.max}
      step={portionReferenceRange.step}
      value={value}
      onValueChange={onValueChange}
      minimumTrackTintColor={activeColor}
      maximumTrackTintColor={inactiveColor}
      style={{ width: "100%", height: 32 }}
    />
  );
}
