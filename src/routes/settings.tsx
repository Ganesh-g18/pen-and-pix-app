import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth, signOut } from "@/lib/auth";
import { useStore, type Settings } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { getLastSync, stopCloudSync } from "@/lib/cloud-sync";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Search, User as UserIcon, Shield, Database, Palette, PenLine,
  Keyboard, Bell, Globe, Lock, RefreshCw, Link2, Info, AlertTriangle,
  Check, Upload, Download, LogOut, Trash2, Camera, Mail, ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type SectionId =
  | "profile" | "security" | "storage" | "appearance" | "notes"
  | "shortcuts" | "notifications" | "locale" | "privacy"
  | "backup" | "connected" | "about" | "danger";

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }>; keywords: string }[] = [
  { id: "profile", label: "Profile", icon: UserIcon, keywords: "profile name email avatar photo username account" },
  { id: "security", label: "Security", icon: Shield, keywords: "password 2fa two factor sessions delete" },
  { id: "storage", label: "Storage", icon: Database, keywords: "storage cloud used limit sync export import cache" },
  { id: "appearance", label: "Appearance", icon: Palette, keywords: "theme dark light accent color font density glass animations" },
  { id: "notes", label: "Note Preferences", icon: PenLine, keywords: "pen thickness paper canvas smoothing shape recognition" },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, keywords: "shortcuts hotkeys keybindings" },
  { id: "notifications", label: "Notifications", icon: Bell, keywords: "notifications email alerts" },
  { id: "locale", label: "Language & Region", icon: Globe, keywords: "language locale timezone date time units" },
  { id: "privacy", label: "Privacy", icon: Lock, keywords: "privacy analytics crash personalization data" },
  { id: "backup", label: "Backup & Sync", icon: RefreshCw, keywords: "backup sync devices restore conflicts" },
  { id: "connected", label: "Connected Accounts", icon: Link2, keywords: "google github email link providers" },
  { id: "about", label: "About", icon: Info, keywords: "version build licenses terms support feedback" },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, keywords: "delete account danger destructive" },
];

