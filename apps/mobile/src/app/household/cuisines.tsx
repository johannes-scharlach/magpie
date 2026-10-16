import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
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
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 text-lg font-semibold">Cuisines</Text>
        <CloseButton onPress={() => router.back()} />
      </View>
      <FormError message={error} />
      {household ? (
        <CuisineList
          profile={household.profile}
          onOpen={(cuisine) =>
            router.push({
              pathname: "/household/cuisine",
              params: cuisine ? { cuisine } : {},
            } as never)
          }
        />
      ) : null}
    </ScrollView>
  );
}
