# Homepage Feature Buttons Audit Notes

## AI Image
- Visible template selection: Pass. Image mode has a selected template capsule in the input and selected template state in the image page.
- Template prompt applied: Pass. Selecting a template fills the image prompt from `template.prompt`.
- Backend route: `/api/generate-image`.
- Remaining issues: This task set does not need more AI Image changes beyond preserving the existing four stable real templates.

## Slides
- Visible preset selection: Partial. Preset selection exists, but recommended vs selected state is not explicit enough.
- Preset applied to outline: Pass. `generateOutlineStream` receives `presetId` and adds preset context.
- Preset applied to slide images: Pass. `generateSlideImage` receives `presetId` and builds image prompt context from it.
- Backend route: `/api/slides/generate` for outline text, `/api/generate-image` for slide images.
- Remaining issues: Loaded history currently drops `style` and `presetId`, so regenerated or reopened decks can lose preset continuity.

## Prompt Optimize
- Visible template selection: Partial. The selected template name can appear in the main input, but selected card state and detail explanation are missing.
- Template prompt applied: Partial. The submit flow uses template ID lookup in `getPromptOptimizePrompt`, not template-owned backend instructions.
- Backend route: Main chat graph through `sendMessage` with hidden prompt prefix.
- Remaining issues: Template metadata needs user-facing effects, preview images, and stable English backend instructions.

## Fortune Telling
- Visible template selection: Partial. Selected card state and a fortune template capsule are missing in the structured fortune input.
- Template prefix applied: Pass. Submit flow uses `getFortuneTemplatePrefix(templateId)`.
- Backend route / graph: Main chat graph with fortune mode enabled.
- Remaining issues: Fortune prefixes are currently Chinese-only hidden prompts. The visible birth-info form must stay unchanged while selection feedback and hidden prefix routing become clearer.

## Humanize
- Visible template selection: Partial. The selected template name can appear in the main input, but selected card state and detail explanation are missing.
- Template prompt applied: Partial. The submit flow uses template ID lookup in `getHumanizePrompt`, not template-owned backend instructions.
- Backend route: Main chat graph through `sendMessage` with hidden prompt prefix.
- Remaining issues: Template metadata needs user-facing effects, preview images, and stable English backend instructions.

## AI Translate
- Visible style selection: Pass. Style cards show selected state inside the translate panel.
- Style prompt applied: Pass. The backend receives `style`, `source_language`, `target_language`, and `model_id`.
- Backend route: `/api/translate`.
- Remaining issues: No homepage template grid work is needed. Verify guest access and selected model flow during final QA.