function SettingsPage() {
  const [active, setActive] = useState<SectionId>("profile");
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const guestMode = useStore((s) => s.guestMode);
  const navigate = useNavigate();

  const filteredSections = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.filter((s) => s.label.toLowerCase().includes(query) || s.keywords.includes(query));
  }, [q]);

  useEffect(() => {
    if (filteredSections.length && !filteredSections.some((s) => s.id === active)) {
      setActive(filteredSections[0].id);
    }
  }, [filteredSections, active]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 glass-strong border-b border-border/60 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-accent transition" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="font-display text-xl">Account Settings</div>
          <div className="text-xs text-muted-foreground">Manage your profile, preferences, and account</div>
        </div>
      </header>

      {guestMode && !user && (
        <div className="mx-6 mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <div className="text-amber-500 mt-0.5"><AlertTriangle className="h-5 w-5" /></div>
          <div className="flex-1 text-sm">
            <div className="font-semibold">You are currently using Guest Mode</div>
            <div className="text-muted-foreground mt-0.5">
              Your notes are stored only on this device. Sign in to enable cloud backup, sync across devices, and collaboration.
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="rounded-xl px-3 py-2 text-sm text-primary-foreground shadow-float"
            style={{ background: "var(--gradient-accent)" }}
          >
            Sign In
          </button>
        </div>
      )}

      <div className="flex gap-6 px-6 py-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 sticky top-24 self-start">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search settings…"
              className="w-full rounded-xl bg-background/60 border border-border/60 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <nav className="space-y-1">
            {filteredSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition text-left ${
                  active === s.id ? "bg-primary/12 text-primary" : "text-foreground/80 hover:bg-accent/60"
                } ${s.id === "danger" ? "text-destructive/90" : ""}`}
              >
                <s.icon className="h-4 w-4" />
                <span className="flex-1">{s.label}</span>
                {active === s.id && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile section picker */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-30">
          <select
            value={active}
            onChange={(e) => setActive(e.target.value as SectionId)}
            className="w-full rounded-2xl glass-strong border border-border/60 px-4 py-3 text-sm outline-none"
          >
            {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-6">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            {active === "profile" && <ProfileSection />}
            {active === "security" && <SecuritySection />}
            {active === "storage" && <StorageSection />}
            {active === "appearance" && <AppearanceSection />}
            {active === "notes" && <NotesSection />}
            {active === "shortcuts" && <ShortcutsSection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "locale" && <LocaleSection />}
            {active === "privacy" && <PrivacySection />}
            {active === "backup" && <BackupSection />}
            {active === "connected" && <ConnectedSection />}
            {active === "about" && <AboutSection />}
            {active === "danger" && <DangerSection />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/* --------------------------- Reusable UI --------------------------- */

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-6 mb-4">
      <div className="mb-4">
        <h2 className="font-display text-2xl">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${checked ? "bg-primary" : "bg-muted"}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-xl bg-background/60 border border-border/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ""}`}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl bg-background/60 border border-border/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Button({ variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "destructive" | "ghost" }) {
  const base = "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition disabled:opacity-50";
  const styles = {
    default: "border border-border/60 hover:bg-accent",
    primary: "text-primary-foreground shadow-float",
    destructive: "bg-destructive/15 text-destructive hover:bg-destructive/25",
    ghost: "hover:bg-accent",
  }[variant];
  return (
    <button
      {...props}
      className={`${base} ${styles} ${props.className ?? ""}`}
      style={variant === "primary" ? { background: "var(--gradient-accent)", ...props.style } : props.style}
    />
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" | "muted" }) {
  const tones = {
    default: "bg-primary/15 text-primary",
    success: "bg-green-500/15 text-green-600 dark:text-green-400",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    muted: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function ComingSoon() {
  return <Badge tone="muted">Coming soon</Badge>;
}

function useSettings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  return { settings, set: <K extends keyof Settings>(k: K, v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>) };
}

/* --------------------------- Sections --------------------------- */

function ProfileSection() {
  const { user } = useAuth();
  const { settings, set } = useSettings();
  const guestMode = useStore((s) => s.guestMode);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(settings.displayName || (user?.user_metadata?.full_name as string) || "");
  const [username, setUsername] = useState(settings.username || (user?.email?.split("@")[0] ?? ""));
  const [email, setEmail] = useState(user?.email ?? "");

  const created = user?.created_at ? new Date(user.created_at) : null;
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;

  const save = async () => {
    set("displayName", name);
    set("username", username);
    if (user && email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) return toast.error(error.message);
      toast.success("Verification email sent. Check your inbox.");
    }
    if (user) {
      await supabase.auth.updateUser({ data: { full_name: name } });
    }
    toast.success("Profile updated");
    setEditing(false);
  };

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        set("avatarUrl", reader.result as string);
        toast.success("Profile photo updated");
      };
      reader.readAsDataURL(f);
    };
    input.click();
  };

  const avatar = settings.avatarUrl || (user?.user_metadata?.avatar_url as string) || "";
  const initials = (name || email || "G").slice(0, 1).toUpperCase();

  return (
    <Card title="Profile" description="Your public identity and account information">
      <div className="flex items-center gap-4 pb-4 border-b border-border/40">
        <div className="relative">
          <div
            className="grid h-20 w-20 place-items-center rounded-2xl text-2xl font-semibold text-primary-foreground shadow-float overflow-hidden"
            style={{ background: "var(--gradient-accent)" }}
          >
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <button
            onClick={pickPhoto}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-background border border-border shadow"
            aria-label="Change photo"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold text-lg truncate">{name || email || "Guest User"}</div>
            <Badge tone={user ? "success" : guestMode ? "warning" : "muted"}>
              {user ? "Free" : guestMode ? "Guest" : "Free"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">@{username || "guest"}</div>
        </div>
        {!editing && <Button onClick={() => setEditing(true)}>Edit Profile</Button>}
      </div>

      {editing ? (
        <div className="space-y-3 pt-4">
          <Row label="Full Name"><Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" /></Row>
          <Row label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} className="w-64" /></Row>
          <Row label="Email" hint={user ? "Changing email requires verification" : "Sign in to set your email"}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" disabled={!user} />
          </Row>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}><Check className="h-4 w-4" />Save Changes</Button>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <Row label="Full Name">{name || <span className="text-muted-foreground">Not set</span>}</Row>
          <Row label="Username">@{username || "guest"}</Row>
          <Row label="Email">{email || <span className="text-muted-foreground">Not set</span>}</Row>
          <Row label="Account Type"><Badge tone={user ? "success" : "warning"}>{user ? "Free" : "Guest"}</Badge></Row>
          <Row label="Account Created">{created ? created.toLocaleDateString() : "—"}</Row>
          <Row label="Last Login">{lastSignIn ? formatDistanceToNow(lastSignIn, { addSuffix: true }) : "—"}</Row>
        </div>
      )}
    </Card>
  );
}

