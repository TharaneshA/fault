import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

const data = [
  { name: "CPU Stress", cmea: 92, ingd: 88, ccre: 85 },
  { name: "Memory Leak", cmea: 85, ingd: 91, ccre: 82 },
  { name: "Network Delay", cmea: 78, ingd: 89, ccre: 86 },
  { name: "Pod Failure", cmea: 88, ingd: 84, ccre: 90 },
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={2} barSize={16}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.3)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          stroke="rgba(255,255,255,0.3)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={[60, 100]}
          tickFormatter={(value) => `${value}%`}
          dx={-4}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
          contentStyle={{
            backgroundColor: "rgba(0,0,0,0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            fontSize: "12px",
            padding: "8px 12px",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}
          formatter={(value: number) => [`${value}%`, ""]}
        />
        <Bar
          dataKey="cmea"
          fill="#10b981"
          radius={[3, 3, 0, 0]}
          name="CMEA"
        />
        <Bar
          dataKey="ingd"
          fill="#3b82f6"
          radius={[3, 3, 0, 0]}
          name="INGD"
        />
        <Bar
          dataKey="ccre"
          fill="#8b5cf6"
          radius={[3, 3, 0, 0]}
          name="CCRE"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
