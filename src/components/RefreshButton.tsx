import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onClick: () => void;
  spinning?: boolean;
  className?: string;
}

const RefreshButton = ({ onClick, spinning, className }: Props) => (
  <Button variant="outline" size="sm" onClick={onClick} disabled={spinning} className={cn("gap-2 shrink-0", className)}>
    <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
    Refresh
  </Button>
);

export default RefreshButton;
