import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MedicalCase } from "../schema.js";

export function CommitDialog({
  open,
  caseDefinition,
  diagnosisId,
  treatmentIds,
  onDiagnosis,
  onToggleTreatment,
  onClose,
  onSubmit,
}: {
  open: boolean;
  caseDefinition: MedicalCase;
  diagnosisId: string;
  treatmentIds: string[];
  onDiagnosis: (id: string) => void;
  onToggleTreatment: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const treatments = caseDefinition.actions.filter((action) => action.category === "treat");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-[28px] border-0 bg-white p-5 shadow-2xl sm:p-7">
        <DialogTitle className="font-display text-2xl font-black">Commit your decision</DialogTitle>
        <DialogDescription>
          Choose one final diagnosis and the treatment plan you would initiate. This ends the case.
        </DialogDescription>
        <fieldset className="mt-3 space-y-2">
          <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">
            Final diagnosis
          </legend>
          {caseDefinition.differential.map((diagnosis) => (
            <label
              key={diagnosis.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-sm font-bold ${
                diagnosisId === diagnosis.id
                  ? "bg-[var(--case-accent-soft)] text-[var(--case-accent-ink)]"
                  : "bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="final-diagnosis"
                value={diagnosis.id}
                checked={diagnosisId === diagnosis.id}
                onChange={() => onDiagnosis(diagnosis.id)}
                className="accent-[var(--case-accent)]"
              />
              {diagnosis.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">
            Treatment plan
          </legend>
          {treatments.map((action) => (
            <label
              key={action.id}
              className={`flex cursor-pointer items-start gap-2 rounded-2xl p-3 text-xs font-bold ${
                treatmentIds.includes(action.id) ? "bg-[var(--case-blue-soft)]" : "bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={treatmentIds.includes(action.id)}
                onChange={() => onToggleTreatment(action.id)}
                className="mt-0.5 accent-[var(--case-blue)]"
              />
              <span>
                {action.label}
                {action.riskNote && (
                  <span className="mt-1 block text-[10px] font-medium leading-snug text-slate-500">
                    {action.riskNote}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black"
          >
            Keep investigating
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!diagnosisId}
            className="case-primary-button justify-center px-5 py-3"
          >
            Commit and see outcome
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
