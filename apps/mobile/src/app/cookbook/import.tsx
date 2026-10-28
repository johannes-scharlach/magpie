import { useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { SheetActions } from "@/components/sheet-actions";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { dayName, toldRecipeMessage } from "@/features/chat/compose";
import {
  pickImageAttachments,
  type ImageAttachment,
  type ImageSource,
} from "@/features/chat/image-attachment";
import { ImageAttachmentMenu } from "@/features/chat/image-attachment-menu";
import { ImageAttachmentStrip } from "@/features/chat/image-attachment-strip";
import { queueMessage } from "@/features/chat/message-queue";
import type { ImportPlan, ImportSource } from "@/features/meals/import-jobs";
import { PasteButton } from "@/features/meals/paste-button";
import { pastedImport } from "@/features/meals/pasted-import";
import { SLOT_LABEL, type MealSlot } from "@/features/meals/slots";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { VoiceRecorder } from "@/features/meals/voice-recorder";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { posthog } from "@/lib/posthog";

/** What one import reads; more pages are another import (ADR 35). */
const MAX_PHOTOS = 20;

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so nothing carries over. Same pattern as variant/plan. The rows name where
 *  recipes come from; pasting imports at once, photos get a review first.
 *  Opened from a meal slot, every way in also plans the recipe there.
 *  Imports run as jobs (ADR 34): the sheet closes once one starts, and its
 *  progress shows where the recipe will land. A recipe told from memory goes
 *  to chat, where Magpie's guesses get checked before anything is saved
 *  (ADR 32). An import that finds several recipes waits for review (ADR 35). */
export default function ImportRecipeSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; slot?: MealSlot }>();
  const plan: ImportPlan | undefined =
    params.date && params.slot
      ? { date: params.date, slot: params.slot }
      : undefined;
  const { listId } = useHouseholdAccess();
  const importJobs = useImportJobs();
  const [photos, setPhotos] = useState<ImageAttachment[]>([]);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telling, setTelling] = useState(false);
  const muted = useResolveClassNames("text-muted-foreground").color;

  async function addPhotos(source: ImageSource) {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const picked = await pickImageAttachments(source);
      if (picked.length)
        setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add photos.");
    } finally {
      setPicking(false);
    }
  }

  function run(source: ImportSource) {
    if (!listId || picking) return;
    void importJobs.start(listId, source, plan);
    router.back();
  }

  function sendRecording(recording: ImageAttachment) {
    const chatId = Crypto.randomUUID();
    queueMessage({
      messageId: Crypto.randomUUID(),
      text: toldRecipeMessage(plan),
      attachments: [recording],
    });
    posthog?.capture("recipe_told");
    router.replace(`/chats/${chatId}` as never);
  }

  function onPaste(text: string) {
    const content = pastedImport(text);
    if (content) run(content);
    else setError("There's nothing to paste. Copy a link or recipe first.");
  }

  return (
    <View collapsable={false}>
      <View className="gap-1 px-6 pt-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 font-rounded text-lg font-bold">
            {telling
              ? "Tell Magpie a recipe"
              : plan
                ? `Import for ${SLOT_LABEL[plan.slot].toLowerCase()}`
                : "Import recipe"}
          </Text>
          <CloseButton onPress={() => router.back()} />
        </View>
        {plan ? (
          <Text variant="muted" className="text-sm">
            Magpie saves it to your cookbook and plans it for{" "}
            {dayName(plan.date)} {SLOT_LABEL[plan.slot].toLowerCase()}.
          </Text>
        ) : null}
      </View>

      {telling ? (
        <VoiceRecorder onSend={sendRecording} />
      ) : photos.length ? (
        <>
          <View className="mt-6 gap-3 px-6">
            <ImageAttachmentStrip
              attachments={photos}
              onRemove={(index) =>
                setPhotos((current) => current.filter((_, i) => i !== index))
              }
              size={80}
            />
            {photos.length < MAX_PHOTOS ? (
              <View className="self-start">
                <ImageAttachmentMenu
                  onSelect={(source) => void addPhotos(source)}
                  disabled={picking}
                  accessibilityLabel="Add another page"
                  label={picking ? "Opening photos…" : "Add another page"}
                />
              </View>
            ) : (
              <Text variant="muted" className="text-sm">
                {MAX_PHOTOS} pages is the most for one import. Import these,
                then the next {MAX_PHOTOS}.
              </Text>
            )}
            <Input
              value={note}
              onChangeText={setNote}
              placeholder="Anything to add? For example, page 2 is the sauce"
              returnKeyType="done"
            />
            <ErrorText error={error} />
          </View>
          <SheetActions>
            <PrimaryAction
              label="Import"
              onPress={() => run({ kind: "photos", photos, note })}
              disabled={picking}
            />
          </SheetActions>
        </>
      ) : (
        <View className="mt-4 pb-6">
          <View className="ml-6 min-h-14 flex-row items-center gap-3 border-b border-border py-3 pr-6">
            <SymbolView
              name={{ ios: "doc.on.clipboard", android: "content_paste" }}
              size={22}
              tintColor={muted}
            />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Paste link or recipe text</Text>
              <Text variant="muted" className="text-sm">
                From a website, a message or your own collection
              </Text>
            </View>
            <PasteButton onPaste={onPaste} disabled={picking} />
          </View>
          <SourceRow
            icon={{ ios: "camera", android: "photo_camera" }}
            label="Take photos of cookbook pages"
            onPress={() => void addPhotos("camera")}
            disabled={picking}
          />
          <SourceRow
            icon={{ ios: "photo.on.rectangle", android: "photo_library" }}
            label="Choose screenshots or photos"
            onPress={() => void addPhotos("library")}
            disabled={picking}
          />
          <SourceRow
            icon={{ ios: "mic", android: "mic" }}
            label="Tell Magpie a recipe you know"
            onPress={() => setTelling(true)}
            disabled={picking}
            last
          />
          <View className="px-6">
            <ErrorText error={error} />
          </View>
        </View>
      )}
    </View>
  );
}

function SourceRow({
  icon,
  label,
  onPress,
  disabled,
  last = false,
}: {
  icon: { ios: string; android: string };
  label: string;
  onPress: () => void;
  disabled: boolean;
  last?: boolean;
}) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    // A plain iOS list: separators start at the text and run to the edge.
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`ml-6 min-h-14 flex-row items-center gap-3 py-3 pr-6 ${last ? "" : "border-b border-border"} ${disabled ? "opacity-40" : ""}`}
    >
      <SymbolView name={icon as never} size={22} tintColor={muted} />
      <Text className="flex-1 font-medium">{label}</Text>
      <SymbolView
        name={{ ios: "chevron.right", android: "chevron_right" }}
        size={14}
        tintColor={muted}
      />
    </Pressable>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Text
      variant="small"
      className="mt-3 text-destructive"
      accessibilityRole="alert"
    >
      {error}
    </Text>
  );
}
