import bcrypt from "bcryptjs";
import db from "../app/lib/db.server";
import { newId, mrn, visitNo, staffNo, invoiceNo } from "../app/lib/ids.server";
import { setSetting } from "../app/lib/settings.server";

function insert(table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((k) => row[k]));
}
const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60000).toISOString();
const hash = (p: string) => bcrypt.hashSync(p, 10);
const r = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[r(a.length)];
const sample = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const avatar = (seed: string) => `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundColor=dbe9ff,e9e0ff,ffe0ec,e0fff1,fff3d6,e0f2ff`;

const tables = ["payments", "invoice_items", "invoices", "appointments", "surgeries", "messages", "thread_members",
  "threads", "referrals", "prescriptions", "med_catalog", "rad_studies", "lab_results", "lab_catalog", "service_catalog",
  "orders", "notes", "vitals", "encounters", "beds", "patients", "schedules", "staff", "departments", "notifications", "audit_logs", "settings"];

console.log("Seeding Lumora (full)…");
db.pragma("foreign_keys = OFF");
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
db.pragma("foreign_keys = ON");

setSetting("hospital_name", "Lumora Medical Center");
setSetting("hospital_tagline", "Hospital Operating System");
setSetting("currency", "USD");
setSetting("accreditation", "JCI Accredited");
setSetting("timezone", "UTC");

// ---- 30 clinical departments (+ pharmacy & finance for operations) ----
const DEPTS: Array<[string, string, string, string, string]> = [
  // code, name, category, kind, color
  ["NICU", "Neonatal Resuscitation (NICU)", "critical", "nicu", "#f472b6"],
  ["ANES", "Anesthesiology & Reanimatology", "critical", "icu", "#f43f5e"],
  ["ED", "Emergency Department", "emergency", "ed", "#ef4444"],
  ["CARD", "Cardiology", "outpatient", "cardiology", "#6366f1"],
  ["CVS", "Cardiovascular Surgery", "surgical", "cvsurgery", "#4f46e5"],
  ["GSURG", "General Surgery", "surgical", "generalsurgery", "#8b5cf6"],
  ["NSURG", "Neurosurgery", "surgical", "neurosurgery", "#7c3aed"],
  ["PLAS", "Plastic, Aesthetic & Reconstructive Surgery", "surgical", "plastic", "#ec4899"],
  ["ORT", "Orthopedics & Traumatology", "outpatient", "orthopedics", "#0891b2"],
  ["URO", "Urology", "outpatient", "urology", "#0ea5e9"],
  ["OBG", "Obstetrics & Gynecology", "outpatient", "obgyn", "#db2777"],
  ["OPH", "Ophthalmology", "outpatient", "ophthalmology", "#14b8a6"],
  ["ENT", "Otolaryngology (ENT)", "outpatient", "ent", "#06b6d4"],
  ["GAST", "Gastroenterology", "outpatient", "gastro", "#d97706"],
  ["ENDO", "Endocrinology", "outpatient", "endocrine", "#ca8a04"],
  ["PULM", "Pulmonology", "outpatient", "pulmonology", "#0284c7"],
  ["NEUR", "Neurology", "outpatient", "neurology", "#4338ca"],
  ["NEPH", "Nephrology & Dialysis", "outpatient", "nephrology", "#2563eb"],
  ["DERM", "Dermatology", "outpatient", "dermatology", "#e11d48"],
  ["MAMM", "Mammology", "outpatient", "mammology", "#f43f5e"],
  ["HEM", "Hematology", "outpatient", "hematology", "#dc2626"],
  ["INF", "Infectious Diseases", "inpatient", "infectious", "#16a34a"],
  ["THER", "Internal Medicine (Therapy)", "inpatient", "internal", "#2563eb"],
  ["PED", "Pediatrics Polyclinic", "outpatient", "pediatrics", "#0ea5e9"],
  ["STOM", "Dentistry (Stomatology)", "outpatient", "dentistry", "#0d9488"],
  ["PHYS", "Physiotherapy & Rehabilitation", "support", "physio", "#ca8a04"],
  ["DIET", "Dietetics & Nutrition", "support", "dietetics", "#65a30d"],
  ["PSY", "Psychology", "support", "psychology", "#9333ea"],
  ["RAD", "Radiology", "diagnostic", "radiology", "#0d9488"],
  ["LAB", "Central Laboratory", "diagnostic", "lab", "#16a34a"],
  ["PHA", "Pharmacy", "support", "pharmacy", "#d97706"],
  ["FIN", "Finance & Cashier", "backoffice", "billing", "#475569"],
];
const dept: Record<string, string> = {};
const deptName: Record<string, string> = {};
DEPTS.forEach(([code, name, category, kind, color], i) => {
  const id = newId();
  dept[code] = id; deptName[code] = name;
  insert("departments", { id, code, name, category, kind, location: `Block ${String.fromCharCode(65 + (i % 6))} · Level ${1 + (i % 5)}`, phone: `+1 555 0${String(100 + i).slice(-3)}`, color });
});

