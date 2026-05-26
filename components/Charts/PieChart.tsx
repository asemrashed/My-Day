"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CategoryData {
  name: string;
  value: number;
}

interface ExpensePieChartProps {
  data: CategoryData[];
}

const COLORS = [
  "#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#06B6D4", "#84CC16", "#6366F1",
];

interface PieTooltipPayload {
  name: string;
  value: number;
  payload: {
    percent?: number;
  };
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayload[];
}

interface PieLabelProps {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  percent?: number;
}

const CustomTooltip = ({ active, payload }: PieTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-2xl p-3 shadow-2xl text-xs text-card-foreground">
        <p className="font-bold">{payload[0].name}</p>
        <p className="text-primary font-semibold mt-1">
          ৳{payload[0].value.toLocaleString("en-US")}
        </p>
        <p className="text-muted-foreground">
          {payload[0].payload.percent ? `${(payload[0].payload.percent * 100).toFixed(1)}%` : ""}
        </p>
      </div>
    );
  }
  return null;
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelProps) => {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof percent !== "number" ||
    percent < 0.05
  ) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function ExpensePieChart({ data }: ExpensePieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No expense data for chart
      </div>
    );
  }

  // Trim long category labels
  const trimmedData = data.map((d) => ({
    ...d,
    name: d.name.length > 20 ? d.name.slice(0, 20) + "…" : d.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={trimmedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={CustomLabel}
          outerRadius={110}
          innerRadius={50}
          dataKey="value"
          stroke="none"
        >
          {trimmedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="font-semibold">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
