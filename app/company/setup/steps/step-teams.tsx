"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-data";
import TeamFormModal from "@/components/teams/TeamFormModal";
import type { TeamFormInput } from "@/components/teams/TeamFormModal";
import StepListCard from "@/components/company-setup/StepListCard";
import WizardNav from "@/components/company-setup/WizardNav";
import { UsersIcon } from "@/components/ui/icons";

interface StepTeamsProps {
  onBack: () => void;
  onNext: () => void;
}

export default function StepTeams({ onBack, onNext }: StepTeamsProps) {
  const { teams, locations, people, createTeam } = useCompany();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSave = async (
    input: TeamFormInput,
  ): Promise<{ ok: boolean; error?: string }> => {
    const team = await createTeam(
      input.name,
      input.description,
      input.locationId,
      input.managerId,
    );
    if (!team) {
      return { ok: false, error: "Team name can't be empty or match an existing team." };
    }
    setModalOpen(false);
    return { ok: true };
  };

  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight text-ink">Add teams</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
        Organize people for scheduling and reporting. You can add more later.
      </p>

      <div className="mt-4">
        <StepListCard
          items={teams.map((t) => ({ id: t.id, primary: t.name }))}
          emptyLabel="No teams added yet"
          addLabel="Add team"
          onAdd={() => setModalOpen(true)}
          icon={UsersIcon}
        />
      </div>

      <WizardNav
        onBack={onBack}
        onContinue={onNext}
        continueLabel={teams.length > 0 ? "Continue" : "Skip for now"}
        continueVariant={teams.length > 0 ? "primary" : "ghost"}
      />

      {modalOpen && (
        <TeamFormModal
          team={null}
          locations={locations}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