// ---- doctor generation (≥5 per clinical department, rich photo profiles) ----
const FIRST = ["Elvin", "Aysel", "Marcus", "Priya", "Tomas", "Amara", "Sofia", "Daniel", "Hannah", "Omar", "Leyla", "Viktor", "Chen", "Fatima", "Leo", "Sara", "Ahmed", "Olga", "Paolo", "Zara", "Nadia", "Yusuf", "Maria", "Samir", "Elena", "Rashad", "Ingrid", "Kenji", "Lucia", "Ibrahim", "Nora", "Tural", "Mina", "Cem", "Anya", "Ravi", "Dina", "Hugo", "Sevda", "Karim"];
const LAST = ["Aliyev", "Karimova", "Hale", "Nair", "Berg", "Diallo", "Ricci", "Cho", "Reed", "Haddad", "Mammadova", "Novak", "Wang", "Khan", "Brandt", "Conti", "Said", "Petrova", "Rossi", "Lopez", "Tanaka", "Demir", "Santos", "Hasanov", "Voss", "Quliyev", "Larsen", "Yamada", "Moreau", "Fischer", "Yilmaz", "Abbasov", "Park", "Ozturk", "Sokolova", "Mehta", "Haas", "Silva", "Guliyeva", "Nazarov"];
const UNIS = ["Charité Berlin", "Johns Hopkins", "Karolinska Institute", "Imperial College London", "Sorbonne Paris", "Sapienza Rome", "Hacettepe Ankara", "Moscow State", "Azerbaijan Medical University", "Vienna Medical University", "Cleveland Clinic", "Mayo Clinic", "King's College London", "Heidelberg University"];
const LANGS = ["English", "Azerbaijani", "Russian", "Turkish", "German", "French", "Arabic", "Italian"];
const TITLES = ["Head of Department", "Consultant", "Senior Specialist", "Specialist", "Associate Specialist", "Attending Physician"];
const FELLOW: Record<string, string> = {
  CARD: "Interventional Cardiology", CVS: "Coronary Bypass Surgery", GSURG: "Laparoscopic Surgery", NSURG: "Spinal Neurosurgery",
  PLAS: "Microsurgery & Reconstruction", ORT: "Joint Replacement", URO: "Endourology", OBG: "Maternal-Fetal Medicine",
  OPH: "Vitreoretinal Surgery", ENT: "Rhinology & Skull Base", GAST: "Therapeutic Endoscopy", ENDO: "Diabetes & Metabolism",
  PULM: "Interventional Pulmonology", NEUR: "Stroke Medicine", NEPH: "Dialysis & Transplant", DERM: "Dermato-oncology",
  MAMM: "Breast Imaging & Surgery", HEM: "Hemato-oncology", INF: "Tropical & Hospital Infection", THER: "General Internal Medicine",
  PED: "Pediatric Pulmonology", STOM: "Oral & Maxillofacial Surgery", PHYS: "Sports Rehabilitation", DIET: "Clinical Nutrition",
  PSY: "Clinical Psychology", NICU: "Neonatal Intensive Care", ANES: "Critical Care Medicine", ED: "Emergency Medicine",
  RAD: "Cross-sectional Imaging",
};
const BIO: Record<string, string> = {
  CARD: "Coronary angiography, structural heart disease and preventive cardiology.",
  PLAS: "Aesthetic, reconstructive and microsurgical procedures with a focus on natural results.",
  ANES: "Peri-operative anesthesia, intensive care and pain management.",
  NICU: "Care of premature and critically-ill newborns.",
  ED: "Trauma resuscitation, triage and acute emergency care.",
};

const DOC_DEPTS = ["NICU", "ANES", "ED", "CARD", "CVS", "GSURG", "NSURG", "PLAS", "ORT", "URO", "OBG", "OPH", "ENT", "GAST", "ENDO", "PULM", "NEUR", "NEPH", "DERM", "MAMM", "HEM", "INF", "THER", "PED", "STOM", "PHYS", "DIET", "PSY", "RAD"];

const docsByDept: Record<string, string[]> = {};
const allDoctors: Array<{ id: string; code: string; name: string }> = [];
let emailSeq: Record<string, number> = {};

function makeDoctor(code: string, i: number, role = "doctor"): string {
  const id = newId();
  const first = pick(FIRST), last = pick(LAST);
  const name = `Dr. ${first} ${last}`;
  const gender = r(2) ? "male" : "female";
  emailSeq[code] = (emailSeq[code] ?? 0) + 1;
  const email = `${code.toLowerCase()}${emailSeq[code]}@lumora.health`;
  const fellow = FELLOW[code] ?? `${deptName[code]} subspecialty`;
  const quals = [
    { degree: "MD", institution: pick(UNIS), year: 1992 + r(16) },
    { degree: `Fellowship — ${fellow}`, institution: pick(UNIS), year: 2006 + r(13) },
    ...(r(2) ? [{ degree: "PhD (Clinical Research)", institution: pick(UNIS), year: 2012 + r(8) }] : []),
  ];
  const exp = [
    { role: i === 0 ? "Head of Department" : pick(TITLES.slice(1)), place: "Lumora Medical Center", from: `${2009 + r(8)}`, to: "present" },
    { role: "Specialist Registrar", place: pick(UNIS), from: `${2003 + r(4)}`, to: `${2009 + r(3)}` },
  ];
  insert("staff", {
    id, staff_no: staffNo(), email, password_hash: hash("Lumora2026!"), full_name: name, role,
    title: i === 0 ? `Head of ${deptName[code].split(" (")[0]}` : pick(["Consultant", "Senior Specialist", "Specialist", "Attending Physician"]),
    department_id: dept[code], specialty: deptName[code].split(" (")[0], subspecialty: fellow,
    phone: `+1 555 1${String(allDoctors.length).padStart(3, "0")}`, gender, photo_color: pick(["#6366f1", "#0ea5e9", "#ec4899", "#16a34a", "#f59e0b", "#7c3aed"]),
    photo_url: avatar(name + id.slice(-3)), rating: +(4.3 + Math.random() * 0.7).toFixed(1),
    license_no: `LIC-${20000 + allDoctors.length}`, license_expiry: iso(60 * 24 * (180 + r(900))),
    qualifications: JSON.stringify(quals), experience: JSON.stringify(exp),
    languages: JSON.stringify(["English", ...sample(LANGS.slice(1), 1 + r(2))]),
    bio: BIO[code] ?? `${deptName[code].split(" (")[0]} specialist focused on evidence-based, patient-centred care.`,
    consult_fee: 80 + r(18) * 10, room: `${code}-${200 + i}`, last_login_at: iso(-60 * (1 + r(48))),
  });
  (docsByDept[code] ??= []).push(id);
  allDoctors.push({ id, code, name });
  return id;
}

