interface Props {
  title: string;
  count?: number;
  subtitle?: string;
}

export default function SessionSectionHeader({ title, count, subtitle }: Props) {
  return (
    <div className="flex items-baseline gap-2 px-1 pb-2 pt-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">· {count}</span>
      )}
      {subtitle && (
        <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}
