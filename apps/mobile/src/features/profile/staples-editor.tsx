import { cuisineLabel, stapleGroups } from "@magpie/profile";
import { View } from "react-native";
import { SectionTitle } from "@/components/clay";
import { CupboardFields } from "@/features/profile/cupboard-fields";
import {
  type CupboardChange,
  type Cupboards,
} from "@/features/profile/cuisines";

/** One simple pattern first: tick the everyday ingredients you usually keep. */
export function StaplesEditor({
  profile,
  change,
}: {
  profile: Cupboards;
  change: CupboardChange;
}) {
  return (
    <View className="gap-8">
      {stapleGroups.map((group) => (
        <View key={group} className="gap-3">
          <SectionTitle>{cuisineLabel(group)}</SectionTitle>
          <CupboardFields group={group} profile={profile} change={change} />
        </View>
      ))}
    </View>
  );
}
