import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  color?: string | null; // HSL triplet, e.g. "221 83% 53%"
  slug?: string | null;
  to?: string; // optional explicit link target
  className?: string;
};

const ProgramBadge = ({ name, color, slug, to, className }: Props) => {
  const hsl = color || "221 83% 53%";
  const style: React.CSSProperties = {
    backgroundColor: `hsl(${hsl} / 0.12)`,
    color: `hsl(${hsl})`,
    borderColor: `hsl(${hsl} / 0.35)`,
  };
  const content = (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: `hsl(${hsl})` }}
      />
      {name}
    </span>
  );
  const href = to ?? (slug ? `/mentee/programs/${slug}` : null);
  if (!href) return content;
  return (
    <Link to={href} className="hover:opacity-80 transition-opacity">
      {content}
    </Link>
  );
};

export default ProgramBadge;
