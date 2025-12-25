"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";

interface FloatingNumber {
  x: number;
  y: number;
  z: number;
  value: string;
  speed: number;
  opacity: number;
}

export function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let floatingNumbers: FloatingNumber[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initFloatingNumbers = () => {
      floatingNumbers = [];
      const count = Math.floor((canvas.width * canvas.height) / 25000);

      for (let i = 0; i < count; i++) {
        floatingNumbers.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * 100,
          value: Math.random() > 0.5 ? "0" : "1",
          speed: 0.2 + Math.random() * 0.5,
          opacity: 0.1 + Math.random() * 0.3,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw 3D perspective grid
      drawPerspectiveGrid(ctx, canvas.width, canvas.height, isDark);

      // Draw floating numbers
      drawFloatingNumbers(ctx, floatingNumbers, isDark);

      // Update floating numbers positions
      floatingNumbers.forEach((num) => {
        num.y -= num.speed;
        if (num.y < -20) {
          num.y = canvas.height + 20;
          num.x = Math.random() * canvas.width;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    initFloatingNumbers();
    draw();

    window.addEventListener("resize", () => {
      resize();
      initFloatingNumbers();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

function drawPerspectiveGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean
) {
  const vanishingPointX = width / 2;
  const vanishingPointY = height * 0.35;
  const horizonY = height * 0.4;
  const gridLines = 20;
  const gridSpacing = 80;

  // Grid color based on theme
  const gridColor = isDark
    ? "rgba(100, 120, 180, 0.08)"
    : "rgba(80, 100, 160, 0.06)";

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Draw horizontal lines with perspective
  for (let i = 0; i <= gridLines; i++) {
    const progress = i / gridLines;
    const y = horizonY + progress * (height - horizonY) * 1.5;
    const scale = 1 - progress * 0.7;

    ctx.beginPath();
    ctx.moveTo(vanishingPointX - width * scale, y);
    ctx.lineTo(vanishingPointX + width * scale, y);
    ctx.stroke();
  }

  // Draw vertical lines converging to vanishing point
  const verticalLines = 25;
  for (let i = -verticalLines; i <= verticalLines; i++) {
    const x = vanishingPointX + i * gridSpacing;

    ctx.beginPath();
    ctx.moveTo(vanishingPointX, vanishingPointY);
    ctx.lineTo(x, height + 100);
    ctx.stroke();
  }

  // Draw subtle glow at vanishing point
  const gradient = ctx.createRadialGradient(
    vanishingPointX,
    vanishingPointY,
    0,
    vanishingPointX,
    vanishingPointY,
    200
  );

  if (isDark) {
    gradient.addColorStop(0, "rgba(100, 140, 220, 0.15)");
    gradient.addColorStop(1, "rgba(100, 140, 220, 0)");
  } else {
    gradient.addColorStop(0, "rgba(80, 120, 200, 0.1)");
    gradient.addColorStop(1, "rgba(80, 120, 200, 0)");
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(vanishingPointX, vanishingPointY, 200, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloatingNumbers(
  ctx: CanvasRenderingContext2D,
  numbers: FloatingNumber[],
  isDark: boolean
) {
  numbers.forEach((num) => {
    const scale = 1 - num.z / 150;
    const fontSize = 12 + scale * 8;

    const color = isDark
      ? `rgba(140, 160, 220, ${num.opacity * 0.6})`
      : `rgba(80, 100, 160, ${num.opacity * 0.5})`;

    ctx.font = `${fontSize}px "SF Mono", Monaco, monospace`;
    ctx.fillStyle = color;
    ctx.fillText(num.value, num.x, num.y);
  });
}
