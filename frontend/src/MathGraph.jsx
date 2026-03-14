import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

function MathGraph({ graph }) {
  if (!graph || !Array.isArray(graph.x) || !Array.isArray(graph.y) || graph.x.length === 0) {
    return <p className="graph-empty">No graph data available for this model.</p>;
  }

  const labels = graph.x.map((value) => Number(value).toFixed(2));
  const data = {
    labels,
    datasets: [
      {
        label: graph.title || "Embedding curve",
        data: graph.y,
        borderColor: "#72d7ff",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.16,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: graph.title || "Mathematical profile",
        color: "#e9f5ff",
        font: { size: 12 },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${graph.yLabel || "y"}: ${Number(context.raw).toFixed(3)}`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: graph.xLabel || "x",
          color: "#b8d4e8",
        },
        ticks: { color: "#b8d4e8", maxTicksLimit: 8 },
        grid: { color: "rgba(184, 212, 232, 0.15)" },
      },
      y: {
        title: {
          display: true,
          text: graph.yLabel || "y",
          color: "#b8d4e8",
        },
        ticks: { color: "#b8d4e8", maxTicksLimit: 6 },
        grid: { color: "rgba(184, 212, 232, 0.12)" },
      },
    },
  };

  return (
    <div className="graph-shell">
      <Line options={options} data={data} />
    </div>
  );
}

export default MathGraph;