for (const code of DOC_DEPTS) {
  const n = 5 + r(2); // 5–6 doctors
  for (let i = 0; i < n; i++) makeDoctor(code, i, code === "RAD" ? "radiology" : "doctor");
  db.prepare("UPDATE departments SET head_staff_id=? WHERE id=?").run(docsByDept[code][0], dept[code]);
}
// schedules for ~first two doctors of each dept
for (const code of DOC_DEPTS) {
  for (const sid of docsByDept[code].slice(0, 2)) {
    for (const wd of sample([1, 2, 3, 4, 5], 3)) insert("schedules", { id: newId(), staff_id: sid, weekday: wd, start_min: 9 * 60, end_min: 14 * 60, room: `${code}-201` });
  }
}

// admin + support staff
const staff: Record<string, string> = {};
function makeStaff(key: string, name: string, role: string, title: string, code: string, email: string) {
  const id = newId(); staff[key] = id;
  insert("staff", { id, staff_no: staffNo(), email, password_hash: hash("Lumora2026!"), full_name: name, role, title,
    department_id: dept[code], phone: `+1 555 2${String(Object.keys(staff).length).padStart(3, "0")}`, gender: r(2) ? "male" : "female",
    photo_color: "#475569", photo_url: avatar(name), rating: 4.7, languages: JSON.stringify(["English"]), bio: title, last_login_at: iso(-30) });
  return id;
}
makeStaff("admin", "Dr. Elena Voss", "super_admin", "Medical Director", "THER", "admin@lumora.health");
makeStaff("nurse1", "Lena Park", "nurse", "ICU Charge Nurse", "ANES", "nurse1@lumora.health");
makeStaff("nurse2", "Grace Owusu", "nurse", "Emergency Nurse", "ED", "nurse2@lumora.health");
makeStaff("lab1", "Victor Lim", "lab", "Senior Lab Scientist", "LAB", "lab1@lumora.health");
makeStaff("lab2", "Aylin Hasan", "lab", "Lab Technologist", "LAB", "lab2@lumora.health");
staff.rad1 = docsByDept.RAD[0]; // head radiologist signs off studies
makeStaff("pharm1", "Yusuf Demir", "pharmacy", "Chief Pharmacist", "PHA", "pharm1@lumora.health");
makeStaff("recep1", "Maria Santos", "reception", "Front Desk Lead", "ED", "recep1@lumora.health");
makeStaff("cashier1", "Sam Whitfield", "billing", "Cashier / Billing Officer", "FIN", "cashier1@lumora.health");
db.prepare("UPDATE departments SET head_staff_id=? WHERE code IN ('LAB') AND head_staff_id IS NULL").run(staff.lab1);
db.prepare("UPDATE departments SET head_staff_id=? WHERE code IN ('RAD') AND head_staff_id IS NULL").run(staff.rad1);
db.prepare("UPDATE departments SET head_staff_id=? WHERE code IN ('PHA') AND head_staff_id IS NULL").run(staff.pharm1);

// ---- 45-analyte lab catalog ----
const LAB: Array<[string, string, string, string, number, number, number]> = [
  ["WBC", "White Blood Cells", "Hematology", "10^9/L", 4, 11, 6], ["RBC", "Red Blood Cells", "Hematology", "10^12/L", 4.2, 5.9, 6],
  ["HGB", "Hemoglobin", "Hematology", "g/dL", 12, 17, 6], ["HCT", "Hematocrit", "Hematology", "%", 36, 50, 6],
  ["PLT", "Platelets", "Hematology", "10^9/L", 150, 400, 6], ["MCV", "Mean Cell Volume", "Hematology", "fL", 80, 100, 5],
  ["NEUT", "Neutrophils", "Hematology", "%", 40, 70, 5], ["LYMPH", "Lymphocytes", "Hematology", "%", 20, 45, 5],
  ["ESR", "ESR", "Inflammation", "mm/hr", 0, 20, 5], ["CRP", "C-Reactive Protein", "Inflammation", "mg/L", 0, 5, 8],
  ["GLU", "Glucose (fasting)", "Biochemistry", "mg/dL", 70, 100, 5], ["HBA1C", "HbA1c", "Diabetes", "%", 4, 5.6, 12],
  ["UREA", "Urea", "Renal", "mg/dL", 15, 40, 5], ["CREA", "Creatinine", "Renal", "mg/dL", 0.6, 1.3, 5],
  ["EGFR", "eGFR", "Renal", "mL/min", 90, 120, 6], ["UA", "Uric Acid", "Renal", "mg/dL", 3.5, 7.2, 5],
  ["NA", "Sodium", "Electrolytes", "mmol/L", 135, 145, 5], ["K", "Potassium", "Electrolytes", "mmol/L", 3.5, 5.1, 5],
  ["CL", "Chloride", "Electrolytes", "mmol/L", 98, 107, 5], ["CA", "Calcium", "Electrolytes", "mg/dL", 8.5, 10.5, 5],
  ["MG", "Magnesium", "Electrolytes", "mg/dL", 1.7, 2.4, 5], ["PHOS", "Phosphate", "Electrolytes", "mg/dL", 2.5, 4.5, 5],
  ["ALT", "ALT", "Liver", "U/L", 7, 56, 5], ["AST", "AST", "Liver", "U/L", 10, 40, 5],
  ["ALP", "Alkaline Phosphatase", "Liver", "U/L", 44, 147, 5], ["GGT", "GGT", "Liver", "U/L", 8, 61, 5],
  ["TBIL", "Total Bilirubin", "Liver", "mg/dL", 0.1, 1.2, 5], ["ALB", "Albumin", "Liver", "g/dL", 3.5, 5.2, 5],
  ["TP", "Total Protein", "Liver", "g/dL", 6, 8.3, 5], ["CHOL", "Total Cholesterol", "Lipids", "mg/dL", 0, 200, 5],
  ["LDL", "LDL Cholesterol", "Lipids", "mg/dL", 0, 130, 5], ["HDL", "HDL Cholesterol", "Lipids", "mg/dL", 40, 90, 5],
  ["TRIG", "Triglycerides", "Lipids", "mg/dL", 0, 150, 5], ["TSH", "TSH", "Endocrine", "mIU/L", 0.4, 4, 9],
  ["FT4", "Free T4", "Endocrine", "ng/dL", 0.8, 1.8, 9], ["FT3", "Free T3", "Endocrine", "pg/mL", 2.3, 4.2, 9],
  ["CORT", "Cortisol", "Endocrine", "µg/dL", 6, 23, 10], ["VITD", "Vitamin D", "Vitamins", "ng/mL", 30, 100, 12],
  ["B12", "Vitamin B12", "Vitamins", "pg/mL", 200, 900, 11], ["FERR", "Ferritin", "Hematology", "ng/mL", 30, 400, 9],
  ["TROP", "Troponin I", "Cardiac", "ng/mL", 0, 0.04, 18], ["BNP", "NT-proBNP", "Cardiac", "pg/mL", 0, 125, 20],
  ["LAC", "Lactate", "Biochemistry", "mmol/L", 0.5, 2.2, 9], ["INR", "INR", "Coagulation", "", 0.8, 1.2, 7],
  ["DDIM", "D-Dimer", "Coagulation", "µg/mL", 0, 0.5, 12], ["PSA", "PSA", "Tumor markers", "ng/mL", 0, 4, 14],
  ["CA153", "CA 15-3", "Tumor markers", "U/mL", 0, 30, 16], ["CEA", "CEA", "Tumor markers", "ng/mL", 0, 3, 14],
];
const labCat: Record<string, { id: string; unit: string; low: number; high: number; name: string }> = {};
for (const [code, name, cat, unit, low, high, price] of LAB) {
  const id = newId();
  labCat[code] = { id, unit, low, high, name };
  insert("lab_catalog", { id, code, name, category: cat, unit, ref_low: low, ref_high: high, price });
}

