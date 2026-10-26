import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { SheetActions } from "@/components/sheet-actions";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import {
  pickImageAttachments,
  type ImageAttachment,
  type ImageSource,
} from "@/features/chat/image-attachment";
import { ImageAttachmentMenu } from "@/features/chat/image-attachment-menu";
import { ImageAttachmentStrip } from "@/features/chat/image-attachment-strip";
import {
  importRecipe,
  importRecipeFromContent,
} from "@/features/meals/import-adapters";
import { PasteButton } from "@/features/meals/paste-button";
import {
  pastedImport,
  type PastedImport,
} from "@/features/meals/pasted-import";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { posthog } from "@/lib/posthog";

type Content =
  PastedImport | { kind: "photos"; photos: ImageAttachment[]; note: string };

/** Native formSheet: detents, grabber, swipe-to-dismiss. Unmounts on close,
 *  so nothing carries over. Same pattern as variant/plan. The rows name where
 *  recipes come from; pasting imports at once, photos get a review first. */
export default function ImportRecipeSheet() {
  const router = useRouter();
  const { listId } = useHouseholdAccess();
  const operation = useRef<{ input: string; operationId: string } | null>(null);
  const [photos, setPhotos] = useState<ImageAttachment[]>([]);
  const [note, setNote] = useState("");
  const [picking, setPicking] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = picking || reading !== null;
  const muted = useResolveClassNames("text-muted-foreground").color;

  async function addPhotos(source: ImageSource) {
    if (busy) return;
    setPicking(true);
    setError(null);
    try {
      const picked = await pickImageAttachments(source);
      if (picked.length) setPhotos((current) => [...current, ...picked]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add photos.");
    } finally {
      setPicking(false);
    }
  }

  async function run(content: Content) {
    if (!listId || busy) return;
    setReading(readingLabel(content));
    setError(null);
    try {
      // A retry of the same content reuses the operation, so it finds a save
      // that completed after the request timed out.
      const input = JSON.stringify(
        content.kind === "photos"
          ? [content.photos.map((p) => p.uri), content.note.trim()]
          : content,
      );
      if (operation.current?.input !== input) {
        operation.current = { input, operationId: Crypto.randomUUID() };
      }
      const { operationId } = operation.current;
      if (content.kind === "link") {
        await importRecipe({ url: content.url, operationId, listId });
      } else if (content.kind === "text") {
        await importRecipeFromContent({
          operationId,
          listId,
          text: content.text,
          photos: [],
        });
      } else {
        await importRecipeFromContent({
          operationId,
          listId,
          text: content.note.trim() || undefined,
          photos: content.photos,
        });
      }

      posthog?.capture("recipe_imported", { source: content.kind });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof Error ? e.message : String(e));
      setReading(null);
    }
  }

  function onPaste(text: string) {
    const content = pastedImport(text);
    if (content) void run(content);
    else setError("There's nothing to paste. Copy a link or recipe first.");
  }

  return (
    <View collapsable={false}>
      <View className="flex-row items-center justify-between gap-4 px-6 pt-4">
        <Text className="flex-1 font-rounded text-lg font-bold">
          Import recipe
        </Text>
        <CloseButton
          onPress={() => router.back()}
          disabled={reading !== null}
        />
      </View>

      {reading !== null ? (
        <View className="mt-6 flex-row items-center gap-3 px-6 pb-10">
          <ActivityIndicator />
          <Text variant="muted" numberOfLines={1} className="flex-1">
            {reading}
          </Text>
        </View>
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
            <View className="self-start">
              <ImageAttachmentMenu
                onSelect={(source) => void addPhotos(source)}
                disabled={busy}
                accessibilityLabel="Add another page"
                label={picking ? "Opening photos…" : "Add another page"}
              />
            </View>
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
              onPress={() => void run({ kind: "photos", photos, note })}
              disabled={busy}
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
                From a website, Instagram or a message
              </Text>
            </View>
            <PasteButton onPaste={onPaste} disabled={busy} />
          </View>
          <SourceRow
            icon={{ ios: "camera", android: "photo_camera" }}
            label="Take a photo of a cookbook page"
            onPress={() => void addPhotos("camera")}
            disabled={busy}
          />
          <SourceRow
            icon={{ ios: "photo.on.rectangle", android: "photo_library" }}
            label="Choose screenshots or photos"
            onPress={() => void addPhotos("library")}
            disabled={busy}
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

function readingLabel(content: Content): string {
  if (content.kind === "link") {
    return `Reading ${new URL(content.url).hostname.replace(/^www\./, "")}…`;
  }
  if (content.kind === "text") {
    return `Reading “${content.text.split("\n")[0]}”…`;
  }
  return content.photos.length === 1
    ? "Reading your photo…"
    : `Reading ${content.photos.length} photos…`;
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
