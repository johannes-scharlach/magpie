import { Host, Switch } from "@expo/ui";
import {
  measurementSystemOptions,
  temperatureOptions,
  type Measurements,
} from "@magpie/profile";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { PickerRow } from "@/features/profile/form";

export function MeasurementsEditor({
  value,
  onChange,
}: {
  value: Measurements;
  onChange: (value: Measurements) => void;
}) {
  const seed = useResolveClassNames("bg-primary").backgroundColor;
  return (
    <View className="gap-6">
      <View
        className="overflow-hidden rounded-xl border border-border bg-card"
        style={{ borderCurve: "continuous" }}
      >
        <PickerRow
          grouped
          label="Measurements"
          choices={Object.values(measurementSystemOptions)}
          selectedValue={measurementSystemOptions[value.system]}
          onValueChange={(label) =>
            onChange({
              ...value,
              system:
                label === measurementSystemOptions.metric ? "metric" : "us",
            })
          }
        />
        <View className="ml-4 border-t border-border" />
        <PickerRow
          grouped
          label="Temperature"
          choices={Object.values(temperatureOptions)}
          selectedValue={temperatureOptions[value.temperature]}
          onValueChange={(label) =>
            onChange({
              ...value,
              temperature:
                label === temperatureOptions.celsius ? "celsius" : "fahrenheit",
            })
          }
        />
      </View>
      <View className="gap-2">
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Automatically convert imported recipes"
          accessibilityState={{ checked: value.convert_imports }}
          onPress={() =>
            onChange({ ...value, convert_imports: !value.convert_imports })
          }
          className="min-h-14 flex-row items-center gap-4 py-2"
        >
          <Text className="flex-1 font-medium">
            Automatically convert imported recipes
          </Text>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Host matchContents ignoreSafeArea="all" seedColor={seed}>
              <Switch value={value.convert_imports} onValueChange={() => {}} />
            </Host>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
