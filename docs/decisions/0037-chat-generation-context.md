# 37. Preserve the initial context behind each chat reply

Date: 2026-10-29
Status: Accepted

Messages and tool results show what happened, but the household profile and
system instructions can change before a retrospective. Store the initial
model input in `chat_generation_contexts`, keyed by the assistant message and
deleted with it. Capture through the SDK's model-call hook so the record holds
the assembled instructions, selected model messages, prepared tool schemas and
generation settings actually used, including the seeded-idea path.

Capture once before generation, then attach the first response's model ID and
timestamp. Keep selected UI message IDs for navigation and `FLY_IMAGE_REF` when
available for the build reference. The SDK response model ID can remain an alias
when the provider does not report a resolved version. The snapshot is initial
turn context, not a wire-level trace of every retry and tool step; later actions
remain in `chat_messages` (ADR 9).

This is a server-only diagnostic table with no client grants or sync stream.
Its duplication of prompt/history would otherwise be sent to every household
device. It intentionally has no mobile schema or upload entry. Capture errors
are logged and leave the reply running. Old turns have no snapshot; current
profiles cannot silently stand in for historical context. Media URLs retain
their existing expiry rather than becoming permanent media archives.
