import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartDatum = Record<string, unknown>;

export function QuizTrendsChart({ data, height }: { data: ChartDatum[]; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.3} />
        <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
        <YAxis stroke="#64748B" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        />
        <Legend />
        <Line type="monotone" dataKey="Quizzes Salvos" stroke="#8884d8" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Pedidos Criados" stroke="#82ca9d" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Pedidos com Quiz" stroke="#ffc658" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function QuizSuccessRateChart({ data, height }: { data: ChartDatum[]; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.3} />
        <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
        <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#0F172A" }} />
        <Line
          type="monotone"
          dataKey="Taxa de Sucesso (%)"
          stroke="#10B981"
          strokeWidth={3}
          dot={{ fill: "#10B981", r: 4 }}
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="Adoção session_id (%)"
          stroke="#3B82F6"
          strokeWidth={3}
          dot={{ fill: "#3B82F6", r: 4 }}
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function QuizOrdersBreakdownChart({ data, height }: { data: ChartDatum[]; height: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.3} />
        <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
        <YAxis stroke="#64748B" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#0F172A" }} />
        <Bar dataKey="Pedidos com Quiz" fill="#10B981" radius={[8, 8, 0, 0]} animationDuration={800} />
        <Bar dataKey="Pedidos sem Quiz" fill="#64748B" radius={[8, 8, 0, 0]} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}

