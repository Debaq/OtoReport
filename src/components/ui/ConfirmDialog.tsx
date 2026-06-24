import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  /** Texto del botón de confirmación. Default: common.confirm */
  confirmLabel?: string;
  /** Texto del botón de cancelar. Default: common.cancel */
  cancelLabel?: string;
  /** Estilo destructivo en el botón de confirmar */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo genérico de confirmación para acciones relevantes (cerrar, eliminar, etc.). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <div className="mb-4 text-sm text-text-secondary">{message}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Dialog>
  );
}
