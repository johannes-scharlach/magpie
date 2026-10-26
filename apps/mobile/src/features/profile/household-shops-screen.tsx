import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, FormScreen } from "@/features/profile/form";
import { ShopsEditor } from "@/features/profile/shops-editor";
import { useHousehold } from "@/features/profile/use-household";

export function HouseholdShopsScreen() {
  const router = useRouter();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId) {
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  }
  return (
    <FormScreen>
      <FormError message={error} />
      <ShopsEditor
        profile={household.profile}
        onSaveNotes={(other_shops) =>
          saveProfileSection(listId, { other_shops })
        }
        onEdit={(index) =>
          router.push({ pathname: "/household-shop", params: { index } })
        }
        onAdd={(name) =>
          router.push({
            pathname: "/household-shop",
            params: name ? { name } : {},
          })
        }
      />
    </FormScreen>
  );
}
