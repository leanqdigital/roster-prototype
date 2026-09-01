"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { COMPANY_CATEGORIES, completeCompanySetup } from "@/lib/company";
import { CompanyProvider } from "@/lib/company-data";
import CompanyLoadingGate from "@/components/company/CompanyLoadingGate";
import LogoMark from "@/components/ui/Logo";
import { ArrowLeftIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import Stepper from "@/components/ui/Stepper";
import StepCategory from "./steps/step-category";
import StepLocations from "./steps/step-locations";
import StepTeams from "./steps/step-teams";
import StepPeople from "./steps/step-people";
import StepTemplates from "./steps/step-templates";
import StepReview from "./steps/step-review";

const STEP_LABELS = [
  "Category",
  "Locations",
  "Teams",
  "People",
  "Templates",
  "Review",
];

export default function SetupWizard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(COMPANY_CATEGORIES[0]);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <CompanyProvider>
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="fixed right-4 top-4 rounded-lg border border-hairline bg-surface-2 p-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </button>
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center gap-3">
            <LogoMark className="size-11" />
            <div className="text-center">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                Set up your company
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {user.company ? `${user.company} — ` : ""}almost ready
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-6">
            <Stepper steps={STEP_LABELS} current={step} />

            <div className="mt-6">
              <CompanyLoadingGate>
                {step === 1 && (
                  <StepCategory
                    category={category}
                    setCategory={setCategory}
                    onNext={() => setStep(2)}
                  />
                )}
                {step === 2 && (
                  <StepLocations onBack={() => setStep(1)} onNext={() => setStep(3)} />
                )}
                {step === 3 && (
                  <StepTeams onBack={() => setStep(2)} onNext={() => setStep(4)} />
                )}
                {step === 4 && (
                  <StepPeople onBack={() => setStep(3)} onNext={() => setStep(5)} />
                )}
                {step === 5 && (
                  <StepTemplates onBack={() => setStep(4)} onNext={() => setStep(6)} />
                )}
                {step === 6 && (
                  <StepReview category={category} onBack={() => setStep(5)} />
                )}
              </CompanyLoadingGate>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              <ArrowLeftIcon className="size-3.5" />
              Sign in with another account
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={async () => {
                  await completeCompanySetup(category);
                  router.push("/dashboard");
                }}
                className="shrink-0 text-xs text-ink-subtle transition-colors hover:text-ink-muted"
              >
                Skip
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="shrink-0 text-xs text-ink-subtle transition-colors hover:text-ink-muted"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </CompanyProvider>
  );
}
