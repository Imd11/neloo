import assert from "node:assert/strict";

const { getVisibleHumanContent, sanitizeLegacyHiddenPromptContent } =
  await import("../src/app/utils/hiddenPromptEnvelope.ts");

const promptOptimizeContent =
  "You are a senior prompt engineer.\n\n" +
  "- Do not answer the user's task. Only return the improved prompt." +
  "make a hero prompt";

assert.equal(
  sanitizeLegacyHiddenPromptContent(promptOptimizeContent),
  "make a hero prompt"
);

assert.equal(
  getVisibleHumanContent({
    id: "m1",
    type: "human",
    content: "Analysis direction: Career.\n\nUser information:\n1990-01-01",
  }),
  "1990-01-01"
);

assert.equal(sanitizeLegacyHiddenPromptContent("hello world"), "hello world");
