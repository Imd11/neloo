import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface WheelChartProps {
  items: {
    label: string;
    value: number;
    color?: string;
  }[];
  primaryColor?: string;
}

export function WheelChart({
  items,
  primaryColor = "#0e5484",
}: WheelChartProps) {
  // Generate colors based on primary color
  const generateColors = (count: number) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const opacity = 0.3 + i * 0.15;
      colors.push(
        `${primaryColor}${Math.floor(opacity * 255)
          .toString(16)
          .padStart(2, "0")}`
      );
    }
    return colors;
  };

  const data = {
    labels: items.map((item) => item.label),
    datasets: [
      {
        data: items.map((item) => item.value),
        backgroundColor: items.map(
          (item, i) => item.color || generateColors(items.length)[i]
        ),
        borderColor: "white",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "40%",
    plugins: {
      legend: {
        display: true,
        position: "bottom" as const,
        labels: {
          font: {
            size: 8,
          },
          boxWidth: 10,
          padding: 5,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label as string;
            const raw = context.raw as number;
            return `${label}: ${raw}%`;
          },
        },
      },
    },
  };

  return (
    <div
      className="wheel-chart"
      style={{ width: "100%", maxWidth: "150px", margin: "0 auto" }}
    >
      <Doughnut
        data={data}
        options={options}
      />
    </div>
  );
}

export default WheelChart;
