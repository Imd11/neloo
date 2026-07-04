# Homepage Feature Buttons QA

| Feature | Select button | Select template/style | Visible capsule | Selected card state | Backend receives template instruction | Result acceptable |
|---|---|---|---|---|---|---|
| AI Image | Pass: `AI 生图` opens image mode | Pass: `王家卫电影风` selected | Pass: input shows selected image template | Pass: selected card has ring/check | Pass: selected template prompt fills the image prompt | Pass |
| Slides | Pass: `制作幻灯片` opens preset grid | Pass: `Blueprint` selected | Pass: homepage input shows selected preset name | Pass: selected preset has border/check and `已选` label | Pass: outline uses selected chat model; slide images use default image provider | Pass |
| Prompt Optimize | Pass: `提示词优化` opens template grid | Pass: `图像生成` selected | Pass: input shows selected template capsule | Pass: selected card has ring/check | Pass: `promptInstruction` is passed into the hidden prompt prefix | Pass |
| Fortune Telling | Pass: `五行算命` opens structured birth form | Pass: `事业发展` selected | Pass: fortune input shows selected template capsule | Pass: selected card has ring/check | Pass: selected template changes hidden fortune prefix while birth form stays unchanged | Pass |
| Humanize | Pass: `去AI化` opens template grid | Pass: `学术论文` selected | Pass: input shows selected template capsule | Pass: selected card has ring/check | Pass: `promptInstruction` is passed into the hidden humanize prompt | Pass |
| AI Translate | Pass: `AI翻译` opens translate panel | Pass: style cards are visible and selectable | Not applicable: translate uses in-panel style controls | Pass: selected style card is visible | Pass: `/api/translate` receives source language, target language, style, and selected model ID | Pass |

## Automated Checks

- Browser smoke check covered all six homepage buttons.
- Template image counts observed in browser:
  - AI Image: 4 template images
  - Slides: 16 preset images
  - Prompt Optimize: 6 template images
  - Fortune Telling: 8 template images
  - Humanize: 6 template images
- Backend guest checks:
  - `POST /api/translate` without auth returned `200 OK`.
  - `POST /api/slides/generate` without auth returned `200 OK`.

## Notes

- Full paid generation was not triggered during QA for image/slides output content. The UI path, template selection path, and backend guest API paths were verified separately.
- Hidden prompt prefixes are expected to be sent to the model but not shown in visible chat bubbles or template cards.