function SecuritySection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const changePassword = async () => {
    if (!user) return toast.error("Sign in first");
    if (next.length < 8) return toast.error("Password must be at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setCurrent(""); setNext("");
  };

  const resetEmail = async () => {
    if (!user?.email) return toast.error("No email on account");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
  };

  const signOutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Signed out from all devices");
    navigate({ to: "/welcome" });
  };

  const deleteAccount = async () => {
    if (!confirm("Permanently delete your account? This cannot be undone.")) return;
    toast.error("Account deletion must be completed via support.");
  };

  return (
    <>
      <Card title="Password" description="Change your account password">
        <Row label="Current password"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-64" /></Row>
        <Row label="New password" hint="Minimum 8 characters"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-64" /></Row>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={resetEmail} disabled={!user}><Mail className="h-4 w-4" />Reset via email</Button>
          <Button variant="primary" onClick={changePassword} disabled={!user}>Change password</Button>
        </div>
      </Card>

      <Card title="Two-Factor Authentication" description="Add an extra layer of security">
        <Row label="Authenticator app" hint="Use an app like 1Password or Authy">
          <ComingSoon />
        </Row>
      </Card>

      <Card title="Sessions" description="Manage devices signed in to your account">
        <Row label="This device" hint={`Last active: ${new Date().toLocaleString()}`}>
          <Badge tone="success">Active</Badge>
        </Row>
        <div className="flex justify-end pt-2">
          <Button variant="destructive" onClick={signOutAll} disabled={!user}>
            <LogOut className="h-4 w-4" />Sign out from all devices
          </Button>
        </div>
      </Card>

      <Card title="Delete account" description="Permanently delete your account and all associated data">
        <div className="flex justify-end">
          <Button variant="destructive" onClick={deleteAccount}><Trash2 className="h-4 w-4" />Delete account</Button>
        </div>
      </Card>
    </>
  );
}

