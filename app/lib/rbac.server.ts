export type Role =
  | "super_admin" | "doctor" | "nurse" | "lab" | "radiology"
  | "pharmacy" | "reception" | "billing" | "department_head";

export type Capability =
  | "view_dashboard" | "view_command_dashboard" | "view_patients" | "edit_patients" | "view_emr" | "edit_emr"
  | "order_clinical" | "view_ed" | "manage_ed" | "view_icu" | "edit_vitals"
  | "view_ot" | "manage_ot" | "view_lab" | "result_lab" | "view_radiology" | "report_radiology"
  | "view_pharmacy" | "dispense_pharmacy" | "view_referrals" | "manage_referrals"
  | "message" | "view_appointments" | "manage_appointments" | "view_billing" | "manage_billing"
  | "view_staff" | "manage_staff" | "view_departments" | "manage_settings" | "view_audit";

const ALL: Capability[] = [
  "view_dashboard", "view_command_dashboard", "view_patients", "edit_patients", "view_emr", "edit_emr",
  "order_clinical", "view_ed", "manage_ed", "view_icu", "edit_vitals",
  "view_ot", "manage_ot", "view_lab", "result_lab", "view_radiology", "report_radiology",
  "view_pharmacy", "dispense_pharmacy", "view_referrals", "manage_referrals",
  "message", "view_appointments", "manage_appointments", "view_billing", "manage_billing",
  "view_staff", "manage_staff", "view_departments", "manage_settings", "view_audit",
];

const CLINICAL_COMMON: Capability[] = [
  "view_dashboard", "view_patients", "view_emr", "view_referrals", "manage_referrals",
  "message", "view_departments", "view_appointments",
];

export const MATRIX: Record<Role, Capability[]> = {
  super_admin: ALL,
  department_head: [...ALL.filter((c) => c !== "manage_settings" && c !== "manage_staff")],
  doctor: [...CLINICAL_COMMON, "edit_patients", "edit_emr", "order_clinical", "view_ed", "manage_ed",
    "view_icu", "edit_vitals", "view_ot", "manage_ot", "view_lab", "view_radiology", "view_pharmacy",
    "manage_appointments"],
  nurse: [...CLINICAL_COMMON, "edit_emr", "view_ed", "manage_ed", "view_icu", "edit_vitals",
    "view_lab", "view_radiology", "view_pharmacy", "manage_appointments"],
  lab: ["view_dashboard", "view_patients", "view_lab", "result_lab", "message", "view_referrals"],
  radiology: ["view_dashboard", "view_patients", "view_radiology", "report_radiology", "message", "view_referrals"],
  pharmacy: ["view_dashboard", "view_patients", "view_pharmacy", "dispense_pharmacy", "message"],
  reception: ["view_dashboard", "view_patients", "edit_patients", "view_appointments", "manage_appointments",
    "view_ed", "manage_ed", "view_departments", "view_staff", "message"],
  billing: ["view_billing", "manage_billing"],
};

export function can(role: string | undefined, cap: Capability): boolean {
  return !!role && (MATRIX[role as Role] ?? []).includes(cap);
}

// Each role lands on its own home interface after login.
export function homePath(role: string): string {
  switch (role) {
    case "super_admin":
    case "department_head": return "/dashboard";
    case "doctor": return "/workspace";
    case "lab": return "/lab";
    case "radiology": return "/radiology";
    case "pharmacy": return "/pharmacy";
    case "billing": return "/cashier";
    case "nurse":
    case "reception":
    default: return "/patients";
  }
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Administrator", department_head: "Department Head", doctor: "Physician", nurse: "Nurse",
  lab: "Laboratory", radiology: "Radiology", pharmacy: "Pharmacy", reception: "Reception", billing: "Billing",
};
