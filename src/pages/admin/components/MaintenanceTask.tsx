import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "@/lib/icons";
import { useState } from "react";

interface MaintenanceTaskProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  recordsToDelete?: number;
  loading?: boolean;
  onExecute: () => Promise<void>;
}

export default function MaintenanceTask({
  icon,
  title,
  description,
  recordsToDelete,
  loading = false,
  onExecute
}: MaintenanceTaskProps) {
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute();
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card className="mobile-compact-card">
      <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 md:p-4 gap-3">
        <div className="flex items-start gap-2 md:gap-3 flex-1 w-full">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm md:text-base">{title}</p>
            <p className="text-xs md:text-sm text-muted-foreground">{description}</p>
            {recordsToDelete !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {recordsToDelete} registro(s) serão deletados
                </p>
              </div>
            )}
          </div>
        </div>
        <Button 
          variant="default"
          size="default"
          onClick={handleExecute}
          disabled={executing || loading}
          className="w-full md:w-auto shrink-0"
        >
          {executing ? 'Executando...' : 'Executar'}
        </Button>
      </CardContent>
    </Card>
  );
}
