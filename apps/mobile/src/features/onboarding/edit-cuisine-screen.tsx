import { Platform } from "react-native";
import { useOnboarding } from "@/features/onboarding/provider";
import { CupboardScreen } from "@/features/profile/cupboard-screen";

export function EditSetupCuisine() {
  const { draft, update, error } = useOnboarding();
  if (!draft) return null;
  return (
    <CupboardScreen
      profile={draft.profile}
      change={(edit) =>
        void update((d) => ({
          ...d,
          profile: { ...d.profile, ...edit(d.profile) },
        })).catch(() => {})
      }
      error={error}
      // Matches setup/_layout.tsx: a sheet on iOS, a full screen on Android.
      layout={Platform.OS === "ios" ? "sheet" : "onboarding"}
    />
  );
}
