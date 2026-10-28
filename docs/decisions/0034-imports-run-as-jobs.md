# 34. Imports run as jobs, cancelled on the server

Date: 2026-10-27
Status: Accepted
Builds on: 10 (the API owns import), 31 (import from pasted text and photos)

## Context

Reading a recipe takes a few seconds. The import sheet used to block until
it finished: no closing it, no cancelling it. A request also dies when the
phone locks, while the API carries on and saves the recipe anyway. And
importing into a meal slot offered only a link.

## Decision

One import sheet serves the cookbook and a meal slot, with every way in:
paste a link or recipe text, photos, or telling Magpie a recipe. Opened from
a slot, each also plans the recipe there; a told recipe asks the chat to
plan it once saved.

Starting an import starts a job in the app and closes the sheet. The job
shows where the recipe will land: in its meal slot, or at the top of the
cookbook. Closing the sheet never cancels anything.

A request that dies without an answer (`NETWORK_ERROR`, `REQUEST_TIMEOUT`)
is sent once more when the app is next in the foreground, with the same
operation id. That either finds the save or imports again; it cannot save
twice.

Cancel is its own call, `POST /v1/recipes/imports/:operationId/cancel`. The
API records the outcome of each operation in `import_operations`, saved or
cancelled. A save and a cancel take the same per-operation lock inside their
transaction, so whichever comes second sees the other's outcome: a later
save is refused, a later cancel reports the saved recipe. This holds on any
API machine. The model call that is already running is not interrupted.

## Consequences

- A cancel after the save leaves the recipe in the cookbook, and the app
  says so.
- A cancelled import can cost one model call.
- Jobs live in app memory. If the app is killed mid-import, a success still
  arrives through sync; a failure is not shown.
