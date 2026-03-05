import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Plus, Settings, X } from "lucide-react";
import type { UserProfile } from "@/types";
import { PROFILE_COLORS } from "@/types/report";
import { SpriteAvatar, AvatarPicker } from "@/components/ui/SpriteAvatar";

export function ProfileSelector() {
  const { t } = useTranslation();
  const { profiles, setActiveProfile, addProfile } = useWorkspace();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PROFILE_COLORS[0]);
  const [selectedAvatar, setSelectedAvatar] = useState<number | undefined>();
  const [managing, setManaging] = useState(false);

  async function handleSelect(profile: UserProfile) {
    if (managing) return;
    await setActiveProfile(profile.id);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await addProfile(newName.trim(), selectedColor, selectedAvatar);
    setNewName("");
    setSelectedAvatar(undefined);
    setShowAdd(false);
    const usedColors = profiles.map((p) => p.color);
    const nextColor = PROFILE_COLORS.find((c) => !usedColors.includes(c)) ?? PROFILE_COLORS[0];
    setSelectedColor(nextColor);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-primary">
      <div className="w-full max-w-2xl px-8">
        <h1 className="mb-12 text-center text-3xl font-bold text-text-primary">
          {t("profileSelector.title")}
        </h1>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-8">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex flex-col items-center gap-3">
              <button
                onClick={() => handleSelect(profile)}
                className="transition-transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-white/30 rounded-full"
              >
                <SpriteAvatar avatar={profile.avatar} name={profile.name} color={profile.color} size={96} />
              </button>
              <span className="text-sm font-medium text-text-secondary max-w-[100px] truncate text-center">
                {profile.name}
              </span>
            </div>
          ))}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setShowAdd(true)}
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border-secondary text-text-tertiary transition-colors hover:border-accent hover:text-accent"
            >
              <Plus size={36} />
            </button>
            <span className="text-sm text-text-tertiary">{t("profileSelector.add")}</span>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => setManaging(!managing)}
            className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Settings size={16} />
            {t("profileSelector.manage")}
          </button>
          <p className="mt-2 text-xs text-text-tertiary/60">
            {t("profileSelector.avatarHint")}
          </p>
        </div>

        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-xl bg-bg-secondary p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">{t("profileSelector.newProfile")}</h2>
                <button onClick={() => setShowAdd(false)} className="text-text-tertiary hover:text-text-primary">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  {t("profileSelector.name")}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder={t("setup.namePlaceholder")}
                  autoFocus
                  className="w-full rounded-lg border border-border-secondary bg-bg-primary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  {t("setup.nameHelp")}
                </p>
              </div>

              {selectedAvatar == null && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-text-secondary">
                    {t("profileSelector.color")}
                  </label>
                  <div className="flex gap-2">
                    {PROFILE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`h-8 w-8 rounded-full transition-transform ${
                          selectedColor === color ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-bg-secondary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <AvatarPicker selected={selectedAvatar} onSelect={setSelectedAvatar} />
              </div>

              <div className="flex items-center justify-center">
                <div className="mb-4">
                  <SpriteAvatar
                    avatar={selectedAvatar}
                    name={newName.trim() || "?"}
                    color={selectedColor}
                    size={80}
                  />
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-text-inverted transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {t("profileSelector.create")}
              </button>
            </div>
          </div>
        )}

        {managing && (
          <ManageProfiles onClose={() => setManaging(false)} />
        )}
      </div>
    </div>
  );
}

function ManageProfiles({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { profiles, updateProfile, removeProfile } = useWorkspace();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editAvatar, setEditAvatar] = useState<number | undefined>();

  function startEdit(profile: UserProfile) {
    setEditingId(profile.id);
    setEditName(profile.name);
    setEditColor(profile.color);
    setEditAvatar(profile.avatar);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    const profile = profiles.find((p) => p.id === editingId);
    if (profile) {
      await updateProfile({
        ...profile,
        name: editName.trim(),
        color: editColor,
        avatar: editAvatar,
        examiner: editName.trim(),
      });
    }
    setEditingId(null);
  }

  async function handleDelete(profileId: string) {
    if (profiles.length <= 1) return;
    await removeProfile(profileId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-bg-secondary p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{t("profileSelector.manage")}</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border border-border-secondary p-3">
              <div className="flex items-center gap-3">
                <SpriteAvatar
                  avatar={editingId === profile.id ? editAvatar : profile.avatar}
                  name={editingId === profile.id ? editName : profile.name}
                  color={editingId === profile.id ? editColor : profile.color}
                  size={40}
                />

                {editingId === profile.id ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                      className="rounded border border-border-secondary bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                    />
                    {editAvatar == null && (
                      <div className="flex gap-1">
                        {PROFILE_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`h-5 w-5 rounded-full ${editColor === color ? "ring-2 ring-accent ring-offset-1 ring-offset-bg-secondary" : ""}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="text-xs text-accent hover:underline">{t("settings.profiles.save")}</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-text-tertiary hover:underline">{t("settings.profiles.cancel")}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-text-primary">{profile.name}</span>
                    <button onClick={() => startEdit(profile)} className="text-xs text-text-tertiary hover:text-accent">
                      {t("settings.profiles.edit")}
                    </button>
                    {profiles.length > 1 && (
                      <button onClick={() => handleDelete(profile.id)} className="text-xs text-text-tertiary hover:text-red-500">
                        {t("settings.profiles.delete")}
                      </button>
                    )}
                  </>
                )}
              </div>

              {editingId === profile.id && (
                <div className="mt-3 border-t border-border-secondary pt-3">
                  <div className="mb-2 flex items-center justify-center">
                    <SpriteAvatar
                      avatar={editAvatar}
                      name={editName.trim() || "?"}
                      color={editColor}
                      size={64}
                    />
                  </div>
                  <AvatarPicker selected={editAvatar} onSelect={setEditAvatar} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 font-medium text-text-inverted transition-colors hover:bg-accent-hover"
        >
          {t("profileSelector.done")}
        </button>
      </div>
    </div>
  );
}
