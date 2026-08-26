import type { ReactNode } from "react";
import AuthGuard from "@/components/AuthGuard";
import EmployeeNav from "@/components/employee/EmployeeNav";
import { CompanyProvider } from "@/lib/company-data";
import CompanyLoadingGate from "@/components/company/CompanyLoadingGate";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard allowedRoles={["employee"]}>
      <CompanyProvider>
        <div className="flex min-h-screen bg-canvas">
          <EmployeeNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
            <CompanyLoadingGate>{children}</CompanyLoadingGate>
          </main>
        </div>
      </CompanyProvider>
    </AuthGuard>
  );
}
