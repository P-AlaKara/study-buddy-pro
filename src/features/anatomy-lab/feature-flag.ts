// The Anatomy Lab is a self-contained, independently navigable feature. It is
// enabled by default and can be turned off per-environment without touching the
// rest of the platform by setting VITE_ENABLE_ANATOMY_LAB="false".
export const ANATOMY_LAB_ENABLED = import.meta.env["VITE_ENABLE_ANATOMY_LAB"] !== "false";
