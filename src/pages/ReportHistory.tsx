import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/layout/Header";
import { useSessionList } from "@/hooks/useReports";
import { formatDate } from "@/lib/utils";
import { FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReportHistory() {
  const { sessions, loading } = useSessionList();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <>
      <Header title={t("history.title")} />
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary">
            {t("history.noSessions")}
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border-secondary bg-bg-secondary px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileText
                    size={20}
                    className={
                      s.status === "completed" ? "text-accent-text" : "text-text-tertiary"
                    }
                  />
                  <div>
                    <p className="font-medium text-text-primary">
                      {s.patient_name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatDate(s.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.report_type === "ear_wash" && (
                    <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-text">
                      {t("history.wash")}
                    </span>
                  )}
                  {s.report_type === "audiometry" && (
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
                      {t("history.audiometry")}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "completed"
                        ? "bg-success-subtle text-success-text"
                        : "bg-warning-subtle text-warning-text"
                    }`}
                  >
                    {s.status === "completed" ? t("history.completed") : t("history.inProgress")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const base = s.report_type === "audiometry" ? "/new-audiometry" : "/new-report";
                      navigate(`${base}?patient=${s.patient_id}&session=${s.id}`);
                    }}
                  >
                    <Eye size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
