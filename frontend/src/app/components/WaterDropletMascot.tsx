"use client";

import { motion, Easing } from "framer-motion";

export function WaterDropletMascot() {
  const cycleDuration = 1.0;

  // 时间节点
  const keyTimes = [
    0, // 顶点（速度=0）
    0.45, // 触地瞬间（速度最大）
    0.5, // 最大压缩
    0.55, // 开始弹起（速度最大，方向向上）
    1, // 回到顶点（速度=0）
  ];

  // 位移值
  const yValues = [
    0, // 顶点
    60, // 触地
    60, // 压缩时保持
    60, // 弹起开始
    0, // 回到顶点
  ];

  // 形变值（主形变10%，与碰撞同步）
  const scaleXValues = [1, 1.02, 1.1, 1.02, 1];
  const scaleYValues = [1, 0.98, 0.9, 0.98, 1];

  // 分段缓动：下落加速(easeIn)，弹起减速(easeOut)
  const segmentEases: Easing[] = [
    [0.4, 0, 1, 1], // 下落：easeIn（慢→快，加速度）
    [0, 0, 0.2, 1], // 压缩：快速
    [0.8, 0, 1, 1], // 压缩恢复：快速
    [0, 0, 0.6, 1], // 弹起：easeOut（快→慢，减速）
  ];

  return (
    <motion.div
      className="relative"
      style={{
        width: "120px",
        height: "120px",
      }}
      animate={{ y: yValues }}
      transition={{
        duration: cycleDuration,
        times: keyTimes,
        ease: segmentEases,
        repeat: Infinity,
      }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{
          transformOrigin: "bottom center",
        }}
        animate={{
          scaleX: scaleXValues,
          scaleY: scaleYValues,
        }}
        transition={{
          duration: cycleDuration,
          times: keyTimes,
          ease: segmentEases,
          repeat: Infinity,
        }}
      >
        <img
          src="/meloo-mascot.png"
          alt="Neloo"
          className="h-full w-full object-contain"
        />
      </motion.div>
    </motion.div>
  );
}