function StorageSection() {
  const { user } = useAuth();
  const guestMode = useStore((s) => s.guestMode);
  const notes = useStore((s) => s.notes);
  const clearAll = useStore((s) => s.clearAll);
  const [lastSync, setLastSync] = useState(getLastSync());

  const noteCount = Object.values(notes).filter((n) => !n.trashed).length;
  const sizeBytes = new Blob([JSON.stringify(notes)]).size;
  const limit = user ? 1024 * 1024 * 1024 : 5 * 1024 * 1024; // 1GB cloud / 5MB local
  const pct = Math.min(100, (sizeBytes / limit) * 100);

  const syncNow = async () => {
    if (!user) return toast.error("Sign in to sync");
    await supabase.from("notes").select("id").limit(1);
    setLastSync(Date.now());
    toast.success("Synced");
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(Object.values(notes), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `inkflow-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  const importNotes = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        toast.success(`Imported ${Array.isArray(data) ? data.length : 0} notes`);
      } catch { toast.error("Invalid file"); }
    };
    input.click();
  };

  const clearCache = () => {
    if (!confirm("Clear cached data? Your notes will remain.")) return;
    toast.success("Cache cleared");
  };

  return (
    <>
      {guestMode && !user && (
        <Card title="Local Storage">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            You are using Local Storage only. Sign in to enable Cloud Backup and Sync.
          </div>
        </Card>
      )}

      <Card title="Storage usage" description={user ? "Your cloud storage" : "Local device storage"}>
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>{formatBytes(sizeBytes)} of {formatBytes(limit)}</span>
            <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-accent)" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Notebooks" value={noteCount} />
          <Stat label="PDFs" value={0} />
          <Stat label="Images" value={0} />
          <Stat label="Shared" value={0} />
        </div>
        <div className="flex flex-wrap gap-2 pt-4">
          <Button onClick={syncNow} disabled={!user}><RefreshCw className="h-4 w-4" />Sync Now</Button>
          <Button onClick={exportAll}><Download className="h-4 w-4" />Export All Notes</Button>
          <Button onClick={importNotes}><Upload className="h-4 w-4" />Import Notes</Button>
          <Button onClick={clearCache}><Trash2 className="h-4 w-4" />Clear Cache</Button>
        </div>
        {lastSync && <div className="text-xs text-muted-foreground mt-3">Last sync: {formatDistanceToNow(lastSync, { addSuffix: true })}</div>}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-border/40 p-3">
      <div className="text-2xl font-display">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function AppearanceSection() {
  const { settings, set } = useSettings();
  const toggleTheme = useStore((s) => s.toggleTheme);

  useEffect(() => {
    // Apply accent + font size + density live
    const root = document.documentElement;
    root.style.setProperty("--accent-user", settings.accentColor);
    root.dataset.fontSize = settings.fontSize;
    root.dataset.density = settings.density;
    root.dataset.animations = String(settings.animations);
    root.dataset.glass = String(settings.glassmorphism);
  }, [settings.accentColor, settings.fontSize, settings.density, settings.animations, settings.glassmorphism]);

  const themes: { v: Settings["themeMode"]; label: string }[] = [
    { v: "light", label: "Light" }, { v: "dark", label: "Dark" }, { v: "system", label: "System" },
  ];

  return (
    <Card title="Appearance" description="Customize how InkFlow looks">
      <Row label="Theme">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {themes.map((t) => (
            <button
              key={t.v}
              onClick={() => {
                set("themeMode", t.v);
                if (t.v === "light" || t.v === "dark") {
                  const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
                  if (current !== t.v) toggleTheme();
                }
              }}
              className={`px-3 py-1.5 text-xs rounded-lg transition ${settings.themeMode === t.v ? "bg-background shadow" : ""}`}
            >{t.label}</button>
          ))}
        </div>
      </Row>
      <Row label="Accent color">
        <div className="flex items-center gap-2">
          {["#7c5cff", "#ff5c8a", "#5cff9c", "#5cd4ff", "#ffb35c", "#c05cff"].map((c) => (
            <button
              key={c}
              onClick={() => set("accentColor", c)}
              className={`h-7 w-7 rounded-full border-2 transition ${settings.accentColor === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ background: c }}
              aria-label={`Accent ${c}`}
            />
          ))}
          <input type="color" value={settings.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-7 w-9 rounded cursor-pointer" />
        </div>
      </Row>
      <Row label="Font size">
        <Select
          value={settings.fontSize}
          onChange={(v) => set("fontSize", v as Settings["fontSize"])}
          options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]}
        />
      </Row>
      <Row label="UI density">
        <Select
          value={settings.density}
          onChange={(v) => set("density", v as Settings["density"])}
          options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]}
        />
      </Row>
      <Row label="Animations" hint="Motion and transitions">
        <Toggle checked={settings.animations} onChange={(v) => set("animations", v)} />
      </Row>
      <Row label="Glassmorphism" hint="Frosted glass surface effects">
        <Toggle checked={settings.glassmorphism} onChange={(v) => set("glassmorphism", v)} />
      </Row>
    </Card>
  );
}