// ---- service catalog (cashier) ----
const SERVICES: Array<[string, string, number, string]> = [
  ["Specialist consultation", "Consultation", 120, ""], ["Follow-up consultation", "Consultation", 70, ""],
  ["Complete Blood Count (CBC)", "Laboratory", 36, "LAB"], ["Comprehensive Metabolic Panel", "Laboratory", 72, "LAB"],
  ["Lipid Panel", "Laboratory", 48, "LAB"], ["Liver Function Panel", "Laboratory", 54, "LAB"], ["Thyroid Panel", "Laboratory", 66, "LAB"],
  ["Cardiac Markers", "Laboratory", 90, "LAB"], ["HbA1c", "Laboratory", 30, "LAB"], ["Tumor Marker Panel", "Laboratory", 110, "LAB"],
  ["ECG", "Procedure", 40, "CARD"], ["Echocardiography", "Procedure", 160, "CARD"], ["Treadmill Stress Test", "Procedure", 180, "CARD"],
  ["Chest X-Ray", "Imaging", 80, "RAD"], ["Abdominal Ultrasound", "Imaging", 110, "RAD"], ["CT Scan", "Imaging", 320, "RAD"],
  ["MRI Scan", "Imaging", 480, "RAD"], ["Mammography", "Imaging", 140, "MAMM"], ["Upper GI Endoscopy", "Procedure", 260, "GAST"],
  ["Colonoscopy", "Procedure", 340, "GAST"], ["Dialysis Session", "Procedure", 220, "NEPH"], ["Physiotherapy Session", "Procedure", 55, "PHYS"],
  ["Dental Cleaning", "Procedure", 70, "STOM"], ["Dental Filling", "Procedure", 95, "STOM"], ["Skin Biopsy", "Procedure", 130, "DERM"],
  ["Eye Examination", "Procedure", 60, "OPH"], ["Audiometry", "Procedure", 50, "ENT"], ["Spirometry", "Procedure", 65, "PULM"],
  ["Minor Surgery", "Procedure", 450, "GSURG"], ["Wound Dressing", "Procedure", 35, ""],
  ["Botox Treatment", "Aesthetic", 380, "PLAS"], ["Rhinoplasty Consultation", "Consultation", 150, "PLAS"],
  ["Full Health Check-up", "Package", 420, ""], ["Pre-operative Package", "Package", 290, ""], ["Cardiac Screening Package", "Package", 360, "CARD"],
  ["Psychology Session", "Consultation", 90, "PSY"], ["Nutrition Consultation", "Consultation", 80, "DIET"],
];
SERVICES.forEach(([name, category, price, code]) => insert("service_catalog", { id: newId(), code: name.slice(0, 4).toUpperCase(), name, category, price, department_id: code ? dept[code] : null }));

// ---- medications ----
const MEDS: Array<[string, string, string, number, number, string[]]> = [
  ["Amoxicillin", "Capsule", "500 mg", 480, 50, []], ["Atorvastatin", "Tablet", "20 mg", 360, 40, []], ["Metformin", "Tablet", "850 mg", 300, 40, []],
  ["Aspirin", "Tablet", "75 mg", 800, 60, ["Warfarin"]], ["Warfarin", "Tablet", "5 mg", 120, 30, ["Aspirin", "Amoxicillin"]],
  ["Furosemide", "Injection", "40 mg", 90, 20, []], ["Noradrenaline", "Injection", "4 mg/4 mL", 40, 15, []], ["Paracetamol", "Tablet", "1 g", 900, 80, []],
  ["Morphine", "Injection", "10 mg/mL", 60, 15, []], ["Ceftriaxone", "Injection", "1 g", 200, 30, []], ["Insulin Glargine", "Pen", "100 U/mL", 70, 20, []],
  ["Omeprazole", "Capsule", "20 mg", 400, 40, []], ["Salbutamol", "Inhaler", "100 mcg", 150, 25, []], ["Heparin", "Injection", "5000 IU", 80, 20, ["Aspirin"]],
  ["Levothyroxine", "Tablet", "100 mcg", 220, 30, []], ["Amlodipine", "Tablet", "5 mg", 340, 40, []], ["Prednisolone", "Tablet", "5 mg", 260, 30, []],
  ["Ciprofloxacin", "Tablet", "500 mg", 180, 25, []],
];
const med: Record<string, string> = {};
for (const [name, form, strength, stock, reorder, inter] of MEDS) {
  const id = newId(); med[name] = id;
  insert("med_catalog", { id, name, form, strength, atc: "N/A", stock, reorder_level: reorder, price: 2 + name.length, interactions: JSON.stringify(inter) });
}

