import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { PrimaryAction } from "@/components/action";
import { SheetActions } from "@/components/sheet-actions";
import { Text } from "@/components/ui/text";
import type { ImageAttachment } from "@/features/chat/image-attachment";
import { formatDuration } from "@/features/chat/voice-message";

const MAX_SECONDS = 5 * 60;
// Speech, not music: mono at 64 kbps is about half a megabyte a minute.
const SPEECH = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};
const MIC_ICON = { ios: "mic.fill", android: "mic" } as const;
const STOP_ICON = { ios: "stop.fill", android: "stop" } as const;

type Recording = { uri: string; seconds: number };

/** Tap to record, tap to stop, then send or record again. The recording
 *  stops itself at five minutes. */
export function VoiceRecorder({
  onSend,
}: {
  onSend: (recording: ImageAttachment) => void;
}) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [active, setActive] = useState(false);
  // The time limit stops the recorder on its own and reports it here.
  const recorder = useAudioRecorder(SPEECH, (status) => {
    if (status.isFinished && status.url) {
      setActive(false);
      setRecording(
        (current) => current ?? { uri: status.url!, seconds: MAX_SECONDS },
      );
    }
  });
  const state = useAudioRecorderState(recorder, 250);
  const foreground = useResolveClassNames("text-primary-foreground").color;
  const elapsed = state.durationMillis / 1000;

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Microphone access needed",
        "Allow microphone access in Settings to tell Magpie a recipe.",
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SECONDS });
    setRecording(null);
    setActive(true);
  }

  async function finish() {
    const seconds = elapsed;
    setActive(false);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    // The listener may already have reported the stop, without the length.
    if (recorder.uri) setRecording({ uri: recorder.uri, seconds });
  }

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
          onPress={() => void (active ? finish() : start())}
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
            if (recording)
              onSend({ uri: recording.uri, mediaType: "audio/mp4" });
          }}
        />
      </SheetActions>
    </>
  );
}
