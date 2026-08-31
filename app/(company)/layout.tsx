import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import CompanyNav from "@/components/company/CompanyNav";
import { CompanyProvider } from "@/lib/company-data";
import CompanyLoadingGate from "@/components/company/CompanyLoadingGate";
import SetupGate from "@/components/company/SetupGate";

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={["company_admin"]}>
      <SetupGate>
        <CompanyProvider>
          <div className="flex min-h-screen bg-canvas">
            <CompanyNav />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
              <CompanyLoadingGate>{children}</CompanyLoadingGate>
            </main>
          </div>
        </CompanyProvider>
      </SetupGate>
    </AuthGuard>
  );
}