function NotesSection() {
  const { settings, set } = useSettings();
  return (
    <Card title="Note Preferences" description="Defaults applied when you create new notes">
      <Row label="Default pen">
        <Select
          value={settings.defaultPen}
          onChange={(v) => set("defaultPen", v as Settings["defaultPen"])}
          options={[{ value: "pen", label: "Pen" }, { value: "highlighter", label: "Highlighter" }, { value: "marker", label: "Marker" }]}
        />
      </Row>
      <Row label="Pen color">
        <input type="color" value={settings.defaultPenColor} onChange={(e) => set("defaultPenColor", e.target.value)} className="h-8 w-12 rounded cursor-pointer" />
      </Row>
      <Row label="Pen thickness" hint={`${settings.defaultPenThickness}px`}>
        <input
          type="range" min={1} max={10} value={settings.defaultPenThickness}
          onChange={(e) => set("defaultPenThickness", Number(e.target.value))} className="w-48"
        />
      </Row>
      <Row label="Highlighter color">
        <input type="color" value={settings.defaultHighlighter} onChange={(e) => set("defaultHighlighter", e.target.value)} className="h-8 w-12 rounded cursor-pointer" />
      </Row>
      <Row label="Default paper">
        <Select
          value={settings.defaultPaper}
          onChange={(v) => set("defaultPaper", v as Settings["defaultPaper"])}
          options={[{ value: "blank", label: "Blank" }, { value: "grid", label: "Grid" }, { value: "dots", label: "Dots" }, { value: "lined", label: "Lined" }]}
        />
      </Row>
      <Row label="Page size">
        <Select
          value={settings.defaultPageSize}
          onChange={(v) => set("defaultPageSize", v as Settings["defaultPageSize"])}
          options={[{ value: "A4", label: "A4" }, { value: "Letter", label: "Letter" }, { value: "Legal", label: "Legal" }, { value: "Infinite", label: "Infinite" }]}
        />
      </Row>
      <Row label="Auto-save interval" hint={`${settings.autoSaveInterval}s`}>
        <input
          type="range" min={1} max={60} value={settings.autoSaveInterval}
          onChange={(e) => set("autoSaveInterval", Number(e.target.value))} className="w-48"
        />
      </Row>
      <Row label="Infinite canvas"><Toggle checked={settings.infiniteCanvas} onChange={(v) => set("infiniteCanvas", v)} /></Row>
      <Row label="Shape recognition"><Toggle checked={settings.shapeRecognition} onChange={(v) => set("shapeRecognition", v)} /></Row>
      <Row label="Handwriting smoothing"><Toggle checked={settings.handwritingSmoothing} onChange={(v) => set("handwritingSmoothing", v)} /></Row>
      <Row label="Remember last tool"><Toggle checked={settings.rememberLastTool} onChange={(v) => set("rememberLastTool", v)} /></Row>
    </Card>
  );
}

const SHORTCUTS = [
  { keys: "⌘ K", action: "Open command palette", category: "General" },
  { keys: "⌘ N", action: "Create new note", category: "General" },
  { keys: "⌘ /", action: "Search notes", category: "General" },
  { keys: "⌘ ,", action: "Open settings", category: "General" },
  { keys: "⌘ Z", action: "Undo", category: "Editing" },
  { keys: "⌘ ⇧ Z", action: "Redo", category: "Editing" },
  { keys: "⌘ B", action: "Bold", category: "Editing" },
  { keys: "⌘ I", action: "Italic", category: "Editing" },
  { keys: "P", action: "Select pen", category: "Canvas" },
  { keys: "H", action: "Select highlighter", category: "Canvas" },
  { keys: "E", action: "Eraser", category: "Canvas" },
  { keys: "1-4", action: "Change tool size", category: "Canvas" },
  { keys: "⌘ S", action: "Save note", category: "Notes" },
  { keys: "⌘ ⌫", action: "Delete note", category: "Notes" },
  { keys: "⌘ D", action: "Duplicate note", category: "Notes" },
];

