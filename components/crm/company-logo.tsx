import { logoPublicUrl } from "@/lib/supabase/storage";

export function CompanyLogo({
  name,
  domain,
  logoPath,
  size = 24,
}: {
  name: string;
  domain?: string | null;
  logoPath?: string | null;
  size?: number;
}) {
  // Prefer the mirrored copy in Supabase Storage (visible-lane agent task);
  // fall back to the favicon hotlink until the mirror task has run.
  const src = logoPath
    ? logoPublicUrl(logoPath)
    : domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
      : null;

  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: tiny favicon-size images; optimization overhead not worth it
      <img
        src={src}
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
