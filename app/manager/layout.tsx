import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import ManagerNav from "@/components/manager/ManagerNav";
import { CompanyProvider } from "@/lib/company-data";
import { ManagerProvider } from "@/lib/manager-team";
import CompanyLoadingGate from "@/components/company/CompanyLoadingGate";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={["manager"]}>
      <CompanyProvider>
        <ManagerProvider>
          <div className="flex min-h-screen bg-canvas">
            <ManagerNav />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
              <CompanyLoadingGate>{children}</CompanyLoadingGate>
            </main>
          </div>
        </ManagerProvider>
      </CompanyProvider>
    </AuthGuard>
  );
}
