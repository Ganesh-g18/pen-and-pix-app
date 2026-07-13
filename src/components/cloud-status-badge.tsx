import { useEffect, useState } from "react";
import { subscribeStatus, type CloudStatus } from "@/lib/cloud-sync";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Cloud, CloudOff, Loader2, HardDrive } from "lucide-react";

export function CloudStatusBadge() {
  const { user } = useAuth();
  const guestMode = useStore((s) => s.guestMode);
  const [status, setStatus] = useState<CloudStatus>("idle");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => subscribeStatus(setStatus), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!user && !guestMode) return null;

  let dot = "bg-orange-500";
  let label = "Local Only";
  let Icon: typeof Cloud = HardDrive;

  if (!online) {
    dot = "bg-red-500";
    label = "Offline";
    Icon = CloudOff;
  } else if (user) {
    if (status === "syncing") {
      dot = "bg-blue-500 animate-pulse";
      label = "Syncing…";
      Icon = Loader2;
    } else if (status === "error") {
      dot = "bg-red-500";
      label = "Sync error";
      Icon = CloudOff;
    } else {
      dot = "bg-green-500";
      label = "Cloud Synced";
      Icon = Cloud;
    }
  }

  return (
    <div className="hidden sm:inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[11px] text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <Icon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />
      {label}
    </div>
  );
}
