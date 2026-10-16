import {
  cuisineLabel,
  cuisineOptions,
  cuisineRegions,
  keptLabels,
  type CookingProfile,
} from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { AddRow } from "@/components/add-row";
import { Text } from "@/components/ui/text";

type Cupboards = Pick<CookingProfile, "keeps" | "cuisines">;

/** Every cuisine opens its cupboard; a check marks the ones they cook. */
export function CuisineList({
  profile,
  onOpen,
}: {
  profile: Cupboards;
  /** No cuisine: a cuisine of their own. */
  onOpen: (cuisine?: string) => void;
}) {
  const own = profile.cuisines.filter((c) => !(c.cuisine in cuisineOptions));
  return (
    <View className="gap-6">
      {cuisineRegions.map(({ region, cuisines }) => (
        <Section key={region} title={region}>
          {Object.keys(cuisines).map((cuisine, index) => (
            <CuisineRow
              key={cuisine}
              cuisine={cuisine}
              profile={profile}
              first={index === 0}
              onPress={() => onOpen(cuisine)}
            />
          ))}
        </Section>
      ))}
      <Section title="Your own">
        {own.map(({ cuisine }, index) => (
          <CuisineRow
            key={cuisine}
            cuisine={cuisine}
            profile={profile}
            first={index === 0}
            onPress={() => onOpen(cuisine)}
          />
        ))}
        <AddRow
          label="Add another cuisine"
          bordered={own.length > 0}
          onPress={() => onOpen()}
        />
      </Section>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className="px-1 text-sm font-medium text-muted-foreground"
      >
        {title}
      </Text>
      <View
        className="overflow-hidden rounded-xl border border-border bg-card"
        style={{ borderCurve: "continuous" }}
      >
        {children}
      </View>
    </View>
  );
}

function CuisineRow({
  cuisine,
  profile,
  first,
  onPress,
}: {
  cuisine: string;
  profile: Cupboards;
  first: boolean;
  onPress: () => void;
}) {
  const primary = useResolveClassNames("text-primary").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const entry = profile.cuisines.find((c) => c.cuisine === cuisine);
  const label = cuisineLabel(cuisine);
  const kept = entry ? keptLabels(profile, entry).join(", ") : "";
  return (
    <View>
      {first ? null : <View className="ios:ml-4 border-t border-border" />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={entry ? `${label}, you cook this` : label}
        accessibilityHint={kept || undefined}
        className="min-h-14 flex-row items-center gap-4 px-4 py-3 active:bg-accent"
        onPress={onPress}
      >
        <View className="flex-1 gap-0.5">
          <Text className="font-medium">{label}</Text>
          {kept ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {kept}
            </Text>
          ) : null}
        </View>
        <SymbolView
          name={
            entry
              ? { ios: "checkmark.circle.fill", android: "check_circle" }
              : { ios: "chevron.right", android: "chevron_right" }
          }
          size={entry ? 21 : 14}
          tintColor={entry ? primary : muted}
        />
      </Pressable>
    </View>
  );
}