// ---- patients ----
const PF = ["Aysel", "Daniel", "Mara", "Kenji", "Lucia", "Ibrahim", "Nora", "Viktor", "Chen", "Fatima", "Leo", "Sara", "Ahmed", "Olga", "Paolo", "Zara", "Tural", "Sevda", "Rashad", "Mina", "Karim", "Dina", "Hugo", "Anya", "Samir", "Elnur", "Gunel", "Orхan", "Nigar", "Farid"];
const PL = ["Karimova", "Fischer", "Lopez", "Tanaka", "Rossi", "Khan", "Berg", "Novak", "Wang", "Hassan", "Brandt", "Yilmaz", "Aliyev", "Petrov", "Conti", "Said", "Mammadov", "Guliyeva", "Hasanli", "Nazarova", "Abbasov", "Quliyev", "Ismayilova", "Babayev"];
const BLOOD = ["A+", "O+", "B+", "AB+", "A-", "O-", "B-"];
const ALLERG = [["Penicillin"], [], ["Latex", "Aspirin"], ["Sulfa drugs"], [], ["Iodine contrast"], ["Peanuts"], []];
const CHRONIC = [["Hypertension"], ["Type 2 Diabetes"], [], ["Asthma"], ["Hypertension", "CKD"], [], ["COPD"], ["Hypothyroidism"]];
const patients: string[] = [];
for (let i = 0; i < 30; i++) {
  const id = newId(); patients.push(id);
  const g = i % 2 === 0 ? "female" : "male";
  const name = `${pick(PF)} ${pick(PL)}`;
  insert("patients", {
    id, mrn: mrn(), full_name: name, gender: g, birth_date: iso(-60 * 24 * 365 * (16 + (i * 3) % 72)).slice(0, 10),
    blood_group: pick(BLOOD), phone: `+1 555 3${String(i).padStart(3, "0")}`, email: `patient${i}@example.com`,
    address: `${100 + i} Maple Ave, Springfield`, national_id: `ID${900000 + i}`, emergency_contact: `${pick(PF)} · +1 555 9${String(i).padStart(3, "0")}`,
    allergies: JSON.stringify(pick(ALLERG)), chronic_conditions: JSON.stringify(pick(CHRONIC)),
    payer_type: pick(["self", "insurance", "corporate", "insurance"]), payer_name: pick(["—", "BlueShield", "Acme Corp", "MediCare Plus"]),
    policy_no: i % 2 ? `POL-${500 + i}` : null, photo_color: pick(["#0ea5e9", "#6366f1", "#ec4899", "#16a34a", "#f59e0b"]),
  });
}

// ---- beds ----
const beds: { icu: string[]; nicu: string[]; ward: string[] } = { icu: [], nicu: [], ward: [] };
for (let i = 1; i <= 8; i++) { const id = newId(); beds.icu.push(id); insert("beds", { id, department_id: dept.ANES, ward: "Reanimation", room: `R-${i}`, label: `REA-${i}`, type: "icu", status: i <= 6 ? "occupied" : "available" }); }
for (let i = 1; i <= 6; i++) { const id = newId(); beds.nicu.push(id); insert("beds", { id, department_id: dept.NICU, ward: "NICU", room: `N-${i}`, label: `NICU-${i}`, type: "icu", status: i <= 3 ? "occupied" : "available" }); }
for (let i = 1; i <= 14; i++) { const id = newId(); beds.ward.push(id); insert("beds", { id, department_id: dept.THER, ward: "Ward A", room: `A-${i}`, label: `A-${i}`, type: "general", status: i <= 6 ? "occupied" : "available" }); }