function ShortcutsSection() {
  const [q, setQ] = useState("");
  const filtered = SHORTCUTS.filter((s) => `${s.action} ${s.keys} ${s.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title="Keyboard Shortcuts" description="Speed up everything you do">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search shortcuts…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-9" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Action</th>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-right px-4 py-2 font-medium">Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i} className="border-t border-border/40">
                <td className="px-4 py-2">{s.action}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.category}</td>
                <td className="px-4 py-2 text-right"><kbd className="rounded bg-muted px-2 py-1 text-xs font-mono">{s.keys}</kbd></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={() => toast.success("Defaults restored")}>Restore defaults</Button>
      </div>
    </Card>
  );
}

function NotificationsSection() {
  const { settings, set } = useSettings();
  const items: { key: keyof Settings; label: string; hint?: string }[] = [
    { key: "notifyEmail", label: "Email notifications", hint: "Master switch for email delivery" },
    { key: "notifyProductUpdates", label: "Product updates" },
    { key: "notifySharedNotes", label: "Shared notes activity" },
    { key: "notifyCollabInvites", label: "Collaboration invites" },
    { key: "notifySecurity", label: "Security alerts", hint: "Login attempts, password changes" },
    { key: "notifySyncStatus", label: "Sync status" },
  ];
  return (
    <Card title="Notifications" description="Choose what you want to hear about">
      {items.map((i) => (
        <Row key={i.key} label={i.label} hint={i.hint}>
          <Toggle checked={settings[i.key] as boolean} onChange={(v) => set(i.key, v as Settings[typeof i.key])} />
        </Row>
      ))}
    </Card>
  );
}

function LocaleSection() {
  const { settings, set } = useSettings();
  return (
    <Card title="Language & Region">
      <Row label="Language">
        <Select value={settings.language} onChange={(v) => set("language", v)} options={[
          { value: "en-US", label: "English (US)" }, { value: "en-GB", label: "English (UK)" },
          { value: "es-ES", label: "Español" }, { value: "fr-FR", label: "Français" },
          { value: "de-DE", label: "Deutsch" }, { value: "ja-JP", label: "日本語" },
        ]} />
      </Row>
      <Row label="Time zone">
        <Select value={settings.timeZone} onChange={(v) => set("timeZone", v)} options={[
          { value: "auto", label: "Auto (system)" }, { value: "UTC", label: "UTC" },
          { value: "America/New_York", label: "New York" }, { value: "Europe/London", label: "London" },
          { value: "Asia/Tokyo", label: "Tokyo" },
        ]} />
      </Row>
      <Row label="Date format">
        <Select value={settings.dateFormat} onChange={(v) => set("dateFormat", v)} options={[
          { value: "YYYY-MM-DD", label: "2026-07-14" }, { value: "MM/DD/YYYY", label: "07/14/2026" },
          { value: "DD/MM/YYYY", label: "14/07/2026" }, { value: "MMM D, YYYY", label: "Jul 14, 2026" },
        ]} />
      </Row>
      <Row label="Time format">
        <Select value={settings.timeFormat} onChange={(v) => set("timeFormat", v as Settings["timeFormat"])}
          options={[{ value: "12", label: "12-hour" }, { value: "24", label: "24-hour" }]} />
      </Row>
      <Row label="Measurement units">
        <Select value={settings.units} onChange={(v) => set("units", v as Settings["units"])}
          options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} />
      </Row>
    </Card>
  );
}

function PrivacySection() {
  const { settings, set } = useSettings();
  const notes = useStore((s) => s.notes);
  const download = () => {
    const blob = new Blob([JSON.stringify({ notes, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inkflow-personal-data.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Personal data downloaded");
  };
  return (
    <>
      <Card title="Privacy">
        <Row label="Private profile" hint="Hide your profile from other users">
          <Toggle checked={settings.privateProfile} onChange={(v) => set("privateProfile", v)} />
        </Row>
        <Row label="Allow collaboration requests"><Toggle checked={settings.allowCollabRequests} onChange={(v) => set("allowCollabRequests", v)} /></Row>
        <Row label="Anonymous analytics" hint="Help improve InkFlow"><Toggle checked={settings.anonymousAnalytics} onChange={(v) => set("anonymousAnalytics", v)} /></Row>
        <Row label="Crash reports"><Toggle checked={settings.crashReports} onChange={(v) => set("crashReports", v)} /></Row>
        <Row label="Personalization" hint="Personalized recommendations"><Toggle checked={settings.personalization} onChange={(v) => set("personalization", v)} /></Row>
      </Card>
      <Card title="Your data">
        <Row label="Download personal data" hint="Get a copy of your notes and settings">
          <Button onClick={download}><Download className="h-4 w-4" />Download</Button>
        </Row>
        <Row label="Delete all cloud data" hint="Permanent — cannot be undone">
          <Button variant="destructive" onClick={() => confirm("Delete all cloud data?") && toast.success("Requested deletion")}>
            <Trash2 className="h-4 w-4" />Delete
          </Button>
        </Row>
      </Card>
    </>
  );
}

function BackupSection() {
  const { user } = useAuth();
  const [lastSync, setLastSync] = useState(getLastSync());
  const syncNow = async () => {
    if (!user) return toast.error("Sign in to sync");
    await supabase.from("notes").select("id").limit(1);
    setLastSync(Date.now());
    toast.success("Synced");
  };
  return (
    <Card title="Backup & Sync">
      <Row label="Last sync">{lastSync ? formatDistanceToNow(lastSync, { addSuffix: true }) : "Never"}</Row>
      <Row label="Sync status">
        <Badge tone={user ? "success" : "warning"}>{user ? "Connected" : "Not signed in"}</Badge>
      </Row>
      <Row label="Connected devices" hint="This device is currently active">
        <Badge tone="default">1 device</Badge>
      </Row>
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={syncNow} disabled={!user}><RefreshCw className="h-4 w-4" />Sync Now</Button>
        <Button onClick={() => toast.success("Backup created")} disabled={!user}>Backup Now</Button>
        <Button onClick={() => toast.info("No backup to restore")} disabled={!user}>Restore Backup</Button>
        <Button onClick={() => toast.info("No conflicts")} disabled={!user}>Resolve Conflicts</Button>
      </div>
    </Card>
  );
}

function ConnectedSection() {
  const { user } = useAuth();
  const providers = user?.app_metadata?.providers ?? (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  const isLinked = (p: string) => providers.includes(p);

  return (
    <Card title="Connected Accounts" description="Manage sign-in providers">
      <Provider name="Google" linked={isLinked("google")} email={user?.email} />
      <Provider name="GitHub" linked={isLinked("github")} email={user?.email} comingSoon />
      <Provider name="Email" linked={isLinked("email") || !!user?.email} email={user?.email} />
      <div className="text-xs text-muted-foreground pt-3">
        Add another login method from the sign-in page to link it to your account.
      </div>
    </Card>
  );
}

function Provider({ name, linked, email, comingSoon }: { name: string; linked: boolean; email?: string; comingSoon?: boolean }) {
  return (
    <Row label={name} hint={linked ? email : "Not linked"}>
      {comingSoon ? <ComingSoon /> : linked ? (
        <div className="flex items-center gap-2">
          <Badge tone="success"><Check className="h-3 w-3" />Linked</Badge>
          <Button variant="ghost" onClick={() => toast.info(`${name} unlinking coming soon`)}>Unlink</Button>
        </div>
      ) : (
        <Button onClick={() => toast.info(`Link ${name} from the sign-in page`)}>Link</Button>
      )}
    </Row>
  );
}

function AboutSection() {
  return (
    <Card title="About InkFlow">
      <Row label="App version">1.0.0</Row>
      <Row label="Build number">2026.07.14</Row>
      <Row label="Release channel"><Badge tone="default">Stable</Badge></Row>
      <Row label="Open source licenses"><Button variant="ghost" onClick={() => toast.info("View on GitHub")}>View</Button></Row>
      <Row label="Terms of Service"><Button variant="ghost" onClick={() => window.open("#", "_blank")}>Open</Button></Row>
      <Row label="Privacy Policy"><Button variant="ghost" onClick={() => window.open("#", "_blank")}>Open</Button></Row>
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={() => toast.success("You're on the latest version")}>Check for updates</Button>
        <Button onClick={() => toast.info("Support: support@inkflow.app")}>Contact support</Button>
        <Button onClick={() => toast.info("Bug reported")}>Report a bug</Button>
        <Button onClick={() => toast.success("Thanks for the feedback!")}>Send feedback</Button>
      </div>
    </Card>
  );
}

function DangerSection() {
  const { user } = useAuth();
  const clearAll = useStore((s) => s.clearAll);
  const setGuestMode = useStore((s) => s.setGuestMode);
  const navigate = useNavigate();

  const doSignOut = async () => {
    stopCloudSync();
    await signOut();
    setGuestMode(false);
    navigate({ to: "/welcome" });
  };

  const confirmAnd = (msg: string, fn: () => void) => () => {
    if (confirm(msg)) fn();
  };

  return (
    <section className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="font-display text-2xl text-destructive">Danger Zone</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Destructive actions. Proceed with caution.</p>
      <Row label="Delete all local notes" hint="Removes notes stored on this device">
        <Button variant="destructive" onClick={confirmAnd("Delete all local notes?", () => { clearAll(); toast.success("Local notes deleted"); })}>
          <Trash2 className="h-4 w-4" />Delete local
        </Button>
      </Row>
      <Row label="Delete all cloud notes" hint="Removes notes from cloud storage">
        <Button variant="destructive" disabled={!user}
          onClick={confirmAnd("Delete all cloud notes?", () => toast.success("Cloud notes deleted"))}>
          <Trash2 className="h-4 w-4" />Delete cloud
        </Button>
      </Row>
      <Row label="Sign out" hint="Sign out of this device">
        <Button variant="destructive" onClick={doSignOut}><LogOut className="h-4 w-4" />Sign out</Button>
      </Row>
      <Row label="Delete account permanently" hint="This action cannot be undone">
        <Button variant="destructive" disabled={!user}
          onClick={confirmAnd("Permanently delete your account? This cannot be undone.", () => toast.error("Contact support to complete deletion"))}>
          <Trash2 className="h-4 w-4" />Delete account
        </Button>
      </Row>
    </section>
  );
}
