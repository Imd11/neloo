"use client";

import { useEffect, useRef } from "react";

export function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    const chars = "0123456789".split("");

    // Floating numbers
    let floatingNumbers: Array<{
      x: number;
      y: number;
      char: string;
      opacity: number;
      speed: number;
      size: number;
      sway: number;
      swaySpeed: number;
    }> = [];

    const initFloatingNumbers = () => {
      const count = Math.floor((canvas.width * canvas.height) / 28000);
      floatingNumbers = [];

      for (let i = 0; i < count; i++) {
        floatingNumbers.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          char: chars[Math.floor(Math.random() * chars.length)],
          opacity: 0.15 + Math.random() * 0.15,
          speed: 0.15 + Math.random() * 0.25,
          size: 10 + Math.random() * 6,
          sway: Math.random() * Math.PI * 2,
          swaySpeed: 0.008 + Math.random() * 0.015,
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initFloatingNumbers();
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = document.documentElement.classList.contains("dark");
      const baseColor = isDark ? [100, 180, 255] : [50, 100, 180];
      const glowColor = isDark ? [120, 200, 255] : [70, 130, 220];

      // 3D perspective parameters - camera looking at ground plane
      const horizonY = canvas.height * 0.32; // Horizon line (slightly higher viewpoint)
      const cameraHeight = 1.5; // Camera height relative to grid
      const gridCellSize = 1; // Each cell is 1x1 unit (square)
      const gridCountX = 30; // Cells to each side
      const gridCountZ = 40; // Cells into the distance
      const fov = canvas.width * 0.8; // Field of view

      // Project 3D point to 2D screen
      const project = (x: number, z: number) => {
        if (z <= 0) return null;
        const scale = fov / z;
        const screenX = canvas.width / 2 + x * scale;
        const screenY = horizonY + cameraHeight * scale;
        return { x: screenX, y: screenY, scale };
      };

      // Draw grid lines
      const drawLine = (x1: number, z1: number, x2: number, z2: number, opacity: number, lineWidth: number) => {
        const p1 = project(x1, z1);
        const p2 = project(x2, z2);
        if (!p1 || !p2) return;
        if (p1.y > canvas.height + 100 && p2.y > canvas.height + 100) return;
        if (p1.y < -100 && p2.y < -100) return;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${baseColor.join(",")}, ${opacity})`;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      };

      // Draw horizontal lines (perpendicular to view direction) - these create the "rows"
      for (let z = 1; z <= gridCountZ; z++) {
        const zPos = z * gridCellSize;
        const xExtent = gridCountX * gridCellSize;

        const pulse = Math.sin(time * 2 - z * 0.15) * 0.5 + 0.5;
        const distanceFade = Math.max(0.1, 1 - z / gridCountZ);
        const opacity = (0.15 + distanceFade * 0.2) * (0.7 + pulse * 0.3);
        const lineWidth = 0.5 + distanceFade * 1;

        ctx.shadowBlur = 4 + pulse * 4;
        ctx.shadowColor = `rgba(${glowColor.join(",")}, ${opacity * 0.5})`;

        drawLine(-xExtent, zPos, xExtent, zPos, opacity, lineWidth);
      }

      // Draw vertical lines (parallel to view direction) - these create the "columns"
      for (let x = -gridCountX; x <= gridCountX; x++) {
        const xPos = x * gridCellSize;

        const distanceFromCenter = Math.abs(x) / gridCountX;
        const pulse = Math.sin(time * 2 + x * 0.1) * 0.5 + 0.5;
        const opacity = (0.12 + (1 - distanceFromCenter) * 0.18) * (0.7 + pulse * 0.3);
        const lineWidth = 0.5 + (1 - distanceFromCenter) * 0.6;

        ctx.shadowBlur = 4 + pulse * 4;
        ctx.shadowColor = `rgba(${glowColor.join(",")}, ${opacity * 0.5})`;

        drawLine(xPos, 0.5, xPos, gridCountZ * gridCellSize, opacity, lineWidth);
      }

      ctx.shadowBlur = 0;

      // Subtle gradient overlay
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, `rgba(${glowColor.join(",")}, 0.02)`);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw floating numbers
      const textColor = isDark ? "180, 220, 255" : "40, 80, 150";
      floatingNumbers.forEach((num) => {
        num.sway += num.swaySpeed;
        const swayOffset = Math.sin(num.sway) * 0.5;

        ctx.font = `${num.size}px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = `rgba(${textColor}, ${num.opacity})`;
        ctx.fillText(num.char, num.x + swayOffset, num.y);

        num.y -= num.speed;

        if (num.y < -20) {
          num.y = canvas.height + 20;
          num.x = Math.random() * canvas.width;
          num.char = chars[Math.floor(Math.random() * chars.length)];
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/20" />

      {/* Animated canvas with 3D grid and floating numbers */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Soft ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50%]"
        style={{
          background: "radial-gradient(ellipse at center top, hsl(var(--primary) / 0.03), transparent 70%)",
        }}
      />
    </div>
  );
}
