import { Redirect, useLocalSearchParams } from "expo-router";
import { ProfileSectionScreen } from "@/features/profile/section-screen";

export default function EditProfileSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  if (section === "shops") return <Redirect href="/household-shops" />;
  if (section === "habits") return <Redirect href="/household-habits" />;
  return <ProfileSectionScreen section={section} />;
}
