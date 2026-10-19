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
import { Artwork, hasArtwork, type ArtworkId } from "@/features/onboarding/artwork";
import { medley } from "@/features/profile/cuisines";

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
  const art = medley(profile, cuisine)
    .map((id) => `ingredient-${id}`)
    .filter(hasArtwork);
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
        {art.length ? (
          <Medley ids={art} />
        ) : (
          // An empty cupboard, still to fill; keeps every label aligned.
          <View
            className="size-14 rounded-2xl border border-dashed border-border"
            style={{ borderCurve: "continuous" }}
          />
        )}
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

// Up to three make the composition: two at the back, one larger in front;
// a lone ingredient takes the front size, so rows match. Any more peek in
// from behind, smaller to sit further back, bleeding off the card's left
// edge and a little into the rows above and below.
const compositions = [
  [{ left: 14, top: 14, width: 72, rotate: 0 }],
  [
    { left: 28, top: 32, width: 72, rotate: 5 },
    { left: 0, top: -4, width: 64, rotate: -6 },
  ],
  [
    { left: 14, top: 40, width: 72, rotate: -3 },
    { left: 0, top: -8, width: 64, rotate: -6 },
    { left: 36, top: -8, width: 64, rotate: 5 },
  ],
];
// The square sits 16pt in from the card edge; a peek is 30pt wide, so a
// left above -55% keeps its centre inside the card.
const peeks = [
  { left: -44, top: -24, width: 54, rotate: 8 },
  { left: -44, top: 64, width: 54, rotate: -7 },
  { left: -50, top: 20, width: 54, rotate: 4 },
];

function Medley({ ids }: { ids: ArtworkId[] }) {
  const shown = ids.slice(0, 3);
  const placed = [
    ...shown.map((id, index) => ({ id, ...compositions[shown.length - 1]![index]! })),
    ...ids.slice(3, 3 + peeks.length).map((id, index) => ({ id, ...peeks[index]! })),
  ];
  return (
    <View className="size-14">
      {/* Drawn back to front: the furthest peek first, the front ingredient last. */}
      {placed.reverse().map(({ id, left, top, width, rotate }) => (
        <View
          key={id}
          className="absolute"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            transform: [{ rotate: `${rotate}deg` }],
          }}
        >
          <Artwork id={id} />
        </View>
      ))}
    </View>
  );
}
