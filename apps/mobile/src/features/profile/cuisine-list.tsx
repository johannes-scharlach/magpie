import {
  cuisineLabel,
  cuisineOptions,
  cuisineRegions,
  keptLabels,
  type CookingProfile,
} from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { AddRow } from "@/components/add-row";
import { clayTile, PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { Artwork, hasArtwork, type ArtworkId } from "@/features/onboarding/artwork";
import { medley } from "@/features/profile/cuisines";
import { cn } from "@/lib/utils";

type Cupboards = Pick<CookingProfile, "keeps" | "cuisines">;

/** Every cuisine opens its cupboard; a warm surface marks the ones they cook. */
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
          {Object.keys(cuisines).map((cuisine) => (
            <CuisineRow
              key={cuisine}
              cuisine={cuisine}
              profile={profile}
              onPress={() => onOpen(cuisine)}
            />
          ))}
        </Section>
      ))}
      <Section title="Your own">
        {own.map(({ cuisine }) => (
          <CuisineRow
            key={cuisine}
            cuisine={cuisine}
            profile={profile}
            onPress={() => onOpen(cuisine)}
          />
        ))}
        <View className="bg-card" style={clayTile}>
          <AddRow
            label="Add another cuisine"
            bordered={false}
            onPress={() => onOpen()}
          />
        </View>
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
      <View className="gap-3">{children}</View>
    </View>
  );
}

function CuisineRow({
  cuisine,
  profile,
  onPress,
}: {
  cuisine: string;
  profile: Cupboards;
  onPress: () => void;
}) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const entry = profile.cuisines.find((c) => c.cuisine === cuisine);
  const label = cuisineLabel(cuisine);
  const kept = entry ? keptLabels(profile, entry).join(", ") : "";
  const art = medley(profile, cuisine)
    .map((id) => `ingredient-${id}`)
    .filter(hasArtwork);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={entry ? `${label}, you cook this` : label}
      accessibilityHint={kept || undefined}
      onPress={onPress}
    >
      <View
        className={cn(
          "min-h-16 flex-row items-center gap-4 px-4 py-3",
          entry ? "bg-accent" : "bg-card",
        )}
        style={clayTile}
      >
        <View className="flex-1 gap-0.5">
          <Text
            className={cn(
              "font-rounded font-semibold",
              entry && "text-primary",
            )}
          >
            {label}
          </Text>
          {entry ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {kept || "You cook this"}
            </Text>
          ) : null}
        </View>
        {art.length ? <Medley ids={art} /> : null}
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right" }}
          size={14}
          tintColor={muted}
        />
      </View>
    </PressableScale>
  );
}

/** Three readable objects, lightly overlapping; the artwork supplies the character. */
function Medley({ ids }: { ids: ArtworkId[] }) {
  const shown = ids.slice(0, 3);
  return (
    <View
      pointerEvents="none"
      className="h-14 flex-row items-end"
      style={{
        width: 48 * shown.length - 12 * (shown.length - 1),
        maxWidth: "40%",
      }}
    >
      {shown.map((id, index) => (
        <View
          key={id}
          className="flex-1"
          style={{ marginLeft: index === 0 ? 0 : -12 }}
        >
          <Artwork id={id} />
        </View>
      ))}
    </View>
  );
}
