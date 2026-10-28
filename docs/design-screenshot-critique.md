# Design screenshot critique workflow

Use screenshots to evaluate the rendered product, not its implementation.

For working simulator operation and native capture commands, read
[Mobile UI verification](mobile-ui-verification.md). Use that guide to produce
the images; keep implementation details out of the critic's context.

Report visual critique separately from any interaction verification. Screenshots
establish appearance; interaction results come from observed behavior on-device.

## General guidance

### Capture

- Capture on the target mobile platform and device class.
- Capture the complete screen first. Keep the original capture unchanged.
- Wait for navigation, layout, and animations to settle before capturing.
- Capture enough of the flow to judge the design as a system.
- Use the same capture conditions for each round.
- Keep native PNG originals for critique. Compressed previews and desktop window
  captures used for coordinate calibration are not substitutes.

Store working captures in the directory:

```text
docs/.screenshots/<design-name>/
```

#### Storage

Use stable, descriptive names:

```text
docs/.screenshots/<design-name>/
  00-welcome.png
```

Follow the [capture artifact policy](mobile-ui-verification.md#capture-artifacts)
for metadata and temporary runner output.

### Critic

- Start every critique in a fresh context.
- Use the same short prompt and product goal for every round. Describe the
  intended user outcome, not what changed, our preferred solution, or the
  trade-offs we have already chosen. Do not turn our conclusions into premises
  the critic is expected to endorse.
- Mention screenshot paths and instruct the critic to open/read them
  independently. Do not provide source code, implementation details, or prior
  critique.
- Review the relevant experience as a whole, not just the last edited card.
- Ask for independent visual judgment, including native mobile fit. Let the
  critic identify meaningful alternatives and weigh their trade-offs itself.
  Do not supply our analysis or prescribe a category-by-category reasoning
  exercise, comparison table, or verdict taxonomy.
- Ask what works and what, if anything, is worth changing. Recommendations
  should explain a meaningful benefit, grounded in visible details. There is
  no issue quota and keeping the current design is a legitimate conclusion.
- Judge craft as well as usefulness. Generic, stock-looking or conspicuously
  AI-looking execution can undermine trust and deserves criticism for its
  visible effect; do not infer quality from the tools actually used.
- When a score is requested, define what the maximum means against the product
  goal. Keep that anchor, the brief, capture conditions and critic model fixed
  across comparable runs. Excellent means exemplary execution of the brief,
  not something beyond imagination. Do not introduce unagreed weights or a
  category-by-category scoring exercise merely to manufacture precision.
- Count a critique as successful only when the response clearly references
  visible details and offers independent, useful judgment. File discovery or
  echoing the brief is not visual review. If the tool hangs or cannot inspect
  the images, report that failure rather than inventing feedback. Check that
  the captures actually cover the promised states before accepting the review.

#### Reusable critic prompt

Fill in the brief and actual repository-relative image paths before sending:

```text
Goal: <intended user outcome and necessary product context only>.

Independently open/read every screenshot at these repository-relative paths:
<explicit paths, with platform/device, theme, text size, keyboard state,
dimensions, and what state each image should show>
Review the visual design and native mobile fit. What works, and what, if
anything, would meaningfully improve it? Consider credible alternatives and
their trade-offs before recommending a change. Be specific and concise;
there is no issue quota. Judge both composition and fine visual craft.

<If a score was requested: Give one overall score out of 10, grounded in
visible evidence. 10 means exemplary execution of this brief with excellent
craft and no meaningful visible weakness needing correction, not perfection
beyond imagination. Preserve this anchor between runs.>

Do not read source code or previous critiques. If you cannot inspect an image,
make no judgement about it. Screenshots do not verify interaction behavior.
```

Do not use `@<path>` attachments unless attachment behavior has been verified
in the current environment. Independent file reads and image attachments are
different mechanisms.

### Iteration

Apply only feedback grounded in visible screenshots. Recapture the same set
with the same device and framing, then run the same prompt and brief again.
Treat uncertain recommendations as questions for experiments, not mandatory
changes. Agree on the question and try the smallest useful experiment first.

Stop when meaningful problems are resolved and the remaining choices are
defensible trade-offs, or after three rounds unless explicitly told otherwise.
Do not optimize toward an arbitrary 9/10 or treat every new suggestion as an
obligation. Revisit settled decisions when new evidence or changed goals
warrant it. Report unresolved questions instead of cycling between opposing
recommendations. Keep earlier feedback visible until it has been addressed,
tested, or explicitly declined; a narrower later review does not resolve it.

Correct missing, duplicate, or misframed captures before accepting a round.
Changing the prompt or brief starts a new evaluation; scores and verdicts from
different prompts are not evidence that the design improved or regressed.

The current critic prompt must mention the repository-relative paths
above and tell the subagent to open them independently. If it can't read them,
it must not make any judgement.
