import assert from "node:assert/strict";
import { test } from "vitest";

import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  buildGeminiImageEditRequest,
  buildGeminiImageRequest,
  resolveImageProvider,
} from "./image-provider.js";

test("resolves image providers and builds Gemini requests", () => {
  process.env.GEMINI_IMAGE_API_KEY = "test-gemini-key";
  process.env.GEMINI_IMAGE_MODEL = "";

  const gemini = resolveImageProvider("gemini-3.1-flash-image");

  assert.equal(DEFAULT_GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image");
  assert.equal(gemini.provider, "gemini");
  assert.equal(gemini.model, "gemini-3.1-flash-image");
  assert.equal(
    gemini.baseUrl,
    "https://generativelanguage.googleapis.com/v1beta"
  );

  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_BASE_URL = "";
  process.env.OPENAI_IMAGE_MODEL = "";

  const openai = resolveImageProvider("gpt-image-2");

  assert.equal(openai.provider, "openai");
  assert.equal(openai.baseUrl, "https://api.openai.com");
  assert.equal(openai.model, "gpt-image-2");

  assert.deepEqual(buildGeminiImageRequest("A test image", "2k", "16x9"), {
    model: "gemini-3.1-flash-image",
    input: "A test image",
    response_format: {
      type: "image",
      mime_type: "image/png",
      aspect_ratio: "16:9",
      image_size: "2K",
    },
  });

  const editRequest = buildGeminiImageEditRequest(
    "Replace the marked area with a blue sky",
    [
      { type: "image", mime_type: "image/png", data: "original" },
      { type: "image", mime_type: "image/png", data: "marked" },
    ],
    "4k",
    "1x1"
  );

  assert.equal(editRequest.model, "gemini-3.1-flash-image");
  assert.deepEqual(editRequest.response_format, {
    type: "image",
    mime_type: "image/png",
    aspect_ratio: "1:1",
    image_size: "4K",
  });
});
