import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import ManagerNav from "@/components/manager/ManagerNav";
import { CompanyProvider } from "@/lib/company-data";
import CompanyLoadingGate from "@/components/company/CompanyLoadingGate";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={["manager"]}>
      <CompanyProvider>
        <div className="flex min-h-screen bg-canvas">
          <ManagerNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-8">
            <CompanyLoadingGate>{children}</CompanyLoadingGate>
          </main>
        </div>
      </CompanyProvider>
    </AuthGuard>
  );
}