// ---- encounters ----
interface Enc { id: string; patient: string; type: string; dept: string; attending: string; bed?: string; status: string; cc: string; dx?: string; acuity?: string; admittedAt?: string; icu?: boolean; }
const encounters: Enc[] = [];
function addEnc(e: Omit<Enc, "id">): Enc {
  const id = newId(); const full = { ...e, id }; encounters.push(full);
  insert("encounters", { id, visit_no: visitNo(), patient_id: e.patient, type: e.type, department_id: e.dept, attending_id: e.attending,
    bed_id: e.bed ?? null, status: e.status, chief_complaint: e.cc, diagnosis: e.dx ?? null, acuity: e.acuity ?? null, admitted_at: e.admittedAt ?? null });
  return full;
}
const headDoc = (code: string) => docsByDept[code][0];
// Reanimation (ANES, kind icu) admitted → live board
const reaCC = ["Septic shock", "Post-op monitoring", "Respiratory failure", "Severe pneumonia", "DKA", "Polytrauma"];
for (let i = 0; i < 6; i++) addEnc({ patient: patients[i], type: "inpatient", dept: dept.ANES, attending: headDoc("ANES"), bed: beds.icu[i], status: "admitted", cc: reaCC[i], dx: reaCC[i], admittedAt: iso(-60 * (5 + i * 7)), icu: true });
// NICU admitted → live board
for (let i = 0; i < 3; i++) addEnc({ patient: patients[6 + i], type: "inpatient", dept: dept.NICU, attending: headDoc("NICU"), bed: beds.nicu[i], status: "admitted", cc: "Prematurity", dx: "Preterm neonate", admittedAt: iso(-60 * (10 + i * 9)), icu: true });
// ED triage
addEnc({ patient: patients[9], type: "emergency", dept: dept.ED, attending: headDoc("ED"), status: "in_progress", cc: "Chest pain", acuity: "red", admittedAt: iso(-35) });
addEnc({ patient: patients[10], type: "emergency", dept: dept.ED, attending: headDoc("ED"), status: "in_progress", cc: "Ankle injury", acuity: "green", admittedAt: iso(-50) });
addEnc({ patient: patients[11], type: "emergency", dept: dept.ED, attending: headDoc("ED"), status: "open", cc: "High fever", acuity: "yellow", admittedAt: iso(-12) });
const anonId = newId();
insert("patients", { id: anonId, mrn: mrn(), full_name: "Unknown · ED Trauma", gender: "male", is_anonymous: 1, blood_group: "O+", photo_color: "#ef4444" });
addEnc({ patient: anonId, type: "emergency", dept: dept.ED, attending: headDoc("ED"), status: "in_progress", cc: "Unresponsive, RTA", acuity: "red", admittedAt: iso(-8) });
// inpatient wards
addEnc({ patient: patients[12], type: "inpatient", dept: dept.THER, attending: staff.admin, bed: beds.ward[0], status: "admitted", cc: "Pneumonia", dx: "CAP", admittedAt: iso(-60 * 30) });
addEnc({ patient: patients[13], type: "inpatient", dept: dept.INF, attending: headDoc("INF"), bed: beds.ward[1], status: "admitted", cc: "Sepsis workup", dx: "Sepsis", admittedAt: iso(-60 * 14) });
// outpatient encounters across many departments (drive doctor workspaces with results)
const outDepts = ["PLAS", "CARD", "DERM", "GAST", "ENDO", "ORT", "URO", "OPH", "ENT", "MAMM", "HEM", "NEUR", "PED", "PULM", "NEPH"];
const outCC: Record<string, string> = { PLAS: "Rhinoplasty consultation", CARD: "Palpitations", DERM: "Skin lesion", GAST: "Abdominal pain", ENDO: "Diabetes review", ORT: "Knee pain", URO: "Flank pain", OPH: "Blurred vision", ENT: "Hearing loss", MAMM: "Breast lump screening", HEM: "Anemia workup", NEUR: "Migraine", PED: "Well-child visit", PULM: "Chronic cough", NEPH: "CKD follow-up" };
outDepts.forEach((code, idx) => {
  for (let j = 0; j < 2; j++) {
    const doc = docsByDept[code][j % docsByDept[code].length];
    addEnc({ patient: patients[14 + (idx + j) % 16], type: "outpatient", dept: dept[code], attending: doc, status: j === 0 ? "in_progress" : "open", cc: outCC[code] ?? "Consultation" });
  }
});

// historical vitals for ICU/NICU
for (const e of encounters.filter((x) => x.icu)) {
  const n = parseInt(e.id.slice(-3), 36);
  for (let t = 6; t >= 1; t--) insert("vitals", { id: newId(), encounter_id: e.id, hr: 72 + (n % 30) + t, bp_sys: 110 + (n % 24), bp_dia: 66 + (n % 16), spo2: 94 + (n % 4), resp: 15 + (n % 5), temp: 36.7 + ((n % 10) / 10), news2: 2 + (t % 4), source: "monitor", captured_at: iso(-t * 20) });
}
// notes
for (const e of encounters.slice(0, 14)) insert("notes", { id: newId(), encounter_id: e.id, author_id: e.attending, kind: "progress", body: `Assessed for ${e.cc.toLowerCase()}. Plan: investigations ordered, review results and continue management.` });

// ---- lab orders + results (many) ----
const FLAGS = (code: string, cat: { low: number; high: number }, n: number, special?: string) => {
  let value: number, flag = "normal";
  if (special === "critical") { value = +(cat.high * 2.2).toFixed(2); flag = "critical"; }
  else if (n % 9 === 0) { value = +(cat.high * 1.4).toFixed(2); flag = "high"; }
  else if (n % 13 === 0) { value = +(cat.low * 0.6).toFixed(2); flag = "low"; }
  else value = +(cat.low + ((n % 100) / 100) * (cat.high - cat.low)).toFixed(2);
  return { value, flag };
};
function labOrder(enc: Enc, codes: string[], status: string, ordererId: string, criticalCode?: string) {
  const oid = newId();
  insert("orders", { id: oid, encounter_id: enc.id, kind: "lab", name: codes.length > 3 ? "Lab panel" : codes.map((c) => labCat[c]?.name).join(", "), priority: enc.acuity === "red" ? "stat" : "routine", status, ordered_by: ordererId, target_department_id: dept.LAB, resulted_at: ["resulted", "validated"].includes(status) ? iso(-30) : null });
  if (["resulted", "validated"].includes(status)) {
    codes.forEach((c, k) => {
      const cat = labCat[c]; if (!cat) return;
      const { value, flag } = FLAGS(c, cat, parseInt(oid.slice(-3), 36) + k * 7, criticalCode === c ? "critical" : undefined);
      insert("lab_results", { id: newId(), order_id: oid, analyte: cat.name, value: String(value), unit: cat.unit, ref_range: `${cat.low}–${cat.high}`, flag, stage: status === "validated" ? "validated" : "tech_validated", validated_by: status === "validated" ? staff.lab1 : null });
    });
  }
  return oid;
}
// resulted labs for outpatient encounters (so each doctor's workspace shows results to review)
const PANELS = [["WBC", "HGB", "PLT", "NEUT", "CRP"], ["GLU", "HBA1C", "CHOL", "LDL", "HDL", "TRIG"], ["ALT", "AST", "ALP", "TBIL", "ALB"], ["UREA", "CREA", "EGFR", "NA", "K"], ["TSH", "FT4", "FT3"], ["TROP", "BNP", "K"], ["PSA", "CREA"], ["CA153", "CEA", "WBC"], ["FERR", "B12", "VITD", "HGB"]];
encounters.filter((e) => e.type === "outpatient").forEach((e, i) => {
  labOrder(e, pick(PANELS), i % 4 === 0 ? "resulted" : "validated", e.attending);
});
// the plastic-surgery demo flow: head plastic surgeon ordered labs that are now validated and ready to present
labOrder(encounters.find((e) => e.dept === dept.PLAS)!, ["WBC", "HGB", "PLT", "GLU", "ALT", "AST", "CREA", "INR"], "validated", headDoc("PLAS"));
// critical labs for ICU/ED
labOrder(encounters[0], ["WBC", "HGB", "LAC", "CRP", "CREA"], "validated", headDoc("ANES"), "LAC");
labOrder(encounters.find((e) => e.acuity === "red")!, ["TROP", "K", "NA", "GLU"], "resulted", headDoc("ED"), "TROP");
// some pending
labOrder(encounters[12], ["WBC", "CRP", "GLU"], "in_progress", staff.admin);
labOrder(encounters[13], ["WBC", "CRP", "LAC", "CREA"], "collected", headDoc("INF"));

