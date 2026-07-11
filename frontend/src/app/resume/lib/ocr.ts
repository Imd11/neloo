export async function extractTextFromImage(file: File): Promise<string> {
  const { createWorker } = await import("tesseract.js");

  // Tesseract.js 7.x API: createWorker accepts language directly
  const worker = await createWorker("eng+chi_sim");
  try {
    const { data } = await worker.recognize(file);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}
