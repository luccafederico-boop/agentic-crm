export function CompanyLogo({
  name,
  domain,
  size = 24,
}: {
  name: string;
  domain?: string | null;
  size?: number;
}) {
  if (domain) {
    return (
      // biome-ignore lint/performance/noImgElement: hotlinked favicon for Phase 1; mirrored to Supabase Storage in Phase 3
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded"
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
