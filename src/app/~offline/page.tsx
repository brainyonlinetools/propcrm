import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          Anand Prime CRM needs an internet connection for live lead and inventory data.
        </p>
      </div>
      <Button asChild>
        <Link href="/leads">Try again</Link>
      </Button>
    </div>
  );
}