// ---- radiology ----
function radOrder(enc: Enc, modality: string, bodyPart: string, status: string, ordererId: string, findings = "", impression = "") {
  const oid = newId();
  insert("orders", { id: oid, encounter_id: enc.id, kind: "radiology", name: `${modality} ${bodyPart}`, priority: enc.acuity === "red" ? "stat" : "routine", status: status === "reported" ? "validated" : "in_progress", ordered_by: ordererId, target_department_id: dept.RAD, resulted_at: status === "reported" ? iso(-40) : null });
  insert("rad_studies", { id: newId(), order_id: oid, modality, body_part: bodyPart, status, image_seed: oid.slice(-6), findings, impression, radiologist_id: status === "reported" ? staff.rad1 : null });
}
radOrder(encounters.find((e) => e.acuity === "red")!, "X-Ray", "Chest", "reported", headDoc("ED"), "Mild cardiomegaly. No acute infiltrate.", "No acute cardiopulmonary process.");
radOrder(encounters[12], "X-Ray", "Chest", "reported", staff.admin, "Right lower lobe consolidation.", "Pneumonia.");
radOrder(encounters.find((e) => e.dept === dept.NEUR)!, "CT", "Head", "acquired", headDoc("NEUR"));
radOrder(encounters.find((e) => e.dept === dept.MAMM)!, "Mammography", "Breast", "reported", headDoc("MAMM"), "Scattered fibroglandular densities. No suspicious mass.", "BI-RADS 2 — benign.");
radOrder(encounters.find((e) => e.dept === dept.ORT)!, "MRI", "Knee", "reported", headDoc("ORT"), "Partial ACL tear.", "ACL injury — orthopedic review advised.");

// ---- prescriptions ----
function rx(enc: Enc, name: string, dose: string, route: string, freq: string, dur: string, status: string, byId: string) {
  insert("prescriptions", { id: newId(), encounter_id: enc.id, med_id: med[name], name, dose, route, frequency: freq, duration: dur, qty: 14, status, prescribed_by: byId, dispensed_by: status === "dispensed" ? staff.pharm1 : null });
}
rx(encounters[0], "Ceftriaxone", "1 g", "IV", "BD", "7 days", "verified", headDoc("ANES"));
rx(encounters[0], "Noradrenaline", "0.1 mcg/kg/min", "IV", "Infusion", "ongoing", "dispensed", headDoc("ANES"));
rx(encounters[12], "Amoxicillin", "500 mg", "PO", "TDS", "5 days", "dispensed", staff.admin);
rx(encounters.find((e) => e.dept === dept.ENDO)!, "Metformin", "850 mg", "PO", "BD", "ongoing", "prescribed", headDoc("ENDO"));
rx(encounters.find((e) => e.dept === dept.CARD)!, "Atorvastatin", "20 mg", "PO", "ON", "ongoing", "prescribed", headDoc("CARD"));
rx(encounters.find((e) => e.dept === dept.DERM)!, "Prednisolone", "5 mg", "PO", "OD", "10 days", "verified", headDoc("DERM"));

// ---- referrals (inter-department) ----
function referral(enc: Enc, fromCode: string, toCode: string, fromId: string, toId: string | null, reason: string, status: string, response = "") {
  insert("referrals", { id: newId(), patient_id: enc.patient, encounter_id: enc.id, from_department_id: dept[fromCode], to_department_id: dept[toCode], from_staff_id: fromId, to_staff_id: toId, reason, priority: status === "pending" ? "urgent" : "routine", status, response, responded_at: ["completed", "accepted"].includes(status) ? iso(-20) : null });
}
referral(encounters.find((e) => e.acuity === "red")!, "ED", "CARD", headDoc("ED"), headDoc("CARD"), "Chest pain with troponin rise — assess for ACS.", "accepted", "Reviewed. Dual antiplatelet started, booking angiography.");
referral(encounters.find((e) => e.dept === dept.PLAS)!, "PLAS", "LAB", headDoc("PLAS"), null, "Pre-operative bloods before rhinoplasty.", "completed", "All results within normal limits — fit for surgery.");
referral(encounters.find((e) => e.dept === dept.MAMM)!, "MAMM", "RAD", headDoc("MAMM"), staff.rad1, "Diagnostic mammography for palpable lump.", "completed", "BI-RADS 2, benign.");
referral(encounters[0], "ANES", "NEUR", headDoc("ANES"), headDoc("NEUR"), "Altered consciousness — neuro consult.", "pending");
referral(encounters.find((e) => e.dept === dept.GAST)!, "GAST", "GSURG", headDoc("GAST"), headDoc("GSURG"), "Consider cholecystectomy.", "pending");
referral(encounters[13], "INF", "PULM", headDoc("INF"), headDoc("PULM"), "Persistent hypoxia — pulmonology input.", "pending");

// ---- threads ----
function thread(subject: string, members: string[], msgs: Array<[string, string]>) {
  const tid = newId();
  insert("threads", { id: tid, subject, kind: "direct", created_by: members[0], last_at: iso(-5) });
  for (const m of members) insert("thread_members", { thread_id: tid, staff_id: m, read_at: m === members[0] ? iso(-5) : null });
  msgs.forEach(([a, body], i) => insert("messages", { id: newId(), thread_id: tid, author_id: a, body, created_at: iso(-30 + i * 5) }));
}
thread("Reanimation bed 1 — sepsis", [headDoc("ANES"), staff.nurse1, staff.pharm1], [
  [headDoc("ANES"), "Lactate climbing, started broad-spectrum cover. Please prioritise cultures."],
  [staff.nurse1, "Cultures sent. Noradrenaline at 0.1 mcg/kg/min."],
  [staff.pharm1, "Ceftriaxone verified and dispensed."]]);
