import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";
import { Text } from "@/components/ui/text";
import type { ImageAttachment } from "@/features/chat/image-attachment";
import {
  recordingAttachment,
  useVoiceRecording,
} from "@/features/chat/use-voice-recording";
import { formatDuration } from "@/features/chat/voice-message";

const MIC_ICON = { ios: "mic.fill", android: "mic" } as const;
const STOP_ICON = { ios: "stop.fill", android: "stop" } as const;

/** Tap to record, tap to stop, then send or record again. */
export function VoiceRecorder({
  onSend,
}: {
  onSend: (recording: ImageAttachment) => void;
}) {
  const { active, elapsed, recording, start, stop } = useVoiceRecording();
  const foreground = useResolveClassNames("text-primary-foreground").color;

  return (
    <>
      <View className="mt-4 items-center gap-4 px-6">
        <Text variant="muted" className="text-center">
          Say what you remember: what goes in, roughly how much, and how you
          cook it. Magpie writes it down and checks the gaps with you.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={active ? "Stop recording" : "Record"}
          onPress={() => void (active ? stop() : start())}
          className="mt-2 size-20 items-center justify-center rounded-full bg-primary active:opacity-80"
        >
          <SymbolView
            name={active ? STOP_ICON : MIC_ICON}
            tintColor={foreground}
            size={32}
          />
        </Pressable>
        <Text className="font-medium tabular-nums">
          {active
            ? formatDuration(elapsed)
            : recording
              ? `${formatDuration(recording.seconds)} recorded. Tap to record again.`
              : "Tap to start. Up to 5 minutes."}
        </Text>
      </View>
      <SheetActions>
        <PrimaryAction
          label="Send to Magpie"
          disabled={active || !recording}
          onPress={() => {
            if (recording) onSend(recordingAttachment(recording));
          }}
        />
      </SheetActions>
    </>
  );
}
