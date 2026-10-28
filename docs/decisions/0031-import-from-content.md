# 31. Import from pasted text and photos

Date: 2026-10-26
Status: Accepted, amended by 35 (many recipes per import)
Builds on: 10 (the API owns import), 30 (facts exact, prose rewritten)

## Context

Many recipes are not behind a link: a caption, a message from a friend, a
cookbook page, a handwritten card, a screenshot. Nobody types a link either;
they paste it.

## Decision

The import sheet lists where recipes come from instead of offering an empty
field: paste a link or recipe text, take a photo of a cookbook page, or
choose screenshots or photos. On iOS 16+ pasting uses the system paste
control, which reads the clipboard without an "Allow Paste?" prompt; its
label is fixed to "Paste". Pasting imports at once. Photos get a review
first, with an optional note such as "page 2 is the sauce".

A pasted link alone goes through link import. Anything else, and up to six
photos of one recipe in page order, goes to
`POST /v1/recipes/import-from-content` as multipart form data; nothing is
stored. The same rules as a link apply: facts exact, prose in Magpie's
words. Without a link, the source is the book, author or account the
content names, if any.

Retries find an earlier save the same way as a link: the import identity
uses a digest of the text and photos where a link import uses the URL.

When the model cannot extract a recipe, it writes the reason for the cook
("The amounts are cut off. Take a photo of the whole ingredient list."),
and that is the error message, for links as well. A refusal has no reason,
so it gets the general message.

Content imports can also plan the recipe into a meal slot, like a link
(ADR 34).

## Consequences

- Content that is not a complete recipe fails with something the cook can
  act on, rather than a recipe built on guesses. Recipes from memory go
  through chat instead, where Magpie's assumptions get confirmed before
  saving.
- A caption that only links to the recipe fails with a hint to paste the
  link; following links inside pasted text can come later.