thread("Pre-op rhinoplasty bloods", [headDoc("PLAS"), staff.lab1], [
  [headDoc("PLAS"), "Bloods sent for my rhinoplasty patient — can we expedite?"],
  [staff.lab1, "Validated and on your worklist. All normal."]]);

// ---- surgeries ----
const checklist = JSON.stringify({ signIn: true, timeOut: false, signOut: false, counts: { instruments: 24, swabs: 18 } });
insert("surgeries", { id: newId(), encounter_id: encounters.find((e) => e.dept === dept.PLAS)!.id, patient_id: encounters.find((e) => e.dept === dept.PLAS)!.patient, theatre: "Theatre 4", procedure: "Rhinoplasty", surgeon_id: headDoc("PLAS"), anesthesiologist_id: headDoc("ANES"), scheduled_at: iso(60 * 20), duration_min: 120, status: "scheduled", checklist });
insert("surgeries", { id: newId(), patient_id: patients[3], theatre: "Theatre 1", procedure: "Laparoscopic appendectomy", surgeon_id: headDoc("GSURG"), anesthesiologist_id: docsByDept.ANES[1], scheduled_at: iso(300), duration_min: 60, status: "scheduled", checklist });
insert("surgeries", { id: newId(), patient_id: patients[5], theatre: "Theatre 3", procedure: "Coronary artery bypass graft", surgeon_id: headDoc("CVS"), anesthesiologist_id: headDoc("ANES"), scheduled_at: iso(60 * 26), duration_min: 240, status: "scheduled", checklist });
insert("surgeries", { id: newId(), patient_id: patients[1], theatre: "Theatre 2", procedure: "Cesarean section", surgeon_id: headDoc("OBG"), anesthesiologist_id: docsByDept.ANES[2], scheduled_at: iso(-120), duration_min: 75, status: "completed", checklist: JSON.stringify({ signIn: true, timeOut: true, signOut: true, counts: { instruments: 20, swabs: 14 } }) });

// ---- appointments ----
const apptReasons = ["Follow-up", "New consultation", "Review results", "Post-op check", "Medication review", "Procedure"];
let ai = 0;
for (const code of outDepts) {
  for (const sid of docsByDept[code].slice(0, 2)) {
    for (let dDay = 0; dDay < 2; dDay++) {
      insert("appointments", { id: newId(), patient_id: patients[(ai + dDay) % patients.length], staff_id: sid, department_id: dept[code], starts_at: iso(60 * (2 + ai * 2 + dDay * 5)), duration_min: 20, status: pick(["booked", "booked", "arrived", "done"]), reason: pick(apptReasons) });
      ai++;
    }
  }
}

// ---- invoices + receipts data ----
let invN = 0;
function invoice(enc: Enc, items: Array<[string, number, number, string]>, payerType: string, payRatio: number) {
  const id = newId(); invN++;
  let total = 0; for (const [, qty, price] of items) total += qty * price;
  const paid = +(total * payRatio).toFixed(2);
  insert("invoices", { id, number: invoiceNo(invN), patient_id: enc.patient, encounter_id: enc.id, total: +total.toFixed(2), paid, payer_type: payerType, status: payRatio >= 1 ? "paid" : payRatio > 0 ? "partial" : "open" });
  for (const [desc, qty, price, source] of items) insert("invoice_items", { id: newId(), invoice_id: id, description: desc, qty, unit_price: price, amount: +(qty * price).toFixed(2), source });
  if (paid > 0) insert("payments", { id: newId(), invoice_id: id, amount: paid, method: pick(["card", "cash", "insurance"]) });
}
invoice(encounters.find((e) => e.dept === dept.PLAS)!, [["Rhinoplasty Consultation", 1, 150, "consult"], ["Pre-operative Package", 1, 290, "package"], ["Lab panel", 1, 72, "lab"]], "self", 1);
invoice(encounters[12], [["Ward bed — 2 days", 2, 400, "ward"], ["Chest X-Ray", 1, 80, "radiology"], ["Amoxicillin", 15, 4, "pharmacy"], ["CBC", 1, 36, "lab"]], "self", 1);
invoice(encounters.find((e) => e.acuity === "red")!, [["Emergency consult", 1, 120, "consult"], ["Cardiac Markers", 1, 90, "lab"], ["ECG", 2, 40, "procedure"]], "insurance", 0);
invoice(encounters.find((e) => e.dept === dept.CARD)!, [["Specialist consultation", 1, 120, "consult"], ["Echocardiography", 1, 160, "procedure"]], "corporate", 0.5);

// ---- notifications ----
insert("notifications", { id: newId(), scope: "icu", target_role: "nurse", severity: "critical", title: "Critical lactate · REA-1", body: "Lactate elevated — review immediately", link: "/icu", entity: "encounter", entity_id: encounters[0].id });
insert("notifications", { id: newId(), scope: "ed", target_role: "doctor", severity: "warn", title: "Red triage · Chest pain", body: "New red-zone patient awaiting review", link: "/emergency" });
insert("notifications", { id: newId(), scope: "global", target_role: "pharmacy", severity: "warn", title: "Low stock · Noradrenaline", body: "Below reorder level", link: "/pharmacy" });
insert("notifications", { id: newId(), scope: "global", target_staff_id: headDoc("PLAS"), severity: "info", title: "Results ready · pre-op bloods", body: "Validated lab results are on your worklist", link: "/workspace" });

console.log(`Seeded: ${DEPTS.length} departments, ${allDoctors.length} doctors + ${Object.keys(staff).length} support staff, ${patients.length} patients, ${encounters.length} encounters, ${LAB.length} lab analytes, ${SERVICES.length} services.`);
console.log("Login: admin@lumora.health / Lumora2026!  ·  dept heads e.g. plas1@lumora.health, card1@lumora.health (all Lumora2026!)");
