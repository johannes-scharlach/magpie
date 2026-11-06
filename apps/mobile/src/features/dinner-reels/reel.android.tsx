import { MenuPicker } from "@/components/ui/menu-picker";

import type { ReelProps } from "./reel";

/** Android: Material has no wheel, so the reel's order shows as a menu. */
export function Reel({ label, values, value, onChange }: ReelProps) {
  return (
    <MenuPicker
      label={label}
      choices={values}
      selectedValue={value}
      onValueChange={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  );
}
