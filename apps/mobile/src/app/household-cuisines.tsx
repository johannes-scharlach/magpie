import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { CuisineList } from "@/features/profile/cuisine-list";
import { FormError } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

export default function HouseholdCuisines() {
  const router = useRouter();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-6 pb-10 pt-4"
    >
      <FormError message={error} />
      {household ? (
        <CuisineList
          profile={household.profile}
          onOpen={(cuisine) =>
            router.push({
              pathname: "/household-cuisine",
              params: cuisine ? { cuisine } : {},
            } as never)
          }
        />
      ) : null}
    </ScrollView>
  );
}
