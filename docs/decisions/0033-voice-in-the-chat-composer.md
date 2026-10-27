# 33. Voice messages in the chat composer

Date: 2026-10-27
Status: Accepted
Builds on: 9 (chats in the database), 32 (recipes told by voice go to chat)

## Context

Telling Magpie a recipe works by voice, but correcting it and every other
chat meant typing. Messengers show how to add voice without adding
controls: the microphone takes Send's place while there is nothing to send.

## Decision

The composer's trailing slot shows a microphone when the field is empty and
nothing is attached. Typing or attaching a photo turns it back into Send.
On the recipe screen the recipe's own action keeps that slot until the field
is focused, as before.

Tapping the microphone starts recording. The keyboard goes, and the field
becomes a trash button, a red dot with a timer, and Send. Send stops and
sends at once; there is no review step. Trash throws the recording away.
Recording stops itself at five minutes and waits for Send. There is no
hold-to-talk.

A voice message is an attachment with no text, stored and sent exactly as
in ADR 32. The model hears it directly, so the prompt needs no change.
`useVoiceRecording` holds the recorder for both the import sheet and the
composer.

## Consequences

- The recipe screen gets voice too: a recording there starts a recipe chat.
- Hold-to-talk, waveforms and playback before sending are left out until
  people ask for them.
