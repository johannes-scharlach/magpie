import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import type { ImageAttachment } from "./image-attachment";

export const MAX_RECORDING_SECONDS = 5 * 60;
// Speech, not music: mono at 64 kbps is about half a megabyte a minute.
const SPEECH = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
};

export type Recording = { uri: string; seconds: number };

export function recordingAttachment(recording: Recording): ImageAttachment {
  return { uri: recording.uri, mediaType: "audio/mp4" };
}

/** Tap to start, tap to stop (ADR 32, ADR 33). The recording stops itself
 *  at five minutes and is then waiting in `recording`. */
export function useVoiceRecording() {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [active, setActive] = useState(false);
  // Only the time limit lands in the listener. Its event for a stop we asked
  // for arrives after that stop has finished, so each stop clears this first.
  const awaitingLimit = useRef(false);
  const recorder = useAudioRecorder(SPEECH, (status) => {
    if (status.isFinished && status.url && awaitingLimit.current) {
      awaitingLimit.current = false;
      setActive(false);
      setRecording({ uri: status.url, seconds: MAX_RECORDING_SECONDS });
    }
  });
  const state = useAudioRecorderState(recorder, 250);
  const elapsed = state.durationMillis / 1000;

  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Microphone access needed",
        "Allow microphone access in Settings to talk to Magpie.",
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    awaitingLimit.current = true;
    recorder.record({ forDuration: MAX_RECORDING_SECONDS });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecording(null);
    setActive(true);
  }

  // State changes wait until the recorder has stopped, so the screen moves
  // straight from recording to its next state.
  async function halt(): Promise<Recording | null> {
    awaitingLimit.current = false;
    const seconds = elapsed;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return recorder.uri ? { uri: recorder.uri, seconds } : null;
  }

  /** Stop and keep the recording, to send or record again. */
  async function stop() {
    const done = await halt();
    setActive(false);
    setRecording(done);
  }

  /** Stop if still running, and hand over the recording. */
  async function take(): Promise<Recording | null> {
    const done = recorder.isRecording ? await halt() : recording;
    setActive(false);
    setRecording(null);
    return done;
  }

  async function discard() {
    if (recorder.isRecording) await halt();
    setActive(false);
    setRecording(null);
  }

  return { active, elapsed, recording, start, stop, take, discard };
}
