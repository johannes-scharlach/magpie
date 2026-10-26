import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

const PLAY_ICON = { ios: "play.fill", android: "play_arrow" } as const;
const PAUSE_ICON = { ios: "pause.fill", android: "pause" } as const;

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A recording in the transcript: play it back, as any member of the
 *  household can. */
export function VoiceMessage({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const foreground = useResolveClassNames("text-primary-foreground").color;
  const remaining = status.playing
    ? status.duration - status.currentTime
    : status.duration;

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    // Plays with the silent switch on, like a voice message in Messages.
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    });
    if (status.didJustFinish || status.currentTime >= status.duration) {
      await player.seekTo(0);
    }
    player.play();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        status.playing ? "Pause voice message" : "Play voice message"
      }
      onPress={() => void toggle()}
      className="min-w-32 flex-row items-center gap-3 rounded-2xl rounded-br-none bg-primary px-4 py-2.5 active:opacity-80"
    >
      <SymbolView
        name={status.playing ? PAUSE_ICON : PLAY_ICON}
        tintColor={foreground}
        size={20}
      />
      <Text className="text-base text-primary-foreground tabular-nums">
        {status.isLoaded ? formatDuration(remaining) : "…"}
      </Text>
    </Pressable>
  );
}
