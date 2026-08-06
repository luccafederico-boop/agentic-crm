import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Plain GET form — zero client JS, works with searchParams. */
export function SearchForm({
  placeholder,
  defaultValue,
}: {
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <form className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="pl-8"
      />
    </form>
  );
}
