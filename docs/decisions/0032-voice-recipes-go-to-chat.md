# 32. Recipes told by voice go to chat

Date: 2026-10-26
Status: Accepted
Builds on: 9 (chats in the database), 31 (import from pasted text and photos)

## Context

Some recipes exist only in the cook's head. Keyboard dictation is too poor
to capture them. Unlike a link, a page or a photo, a recipe told from memory
has gaps, and Magpie has to guess amounts, times and portions. The user
must confirm those guesses before anything is saved.

## Decision

The import sheet has a fourth row, "Tell Magpie a recipe you know". It
records audio with `expo-audio`: tap to start, tap to stop, up to five
minutes, mono AAC in an m4a file at 64 kbps.

Sending starts a new chat, not an import. The first message is "Here's a
recipe I know." plus the recording. Started from a meal slot, it also asks
for the recipe to be planned there once saved (ADR 34). Recordings are attachments like photos:
a private `chat-voice` bucket, objects under the list's id, readable and
writable by its members, and a signed URL in the message part that every
member's phone plays and the API downloads for the chat model. Gemini reads
the audio directly; there is no transcription step.

The assistant prompt has a section for a recipe the user already knows:
their version is the recipe, corrections in the recording win, and the reply
is a Sketch with amounts and steps followed by a list of every assumption.
It saves only when asked, through `addToCookbook`, as any chat does.

## Consequences

- Recording needs a native build with the microphone permission.
- Corrections are typed in this first version. A microphone in the chat
  composer comes separately.
- Recordings are kept with the chat, like photos.
