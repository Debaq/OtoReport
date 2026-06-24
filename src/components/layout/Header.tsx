import { useState, useRef, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTranslation } from "react-i18next";
import { LogOut, ChevronDown, Minus, Square, X, Copy, Languages } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isDesktop } from "@/lib/platform";
import { SpriteAvatar } from "@/components/ui/SpriteAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { activeProfile, config, profiles, clearProfileSelection } = useWorkspace();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const displayName = activeProfile?.name || config?.examiner || "";
  const profileColor = activeProfile?.color || "#3B82F6";
  const hasMultipleProfiles = profiles.length > 1;

  useEffect(() => {
    isDesktop().then(setShowControls);
  }, []);

  useEffect(() => {
    if (!showControls) return;
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => {
      win.isMaximized().then(setMaximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [showControls]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    if (open || langOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, langOpen]);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => setConfirmClose(true);

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setLangOpen(false);
  };

  return (
    <header
      className="flex h-10 items-center justify-between border-b border-border-secondary bg-bg-secondary pl-4 select-none"
      data-tauri-drag-region
    >
      <h2
        className="text-sm font-semibold text-text-primary pointer-events-none"
        data-tauri-drag-region
      >
        {title}
      </h2>

      <div className="flex items-center">
        <div className="relative mr-2" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            title="Language"
          >
            <Languages size={14} />
            <span className="text-[10px] uppercase font-bold">{i18n.language.split('-')[0]}</span>
          </button>
          
          {langOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-24 rounded-lg border border-border-secondary bg-bg-secondary py-1 shadow-lg">
              <button
                onClick={() => toggleLanguage("es")}
                className={`flex w-full items-center px-3 py-1.5 text-xs ${i18n.language.startsWith("es") ? "text-accent-text bg-accent-subtle" : "text-text-secondary hover:bg-bg-tertiary"}`}
              >
                Español
              </button>
              <button
                onClick={() => toggleLanguage("en")}
                className={`flex w-full items-center px-3 py-1.5 text-xs ${i18n.language.startsWith("en") ? "text-accent-text bg-accent-subtle" : "text-text-secondary hover:bg-bg-tertiary"}`}
              >
                English
              </button>
            </div>
          )}
        </div>

        {displayName && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => hasMultipleProfiles && setOpen(!open)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${
                hasMultipleProfiles ? "hover:bg-bg-tertiary cursor-pointer" : "cursor-default"
              }`}
            >
              <SpriteAvatar
                avatar={activeProfile?.avatar}
                name={displayName}
                color={profileColor}
                size={24}
              />
              <span className="text-xs text-text-tertiary">{displayName}</span>
              {hasMultipleProfiles && (
                <ChevronDown size={12} className={`text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border-secondary bg-bg-secondary py-1 shadow-lg">
                <button
                  onClick={() => { setOpen(false); clearProfileSelection(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                >
                  <LogOut size={14} />
                  {t("header.changeProfile")}
                </button>
              </div>
            )}
          </div>
        )}

        {showControls && (
          <div className="flex items-center ml-2">
            <button
              onClick={handleMinimize}
              className="inline-flex h-10 w-11 items-center justify-center text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              title={t("header.minimize")}
            >
              <Minus size={15} />
            </button>
            <button
              onClick={handleMaximize}
              className="inline-flex h-10 w-11 items-center justify-center text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
              title={maximized ? t("header.restore") : t("header.maximize")}
            >
              {maximized ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button
              onClick={handleClose}
              className="inline-flex h-10 w-11 items-center justify-center text-text-tertiary transition-colors hover:bg-red-500/90 hover:text-white"
              title={t("header.close")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClose}
        title={t("header.confirmClose.title")}
        message={t("header.confirmClose.message")}
        confirmLabel={t("header.confirmClose.confirm")}
        danger
        onConfirm={() => getCurrentWindow().close()}
        onCancel={() => setConfirmClose(false)}
      />
    </header>
  );
}
