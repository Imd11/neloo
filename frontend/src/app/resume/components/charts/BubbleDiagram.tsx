import { Bubble } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

interface BubbleDiagramProps {
  centerLabel: string;
  items: string[];
  primaryColor?: string;
}

export function BubbleDiagram({
  centerLabel,
  items,
  primaryColor = "#0e5484",
}: BubbleDiagramProps) {
  // Generate bubble positions in a circle around center
  const generateBubbleData = () => {
    const bubbles = [];
    const angleStep = (2 * Math.PI) / items.length;

    // Center bubble
    bubbles.push({
      x: 0,
      y: 0,
      r: 25,
      label: centerLabel,
    });

    // Surrounding bubbles
    items.forEach((item, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const radius = 60;
      bubbles.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        r: 15,
        label: item,
      });
    });

    return bubbles;
  };

  const bubbleData = generateBubbleData();

  const data = {
    datasets: [
      {
        label: "Skills",
        data: bubbleData,
        backgroundColor: bubbleData.map((_, i) =>
          i === 0
            ? primaryColor
            : `${primaryColor}${Math.floor(40 + i * 15).toString(16)}`
        ),
        borderColor: primaryColor,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        display: false,
        min: -100,
        max: 100,
      },
      y: {
        display: false,
        min: -100,
        max: 100,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const raw = context.raw as { label?: string } | undefined;
            return raw?.label || "";
          },
        },
      },
    },
  };

  return (
    <div
      className="bubble-diagram"
      style={{ width: "100%", maxWidth: "200px", margin: "0 auto" }}
    >
      <Bubble
        data={data}
        options={options}
      />
      {/* Labels overlay */}
      <div
        style={{
          position: "relative",
          marginTop: "-100%",
          paddingTop: "100%",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            color: "white",
            fontSize: "8px",
            fontWeight: "bold",
            maxWidth: "40px",
          }}
        >
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

export default BubbleDiagram;
