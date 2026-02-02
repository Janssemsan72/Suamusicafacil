import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SystemInfoCardProps {
  title: string;
  icon: React.ReactNode;
  items: {
    label: string;
    value: string | number;
  }[];
}

export default function SystemInfoCard({
  title,
  icon,
  items
}: SystemInfoCardProps) {
  return (
    <Card className="mobile-compact-card apple-card">
      <CardHeader className="p-4 md:p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 md:h-6 md:w-6 text-primary">{icon}</div>
          <CardTitle className="text-base md:text-lg font-semibold tracking-tight">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-4 md:pt-6">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center py-1">
            <span className="text-xs md:text-sm text-muted-foreground font-medium">{item.label}</span>
            <span className="text-xs md:text-sm font-semibold tracking-tight">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
