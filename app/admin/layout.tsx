import type { ReactNode } from "react";
import { AdminProvider } from "@/lib/store";
import AdminNav from "@/components/admin/AdminNav";
import AuthGuard from "@/components/AuthGuard";
import AdminLoadingGate from "@/components/admin/AdminLoadingGate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AuthGuard allowedRoles={["super_admin"]}>
        <div className="flex min-h-screen flex-col bg-canvas">
          <AdminNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-8">
            <AdminLoadingGate>{children}</AdminLoadingGate>
          </main>
        </div>
      </AuthGuard>
    </AdminProvider>
  );
}