import { cuisineLabel, type CookingProfile } from "@magpie/profile";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen";
import {
  addExtra,
  cookCuisine,
  cuisineId,
  removeCuisine,
  setExtras,
  toggleKept,
} from "@/features/profile/cuisines";
import { CupboardFields } from "@/features/profile/cupboard-fields";
import { Field, FormError, FormScreen } from "@/features/profile/form";

export type Cupboards = Pick<CookingProfile, "keeps" | "cuisines">;

/** Every change saves as it happens, so closing never loses a tick. */
export function CupboardScreen({
  profile,
  change,
  error,
  layout,
}: {
  profile: Cupboards;
  /** Applies the edit to the latest saved cupboards and saves the result. */
  change: (edit: (profile: Cupboards) => Cupboards) => void;
  error: string | null;
  /** sheet: its own title and close button. page: the stack header has them. */
  layout: "sheet" | "page" | "onboarding";
}) {
  const params = useLocalSearchParams<{ cuisine?: string }>();
  const router = useRouter();
  // A cuisine of their own gets its id once named.
  const [cuisine, setCuisine] = useState(params.cuisine);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const entry = profile.cuisines.find((c) => c.cuisine === cuisine);

  function saveExtra() {
    if (!cuisine || !extra.trim()) return;
    change((p) => addExtra(p, cuisine, extra));
    setExtra("");
  }

  function finish() {
    if (!cuisine) return;
    change((p) => addExtra(cuisine === "everyday" ? p : cookCuisine(p, cuisine), cuisine, extra));
    router.back();
  }

  function addOwn() {
    if (!name.trim()) {
      setNameError("Name the cuisine.");
      return;
    }
    const id = cuisineId(profile, name);
    change((p) => cookCuisine(p, id));
    setCuisine(id);
  }

  const label = cuisine ? cuisineLabel(cuisine) : "";
  const title = cuisine ? `Your ${label} cupboard` : "A cuisine of your own";
  const subtitle = cuisine
    ? "Pick all that are typically at home"
    : "Name it, then add what you keep for it.";
  const action = !cuisine
    ? { label: "Add cuisine", onPress: addOwn }
    : // Staples are not cooked; nothing needs recording until a tick.
      entry || cuisine === "everyday"
       ? { label: "Done", onPress: finish }
      : {
          label: `I cook ${label}`,
           onPress: finish,
        };
  const fields = (
    <>
      <FormError message={error} />
      {cuisine ? (
        <CupboardFields
          cuisine={cuisine}
          keeps={profile.keeps}
          onToggle={(id) => change((p) => toggleKept(p, cuisine, id))}
          extras={entry?.extras ?? []}
          onExtras={(extras) => change((p) => setExtras(p, cuisine, extras))}
          extra={extra}
          onExtraChange={setExtra}
          onAddExtra={saveExtra}
        />
      ) : (
        <Field
          label="Cuisine"
          placeholder="For example Georgian"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(null);
          }}
          error={nameError}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={addOwn}
        />
      )}
    </>
  );
  const removeButton = entry ? (
    <Button
      variant="ghost"
      onPress={() => {
        change((p) => removeCuisine(p, entry.cuisine));
        router.back();
      }}
    >
      <Text className="text-destructive">I don’t cook this</Text>
    </Button>
  ) : null;

  if (layout === "page") {
    return (
      <FormScreen>
        <Stack.Screen options={{ title }} />
        <Text className="text-muted-foreground">{subtitle}</Text>
        {fields}
        <PrimaryAction label={action.label} onPress={action.onPress} />
        {removeButton}
      </FormScreen>
    );
  }

  if (layout === "sheet") {
    return (
      <ScrollView
        style={{ flex: 1 }}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerClassName="pb-10"
      >
        <View className="flex-row items-start justify-between gap-4 px-6 pt-4">
          <View className="flex-1 gap-1">
            <Text className="text-lg font-semibold">{title}</Text>
            <Text className="text-muted-foreground">{subtitle}</Text>
          </View>
          <CloseButton onPress={() => router.back()} />
        </View>
        <View className="mt-5 gap-4 px-6">
          {fields}
          <PrimaryAction label={action.label} onPress={action.onPress} />
          {removeButton}
        </View>
      </ScrollView>
    );
  }

  return (
    <OnboardingScreen
      action={action}
      onBack={() => router.back()}
      title={title}
      subtitle={subtitle}
    >
      {fields}
      {removeButton}
    </OnboardingScreen>
  );
}
