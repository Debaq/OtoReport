import { createHashRouter, RouterProvider } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";
import { UpdateModal } from "@/components/ui/UpdateModal";
import { ThemeProvider } from "@/hooks/useTheme";
import { ToastProvider } from "@/components/ui/Toast";
import { KonamiEasterEgg } from "@/components/KonamiEasterEgg";
import { WorkspaceSetup } from "@/components/setup/WorkspaceSetup";
import { ProfileSelector } from "@/components/setup/ProfileSelector";
import { MainLayout } from "@/components/layout/MainLayout";
import { Dashboard } from "@/pages/Dashboard";

const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: "patients",
        lazy: () => import("@/pages/Patients").then((m) => ({ Component: m.Patients })),
      },
      {
        path: "patients/:id",
        lazy: () =>
          import("@/pages/PatientDetail").then((m) => ({ Component: m.PatientDetail })),
      },
      {
        path: "new-report",
        lazy: () => import("@/pages/NewReport").then((m) => ({ Component: m.NewReport })),
      },
      {
        path: "new-audiometry",
        lazy: () => import("@/pages/NewAudiometry").then((m) => ({ Component: m.NewAudiometry })),
      },
      {
        path: "history",
        lazy: () =>
          import("@/pages/ReportHistory").then((m) => ({ Component: m.ReportHistory })),
      },
      {
        path: "findings-library",
        lazy: () =>
          import("@/pages/FindingsLibrary").then((m) => ({ Component: m.FindingsLibrary })),
      },
      {
        path: "contribute/:findingKey",
        lazy: () =>
          import("@/pages/ContributeFinding").then((m) => ({ Component: m.ContributeFinding })),
      },
      {
        path: "education",
        lazy: () => import("@/pages/Education").then((m) => ({ Component: m.Education })),
      },
      {
        path: "animation-editor",
        lazy: () =>
          import("@/pages/AnimationEditorPage").then((m) => ({
            Component: m.AnimationEditorPage,
          })),
      },
      {
        path: "settings",
        lazy: () => import("@/pages/Settings").then((m) => ({ Component: m.Settings })),
      },
    ],
  },
]);

function AppContent() {
  const { workspacePath, loading, profiles, profileSelected } = useWorkspace();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!workspacePath) {
    return <WorkspaceSetup />;
  }

  if (profiles.length > 1 && !profileSelected) {
    return <ProfileSelector />;
  }

  const update = useUpdateChecker();

  return (
    <>
      <RouterProvider router={router} />
      {update.updateAvailable && !update.dismissed && update.latestVersion && update.releaseUrl && (
        <UpdateModal
          open
          onClose={update.dismiss}
          latestVersion={update.latestVersion}
          releaseNotes={update.releaseNotes}
          releaseUrl={update.releaseUrl}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <AppContent />
          <KonamiEasterEgg />
        </WorkspaceProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
