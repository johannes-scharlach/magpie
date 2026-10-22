import { Collapsible, RNHostView } from "@expo/ui";
import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { clayTile } from "@/components/clay";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { supabase } from "@/lib/supabase";

import { CollapsibleHost } from "./collapsible-host";
import {
  challengeGoals,
  type ChallengeCounts,
  type ChallengeGoal,
} from "./goals";

const DONE_ICON = {
  ios: "checkmark.circle.fill",
  android: "check_circle",
} as const;
const OPEN_ICON = { ios: "circle", android: "radio_button_unchecked" } as const;

/**
 * Goals, not shortcuts: the real app is where users learn each way in.
 * The server awards a future month of Pro; Done only dismisses its receipt.
 */
export function ChallengeCard() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <AccountChallenge
      key={session.user.id}
      userId={session.user.id}
      previouslyDismissed={Boolean(
        session.user.user_metadata?.first_run_challenge_finished_at,
      )}
    />
  );
}

function AccountChallenge({
  userId,
  previouslyDismissed,
}: {
  userId: string;
  previouslyDismissed: boolean;
}) {
  const counts = useChallengeCounts(userId);
  const { goals, featured, completedCount, complete } = challengeGoals(counts);
  const { data: rewards } = useQuery<{
    earned_at: string;
    dismissed_at: string | null;
  }>("SELECT earned_at, dismissed_at FROM first_run_rewards WHERE id = ?", [
    userId,
  ]);
  const reward = rewards[0];
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = useResolveClassNames("text-link").color;
  const earned = Boolean(reward?.earned_at);

  useEffect(() => {
    if (earned && !reward?.dismissed_at)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [earned, reward?.dismissed_at]);

  if (dismissed || reward?.dismissed_at || (previouslyDismissed && !earned))
    return null;

  async function dismiss() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const { error: failed } = await supabase
      .from("first_run_rewards")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id")
      .single();
    setSaving(false);
    if (failed) setError("Could not save. Try again.");
    else setDismissed(true);
  }

  return (
    <View
      // No clip: the art spills over the top edge.
      className="mx-4 mb-6 mt-10 bg-accent"
      style={clayTile}
    >
      {earned || complete ? (
        <View className="gap-1 px-5 pb-3 pt-4">
          <Text className="font-rounded text-lg font-bold leading-6 text-accent-foreground">
            {earned ? "Your month of Pro is earned" : "Challenge complete"}
          </Text>
          <Text className="text-sm leading-5 text-accent-foreground">
            {earned
              ? "You’ll get it when Pro launches."
              : "Your reward will be saved once your changes sync."}
          </Text>
        </View>
      ) : null}

      {!earned && featured ? (
        <View className="flex-row items-center gap-3 px-5 pt-5">
          <View className="flex-1 gap-2">
            <Text className="font-rounded text-[22px] font-extrabold leading-6.5 text-accent-foreground">
              {featured.invitation}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              {featured.cue}
            </Text>
            {featured.target > 1 ? (
              <Text className="text-sm font-medium text-primary">
                {featured.count} of {featured.target} recipes imported
              </Text>
            ) : null}
          </View>
          {/* Existing food art until the visualization agent delivers the challenge artwork. */}
          <Image
            source={require("../chat/art/optimized/lemon-chicken-potatoes.webp")}
            contentFit="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 150,
              height: 150,
              marginTop: -72,
              marginRight: -28,
            }}
          />
        </View>
      ) : null}

      {!earned && !complete ? (
        <View className="px-5 pb-4 pt-3">
          {/* Match height only: matching width shrinks the header's tap target to its label. */}
          <CollapsibleHost seedColor={link}>
            <Collapsible
              isOpen={expanded}
              onOpenChange={setExpanded}
              label={`${completedCount} of ${goals.length} complete · ${expanded ? "Show less" : "See all challenges"}`}
              labelStyle={{
                color: typeof link === "string" ? link : undefined,
                fontSize: 14,
              }}
            >
              <RNHostView matchContents>
                <View className="gap-4 pt-4">
                  <View className="gap-1">
                    <Text className="text-sm font-medium text-accent-foreground">
                      Finish all five to earn a month of Pro.
                    </Text>
                  </View>
                  {goals.map((goal) => (
                    <TaskRow key={goal.key} goal={goal} />
                  ))}
                </View>
              </RNHostView>
            </Collapsible>
          </CollapsibleHost>
        </View>
      ) : null}

      {earned ? (
        <View className="items-start px-5 pb-5">
          <Button
            onPress={() => void dismiss()}
            disabled={saving}
            className="min-h-11"
          >
            <Text>{saving ? "Saving…" : "Done"}</Text>
          </Button>
          {error ? (
            <Text className="mt-3 text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TaskRow({ goal }: { goal: ChallengeGoal }) {
  const primary = useResolveClassNames("text-accent-foreground").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    <View
      className="flex-row items-center gap-2.5"
      accessible
      accessibilityLabel={`${goal.label}: ${goal.done ? "done" : `${goal.count} of ${goal.target}`}`}
    >
      <SymbolView
        name={goal.done ? DONE_ICON : OPEN_ICON}
        tintColor={goal.done ? primary : muted}
        size={20}
      />
      <Text
        className={`flex-1 text-sm ${goal.done ? "text-muted-foreground" : "text-accent-foreground"}`}
      >
        {goal.label}
      </Text>
      {goal.target > 1 ? (
        <Text className="text-sm text-accent-foreground">
          {goal.count}/{goal.target}
        </Text>
      ) : null}
    </View>
  );
}

/** Recipes and recipe chats you created, across your households. */
function useChallengeCounts(userId: string): ChallengeCounts {
  const { data: origins } = useQuery<{ origin: string; n: number }>(
    "SELECT origin, count(*) AS n FROM recipes WHERE created_by = ? AND origin IS NOT NULL GROUP BY origin",
    [userId],
  );
  const { data: chats } = useQuery<{ n: number }>(
    "SELECT count(*) AS n FROM chats WHERE created_by = ? AND recipe_id IS NOT NULL",
    [userId],
  );
  const count = (origin: string) =>
    origins.find((row) => row.origin === origin)?.n ?? 0;
  return {
    import: count("import"),
    on_hand: count("on_hand"),
    dish: count("dish"),
    idea: count("idea"),
    recipeChats: chats[0]?.n ?? 0,
  };
}
