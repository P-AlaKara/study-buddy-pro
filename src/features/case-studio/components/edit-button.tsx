import { PencilLine } from "lucide-react";
import { Button } from "./studio-ui";
import { useWorkspace, type JumpTarget } from "./workspace-context";

/** "Edit" for a review section: opens that field in the builder. Hidden when editing isn't possible. */
export function EditButton({ target, label = "Edit" }: { target: JumpTarget; label?: string }) {
  const { edit } = useWorkspace();
  if (!edit) return null;
  return (
    <Button size="sm" tone="quiet" onClick={() => edit(target)}>
      <PencilLine aria-hidden className="size-4" /> {label}
    </Button>
  );
}
