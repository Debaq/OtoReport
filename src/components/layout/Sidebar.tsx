import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  FilePlus,
  ClipboardList,
  BookOpen,
  GraduationCap,
  Settings,
  AudioLines,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isBetaEnabled } from "@/hooks/useBetaFeatures";

type SidebarItem =
  | { type: "link"; to: string; icon: typeof LayoutDashboard; label: string; badge?: string }
  | { type: "separator" };

export function Sidebar() {
  const { t } = useTranslation();

  const items: SidebarItem[] = [
    { type: "link", to: "/", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { type: "link", to: "/patients", icon: Users, label: t("sidebar.patients") },
    { type: "link", to: "/new-report", icon: FilePlus, label: t("sidebar.newReport") },
    { type: "link", to: "/new-audiometry", icon: AudioLines, label: t("sidebar.newAudiometry") },
    { type: "link", to: "/history", icon: ClipboardList, label: t("sidebar.history") },
    { type: "separator" },
    { type: "link", to: "/findings-library", icon: BookOpen, label: t("sidebar.findingsLibrary") },
    ...(isBetaEnabled("education")
      ? [{ type: "link" as const, to: "/education", icon: GraduationCap, label: t("sidebar.education"), badge: "Beta" }]
      : []),
    { type: "separator" },
    { type: "link", to: "/settings", icon: Settings, label: t("sidebar.settings") },
  ];

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border-secondary bg-bg-secondary">
      <div
        className="flex h-10 items-center justify-center border-b border-border-secondary select-none"
        data-tauri-drag-region
      >
        <img src="/logo.png" alt="OtoReport" className="h-5 w-5 pointer-events-none" data-tauri-drag-region />
        <h1 className="ml-2 text-sm font-bold text-accent-text pointer-events-none" data-tauri-drag-region>OtoReport</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item, i) =>
          item.type === "separator" ? (
            <div key={`sep-${i}`} className="my-2 border-t border-border-secondary" />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent-subtle text-accent-text"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                )
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  );
}
