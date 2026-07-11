import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { system, prompt } = await req.json();
    if (!system || !prompt) {
      return NextResponse.json(
        { error: "Missing system or prompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.QWEN_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing QWEN_API_KEY" },
        { status: 500 }
      );
    }

    const baseUrl = (
      process.env.QWEN_BASE_URL ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).replace(/\/+$/, "");
    const model = process.env.QWEN_MODEL || "qwen3.7-max";
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Resume parsing failed",
      },
      { status: 500 }
    );
  }
}
