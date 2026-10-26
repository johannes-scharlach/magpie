import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";

import type { Parts } from "./stream";

/** A photo, or a voice message (audio/mp4) despite the name. */
export type ImageAttachment = { uri: string; mediaType: string };
export type ImageSource = "camera" | "library";
export type FilePart = Extract<Parts[number], { type: "file" }>;

/** Long enough for a household to scroll back through a season of chats. */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

const CAMERA_PICK: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.5,
  allowsMultipleSelection: false,
};

const LIBRARY_PICK: ImagePicker.ImagePickerOptions = {
  ...CAMERA_PICK,
  allowsMultipleSelection: true,
};

function toAttachments(
  result: ImagePicker.ImagePickerResult,
): ImageAttachment[] {
  if (result.canceled || !result.assets) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    mediaType: asset.mimeType ?? "image/jpeg",
  }));
}

export async function pickImageAttachments(
  source: ImageSource,
): Promise<ImageAttachment[]> {
  if (source === "library") {
    return toAttachments(
      await ImagePicker.launchImageLibraryAsync(LIBRARY_PICK),
    );
  }

  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) {
    Alert.alert(
      "Camera access needed",
      "Allow camera access in Settings to take a photo, or choose one from your library instead.",
    );
    return [];
  }
  return toAttachments(await ImagePicker.launchCameraAsync(CAMERA_PICK));
}

/** Where an attachment lives: the household's folder in the bucket for its
 *  kind, so every member's phone and the API can read it (ADR 9, ADR 32). */
export function storageTarget(listId: string, mediaType: string) {
  if (mediaType.startsWith("audio/")) {
    return {
      bucket: "chat-voice",
      path: `${listId}/${Crypto.randomUUID()}.m4a`,
    };
  }
  const ext = mediaType === "image/png" ? "png" : "jpg";
  return {
    bucket: "chat-images",
    path: `${listId}/${Crypto.randomUUID()}.${ext}`,
  };
}

/**
 * Attachments do not go into message parts as base64 (ADR 9). They go to a
 * private bucket under the list's id, and the part carries a signed URL that
 * every member's phone can show or play and the API can download for the
 * model.
 */
export async function uploadAttachment(
  listId: string,
  attachment: ImageAttachment,
): Promise<FilePart> {
  const { bucket, path } = storageTarget(listId, attachment.mediaType);
  const bytes = await (await fetch(attachment.uri)).arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: attachment.mediaType });
  if (error) throw new Error(`Could not upload: ${error.message}`);

  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data)
    throw new Error("Could not link the attachment");

  return {
    type: "file",
    mediaType: attachment.mediaType,
    url: signed.data.signedUrl,
    filename: path,
  };
}

export function imageParts(parts: Parts): FilePart[] {
  return parts.filter(
    (p): p is FilePart => p.type === "file" && p.mediaType.startsWith("image/"),
  );
}

export function audioParts(parts: Parts): FilePart[] {
  return parts.filter(
    (p): p is FilePart => p.type === "file" && p.mediaType.startsWith("audio/"),
  );
}
