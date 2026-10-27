import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { AvoidancesEditor } from "@/features/profile/avoidances-editor";
import { FormError, FormScreen } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

export function HouseholdAvoidancesScreen() {
  const router = useRouter();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  return (
    <FormScreen>
      <FormError message={error} />
      {household && listId ? (
        <AvoidancesEditor
          value={household.profile.ingredient_avoidances}
          people={household.people}
          notes={household.profile.restrictions}
          onSaveNotes={(restrictions) =>
            saveProfileSection(listId, { restrictions })
          }
          onEdit={(index) =>
            router.push({ pathname: "/household-avoidance", params: { index } })
          }
          onAdd={(ingredient, kind) =>
            router.push({
              pathname: "/household-avoidance",
              params: {
                ...(ingredient ? { ingredient } : {}),
                ...(kind ? { kind } : {}),
              },
            })
          }
        />
      ) : (
        <Text>Loading…</Text>
      )}
    </FormScreen>
  );
}
