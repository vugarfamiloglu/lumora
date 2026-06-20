import bcrypt from "bcryptjs";
import db from "../app/lib/db.server";
import { newId, mrn, visitNo, staffNo, invoiceNo } from "../app/lib/ids.server";
import { setSetting } from "../app/lib/settings.server";

// ---- helpers ----
function insert(table: string, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((k) => row[k]));
}
const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60000).toISOString();
const pick = <T,>(a: T[], i: number) => a[i % a.length];
const hash = (p: string) => bcrypt.hashSync(p, 10);

const tables = ["payments", "invoice_items", "invoices", "appointments", "surgeries", "messages", "thread_members",
  "threads", "referrals", "prescriptions", "med_catalog", "rad_studies", "lab_results", "lab_catalog", "orders",
  "notes", "vitals", "encounters", "beds", "patients", "schedules", "staff", "departments", "notifications", "audit_logs", "settings"];

console.log("Seeding Lumora…");
db.pragma("foreign_keys = OFF");
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
db.pragma("foreign_keys = ON");

setSetting("hospital_name", "Lumora Medical Center");
setSetting("hospital_tagline", "Hospital Operating System");
setSetting("currency", "USD");
setSetting("accreditation", "JCI Accredited");
setSetting("timezone", "UTC");

// ---- departments ----
const DEPTS: Array<[string, string, string, string, string]> = [
  // code, name, category, kind, color
  ["ED", "Emergency Department", "emergency", "ed", "#ef4444"],
  ["ICU", "Intensive Care Unit", "critical", "icu", "#f43f5e"],
  ["CCU", "Coronary Care Unit", "critical", "ccu", "#fb7185"],
  ["NICU", "Neonatal ICU", "critical", "nicu", "#f472b6"],
  ["OT", "Operating Theatres", "surgical", "ot", "#8b5cf6"],
  ["CSSD", "Sterile Services (CSSD)", "surgical", "cssd", "#a78bfa"],
  ["CARD", "Cardiology", "outpatient", "cardiology", "#6366f1"],
  ["OBG", "Obstetrics & Gynecology", "outpatient", "obgyn", "#ec4899"],
  ["PED", "Pediatrics", "outpatient", "pediatrics", "#0ea5e9"],
  ["ONC", "Oncology", "outpatient", "oncology", "#7c3aed"],
  ["NEU", "Neurology & Neurosurgery", "outpatient", "neurology", "#4f46e5"],
  ["ORT", "Orthopedics", "outpatient", "orthopedics", "#0891b2"],
  ["IM", "Internal Medicine", "inpatient", "internal", "#2563eb"],
  ["LAB", "Central Laboratory", "diagnostic", "lab", "#16a34a"],
  ["RAD", "Radiology", "diagnostic", "radiology", "#0d9488"],
  ["PATH", "Pathology", "diagnostic", "pathology", "#65a30d"],
  ["PHA", "Pharmacy", "support", "pharmacy", "#d97706"],
  ["PHY", "Physiotherapy", "support", "physio", "#ca8a04"],
  ["BB", "Blood Bank", "support", "bloodbank", "#dc2626"],
  ["FIN", "Finance & Billing", "backoffice", "billing", "#475569"],
];
const dept: Record<string, string> = {};
for (const [code, name, category, kind, color] of DEPTS) {
  const id = newId();
  dept[code] = id;
  insert("departments", { id, code, name, category, kind, location: `Block ${code[0]} · L${1 + (code.length % 4)}`, phone: `+1 555 0${100 + DEPTS.findIndex((d) => d[0] === code)}`, color });
}

// ---- staff (rich doctor dossiers) ----
const DEG = (d: string, inst: string, y: number) => ({ degree: d, institution: inst, year: y });
const EXP = (role: string, place: string, from: string, to: string) => ({ role, place, from, to });
type S = { key: string; name: string; role: string; title: string; dept: string; specialty?: string; sub?: string; color: string; gender: string; fee?: number; quals?: object[]; exp?: object[]; langs?: string[]; bio?: string };
const STAFF: S[] = [
  { key: "admin", name: "Dr. Elena Voss", role: "super_admin", title: "Medical Director", dept: "IM", specialty: "Hospital Administration", color: "#4f46e5", gender: "female",
    quals: [DEG("MD", "Charité Berlin", 2001), DEG("MBA Health", "INSEAD", 2010)], exp: [EXP("Medical Director", "Lumora", "2018", "present")], langs: ["English", "German", "French"], bio: "Oversees clinical governance and JCI accreditation across the hospital." },
  { key: "card1", name: "Dr. Marcus Hale", role: "doctor", title: "Consultant Cardiologist", dept: "CARD", specialty: "Cardiology", sub: "Invasive / Angio", color: "#6366f1", gender: "male", fee: 180,
    quals: [DEG("MD", "Johns Hopkins", 1999), DEG("Fellowship Interventional Cardiology", "Cleveland Clinic", 2006)], exp: [EXP("Consultant", "Lumora", "2014", "present"), EXP("Fellow", "Cleveland Clinic", "2004", "2006")], langs: ["English", "Spanish"], bio: "Specialist in coronary angiography, stenting and structural heart disease. 4,000+ catheterizations performed." },
  { key: "ed1", name: "Dr. Priya Nair", role: "doctor", title: "Emergency Physician", dept: "ED", specialty: "Emergency Medicine", color: "#ef4444", gender: "female", fee: 120,
    quals: [DEG("MBBS", "AIIMS Delhi", 2008), DEG("MRCEM", "RCEM London", 2015)], exp: [EXP("Attending", "Lumora ED", "2017", "present")], langs: ["English", "Hindi"], bio: "Leads triage protocols and trauma resuscitation in the emergency department." },
  { key: "icu1", name: "Dr. Tomas Berg", role: "doctor", title: "Intensivist", dept: "ICU", specialty: "Critical Care", sub: "Pulmonary", color: "#f43f5e", gender: "male", fee: 200,
    quals: [DEG("MD", "Karolinska", 2003), DEG("EDIC", "ESICM", 2011)], exp: [EXP("ICU Consultant", "Lumora", "2015", "present")], langs: ["English", "Swedish"], bio: "Manages mechanical ventilation, sepsis bundles and multi-organ support in the ICU." },
  { key: "obg1", name: "Dr. Amara Diallo", role: "doctor", title: "Consultant OB/GYN", dept: "OBG", specialty: "Obstetrics & Gynecology", color: "#ec4899", gender: "female", fee: 160,
    quals: [DEG("MD", "Université Paris Cité", 2005), DEG("MRCOG", "RCOG", 2012)], exp: [EXP("Consultant", "Lumora", "2016", "present")], langs: ["English", "French", "Wolof"], bio: "High-risk pregnancy, fetal monitoring and minimally invasive gynecological surgery." },
  { key: "ped1", name: "Dr. Sofia Ricci", role: "doctor", title: "Pediatrician", dept: "PED", specialty: "Pediatrics", sub: "Neonatology", color: "#0ea5e9", gender: "female", fee: 110,
    quals: [DEG("MD", "Sapienza Rome", 2007)], exp: [EXP("Attending", "Lumora", "2018", "present")], langs: ["English", "Italian"], bio: "Growth monitoring, immunization programs and neonatal care." },
  { key: "onc1", name: "Dr. Daniel Cho", role: "doctor", title: "Medical Oncologist", dept: "ONC", specialty: "Oncology", color: "#7c3aed", gender: "male", fee: 220,
    quals: [DEG("MD", "Seoul National Univ.", 2002), DEG("Fellowship Hematology-Oncology", "MD Anderson", 2009)], exp: [EXP("Consultant", "Lumora", "2013", "present")], langs: ["English", "Korean"], bio: "Designs BSA-based chemotherapy protocols and chairs the weekly tumor board." },
  { key: "neu1", name: "Dr. Hannah Reed", role: "doctor", title: "Neurosurgeon", dept: "NEU", specialty: "Neurosurgery", color: "#4f46e5", gender: "female", fee: 240,
    quals: [DEG("MD", "Oxford", 2000), DEG("FRCS (Neurosurgery)", "RCS", 2008)], exp: [EXP("Consultant", "Lumora", "2012", "present")], langs: ["English"], bio: "Cranial and spinal surgery, neuro-oncology and complex trauma." },
  { key: "surg1", name: "Dr. Omar Haddad", role: "doctor", title: "General Surgeon", dept: "OT", specialty: "General Surgery", color: "#8b5cf6", gender: "male", fee: 170,
    quals: [DEG("MD", "Cairo University", 2004), DEG("FACS", "ACS", 2013)], exp: [EXP("Consultant Surgeon", "Lumora", "2015", "present")], langs: ["English", "Arabic"], bio: "Laparoscopic and emergency general surgery." },
  { key: "nurse1", name: "Lena Park", role: "nurse", title: "ICU Charge Nurse", dept: "ICU", color: "#f59e0b", gender: "female",
    quals: [DEG("BSN", "Univ. of Toronto", 2012)], langs: ["English"], bio: "Critical-care nursing, vitals charting and fluid balance." },
  { key: "nurse2", name: "Grace Owusu", role: "nurse", title: "Emergency Nurse", dept: "ED", color: "#fb923c", gender: "female", langs: ["English"], bio: "Triage and emergency nursing." },
  { key: "lab1", name: "Victor Lim", role: "lab", title: "Senior Lab Scientist", dept: "LAB", color: "#16a34a", gender: "male", langs: ["English"], bio: "Biochemistry and hematology analyzer validation." },
  { key: "rad1", name: "Dr. Nadia Petrova", role: "radiology", title: "Consultant Radiologist", dept: "RAD", specialty: "Radiology", color: "#0d9488", gender: "female", fee: 150,
    quals: [DEG("MD", "Moscow State", 2003), DEG("FRCR", "RCR", 2011)], exp: [EXP("Consultant", "Lumora", "2016", "present")], langs: ["English", "Russian"], bio: "Cross-sectional imaging — CT, MRI and interventional radiology." },
  { key: "pharm1", name: "Yusuf Demir", role: "pharmacy", title: "Chief Pharmacist", dept: "PHA", color: "#d97706", gender: "male", langs: ["English", "Turkish"], bio: "Medication verification, interaction screening and stock control." },
  { key: "recep1", name: "Maria Santos", role: "reception", title: "Front Desk Lead", dept: "ED", color: "#0891b2", gender: "female", langs: ["English", "Portuguese"], bio: "Patient registration and admissions." },
  { key: "bill1", name: "Sam Whitfield", role: "billing", title: "Billing Officer", dept: "FIN", color: "#475569", gender: "male", langs: ["English"], bio: "Insurance, corporate contracts and discharge billing." },
];
const staff: Record<string, string> = {};
STAFF.forEach((s, i) => {
  const id = newId();
  staff[s.key] = id;
  insert("staff", {
    id, staff_no: staffNo(), email: s.key === "admin" ? "admin@lumora.health" : `${s.key}@lumora.health`,
    password_hash: hash(s.key === "admin" ? "Lumora2026!" : "Lumora2026!"),
    full_name: s.name, role: s.role, title: s.title, department_id: dept[s.dept], specialty: s.specialty ?? null,
    subspecialty: s.sub ?? null, phone: `+1 555 1${String(i).padStart(3, "0")}`, gender: s.gender, photo_color: s.color,
    license_no: s.role === "doctor" || s.role === "super_admin" ? `LIC-${10000 + i}` : null,
    license_expiry: s.role === "doctor" ? iso(60 * 24 * (200 + i * 20)) : null,
    qualifications: JSON.stringify(s.quals ?? []), experience: JSON.stringify(s.exp ?? []),
    languages: JSON.stringify(s.langs ?? ["English"]), bio: s.bio ?? "", consult_fee: s.fee ?? 0,
    room: s.role === "doctor" ? `R-${200 + i}` : null, last_login_at: iso(-60 * (i + 1)),
  });
});
// department heads
const heads: Record<string, string> = { CARD: "card1", ED: "ed1", ICU: "icu1", OBG: "obg1", PED: "ped1", ONC: "onc1", NEU: "neu1", OT: "surg1", LAB: "lab1", RAD: "rad1", PHA: "pharm1" };
for (const [code, key] of Object.entries(heads)) db.prepare("UPDATE departments SET head_staff_id = ? WHERE id = ?").run(staff[key], dept[code]);

// schedules for doctors
const docKeys = STAFF.filter((s) => s.role === "doctor").map((s) => s.key);
docKeys.forEach((k, i) => {
  for (const wd of [1, 2, 3, 4, 5]) {
    if ((wd + i) % 2 === 0) insert("schedules", { id: newId(), staff_id: staff[k], weekday: wd, start_min: 9 * 60, end_min: 13 * 60, room: `R-${200 + i}` });
  }
});

// ---- patients ----
const FIRST = ["Aysel", "Daniel", "Mara", "Kenji", "Lucia", "Ibrahim", "Nora", "Viktor", "Chen", "Fatima", "Leo", "Sara", "Ahmed", "Olga", "Paolo", "Zara"];
const LAST = ["Karimova", "Fischer", "Lopez", "Tanaka", "Rossi", "Khan", "Berg", "Novak", "Wang", "Hassan", "Brandt", "Yilmaz", "Aliyev", "Petrov", "Conti", "Said"];
const BLOOD = ["A+", "O+", "B+", "AB+", "A-", "O-", "B-"];
const ALLERG = [["Penicillin"], [], ["Latex", "Aspirin"], ["Sulfa drugs"], [], ["Iodine contrast"], ["Peanuts"], []];
const CHRONIC = [["Hypertension"], ["Type 2 Diabetes"], [], ["Asthma"], ["Hypertension", "CKD"], [], ["COPD"], ["Hypothyroidism"]];
const patients: string[] = [];
for (let i = 0; i < 16; i++) {
  const id = newId();
  patients.push(id);
  const g = i % 2 === 0 ? "female" : "male";
  insert("patients", {
    id, mrn: mrn(), full_name: `${pick(FIRST, i)} ${pick(LAST, i + 3)}`, gender: g,
    birth_date: iso(-60 * 24 * 365 * (18 + (i * 4) % 70)).slice(0, 10), blood_group: pick(BLOOD, i),
    phone: `+1 555 2${String(i).padStart(3, "0")}`, email: `patient${i}@example.com`,
    address: `${100 + i} Maple Ave, Springfield`, national_id: `ID${900000 + i}`,
    emergency_contact: `${pick(FIRST, i + 5)} · +1 555 9${String(i).padStart(3, "0")}`,
    allergies: JSON.stringify(pick(ALLERG, i)), chronic_conditions: JSON.stringify(pick(CHRONIC, i)),
    payer_type: pick(["self", "insurance", "corporate", "insurance"], i), payer_name: pick(["—", "BlueShield", "Acme Corp", "MediCare Plus"], i),
    policy_no: i % 2 ? `POL-${500 + i}` : null, photo_color: pick(["#0ea5e9", "#6366f1", "#ec4899", "#16a34a", "#f59e0b"], i),
  });
}

// ---- beds ----
const beds: { icu: string[]; ccu: string[]; ward: string[] } = { icu: [], ccu: [], ward: [] };
for (let i = 1; i <= 8; i++) { const id = newId(); beds.icu.push(id); insert("beds", { id, department_id: dept.ICU, ward: "ICU", room: `ICU-${i}`, label: `ICU-${i}`, type: "icu", status: i <= 6 ? "occupied" : "available" }); }
for (let i = 1; i <= 4; i++) { const id = newId(); beds.ccu.push(id); insert("beds", { id, department_id: dept.CCU, ward: "CCU", room: `CCU-${i}`, label: `CCU-${i}`, type: "icu", status: i <= 2 ? "occupied" : "available" }); }
for (let i = 1; i <= 12; i++) { const id = newId(); beds.ward.push(id); insert("beds", { id, department_id: dept.IM, ward: "Ward A", room: `A-${i}`, label: `A-${i}`, type: "general", status: i <= 5 ? "occupied" : "available" }); }

// ---- encounters ----
interface Enc { id: string; patient: string; type: string; dept: string; attending: string; bed?: string; status: string; cc: string; dx?: string; acuity?: string; admittedAt?: string; icu?: boolean; }
const encounters: Enc[] = [];
function addEnc(e: Omit<Enc, "id">): Enc {
  const id = newId();
  const full = { ...e, id };
  encounters.push(full);
  insert("encounters", {
    id, visit_no: visitNo(), patient_id: e.patient, type: e.type, department_id: e.dept, attending_id: e.attending,
    bed_id: e.bed ?? null, status: e.status, chief_complaint: e.cc, diagnosis: e.dx ?? null, acuity: e.acuity ?? null,
    admitted_at: e.admittedAt ?? null,
  });
  return full;
}
// ICU admitted (drive the live board)
const icuComplaints = ["Septic shock", "Post-op monitoring", "Respiratory failure", "Severe pneumonia", "DKA", "Multi-trauma"];
for (let i = 0; i < 6; i++) addEnc({ patient: patients[i], type: "inpatient", dept: dept.ICU, attending: staff.icu1, bed: beds.icu[i], status: "admitted", cc: icuComplaints[i], dx: icuComplaints[i], admittedAt: iso(-60 * (5 + i * 8)), icu: true });
// CCU admitted
addEnc({ patient: patients[6], type: "inpatient", dept: dept.CCU, attending: staff.card1, bed: beds.ccu[0], status: "admitted", cc: "Acute MI", dx: "STEMI", admittedAt: iso(-60 * 20) });
// ED active with triage
addEnc({ patient: patients[7], type: "emergency", dept: dept.ED, attending: staff.ed1, status: "in_progress", cc: "Chest pain", acuity: "red", admittedAt: iso(-35) });
addEnc({ patient: patients[8], type: "emergency", dept: dept.ED, attending: staff.ed1, status: "in_progress", cc: "Ankle injury", acuity: "green", admittedAt: iso(-50) });
addEnc({ patient: patients[9], type: "emergency", dept: dept.ED, attending: staff.ed1, status: "open", cc: "High fever", acuity: "yellow", admittedAt: iso(-12) });
const anonId = newId();
insert("patients", { id: anonId, mrn: mrn(), full_name: "Unknown · ED Trauma", gender: "male", is_anonymous: 1, blood_group: "O+", photo_color: "#ef4444" });
addEnc({ patient: anonId, type: "emergency", dept: dept.ED, attending: staff.ed1, status: "in_progress", cc: "Unresponsive, RTA", acuity: "red", admittedAt: iso(-8) });
// Inpatient ward
addEnc({ patient: patients[10], type: "inpatient", dept: dept.IM, attending: staff.admin, bed: beds.ward[0], status: "admitted", cc: "Pneumonia", dx: "Community-acquired pneumonia", admittedAt: iso(-60 * 30) });
// Outpatient
addEnc({ patient: patients[11], type: "outpatient", dept: dept.CARD, attending: staff.card1, status: "closed", cc: "Palpitations", dx: "Atrial fibrillation" });
addEnc({ patient: patients[12], type: "outpatient", dept: dept.ONC, attending: staff.onc1, status: "in_progress", cc: "Follow-up chemo", dx: "Breast carcinoma" });
addEnc({ patient: patients[13], type: "outpatient", dept: dept.OBG, attending: staff.obg1, status: "open", cc: "Antenatal check", dx: "Pregnancy 28w" });
addEnc({ patient: patients[14], type: "outpatient", dept: dept.PED, attending: staff.ped1, status: "open", cc: "Well-child visit" });

// historical vitals for ICU encounters (live sim adds more)
for (const e of encounters.filter((x) => x.icu)) {
  const n = parseInt(e.id.slice(-3), 36);
  for (let t = 6; t >= 1; t--) {
    insert("vitals", { id: newId(), encounter_id: e.id, hr: 72 + (n % 30) + t, bp_sys: 112 + (n % 24), bp_dia: 68 + (n % 16),
      spo2: 94 + (n % 4), resp: 15 + (n % 5), temp: 36.7 + ((n % 10) / 10), news2: 2 + (t % 4), source: "monitor", captured_at: iso(-t * 20) });
  }
}

// notes
for (const e of encounters.slice(0, 8)) insert("notes", { id: newId(), encounter_id: e.id, author_id: e.attending, kind: "progress", body: `Patient assessed. Plan: continue current management for ${e.cc.toLowerCase()}; review labs.` });

// ---- lab catalog + orders/results ----
const LAB: Array<[string, string, string, string, number, number, number]> = [
  ["WBC", "White Blood Cells", "Hematology", "10^9/L", 4, 11, 6],
  ["HGB", "Hemoglobin", "Hematology", "g/dL", 12, 17, 6],
  ["PLT", "Platelets", "Hematology", "10^9/L", 150, 400, 6],
  ["GLU", "Glucose", "Biochemistry", "mg/dL", 70, 110, 5],
  ["CREA", "Creatinine", "Biochemistry", "mg/dL", 0.6, 1.3, 5],
  ["K", "Potassium", "Biochemistry", "mmol/L", 3.5, 5.1, 5],
  ["NA", "Sodium", "Biochemistry", "mmol/L", 135, 145, 5],
  ["CRP", "C-Reactive Protein", "Immunology", "mg/L", 0, 5, 8],
  ["TROP", "Troponin I", "Cardiac", "ng/mL", 0, 0.04, 18],
  ["LAC", "Lactate", "Biochemistry", "mmol/L", 0.5, 2.2, 9],
  ["INR", "INR", "Coagulation", "", 0.8, 1.2, 7],
  ["TSH", "TSH", "Endocrine", "mIU/L", 0.4, 4, 9],
];
const labCat: Record<string, { id: string; unit: string; low: number; high: number }> = {};
for (const [code, name, cat, unit, low, high, price] of LAB) {
  const id = newId();
  labCat[code] = { id, unit, low, high };
  insert("lab_catalog", { id, code, name, category: cat, unit, ref_low: low, ref_high: high, price });
}
function labOrder(enc: Enc, codes: string[], status: string, ordererKey: string) {
  const oid = newId();
  insert("orders", { id: oid, encounter_id: enc.id, kind: "lab", name: codes.length > 2 ? "Lab panel" : codes.map((c) => labCat[c] && LAB.find((l) => l[0] === c)?.[1]).join(", "), priority: enc.acuity === "red" ? "stat" : "routine", status, ordered_by: staff[ordererKey], target_department_id: dept.LAB, resulted_at: status === "validated" || status === "resulted" ? iso(-30) : null });
  if (status === "resulted" || status === "validated") {
    for (const c of codes) {
      const cat = labCat[c]; if (!cat) continue;
      const n = parseInt(oid.slice(-3), 36) + c.length;
      let val = +(cat.low + ((n % 100) / 100) * (cat.high - cat.low)).toFixed(2);
      let flag = "normal";
      if (c === "TROP" && enc.cc.includes("MI")) { val = 2.4; flag = "critical"; }
      else if (c === "LAC" && enc.cc.includes("shock")) { val = 4.6; flag = "critical"; }
      else if (n % 7 === 0) { val = +(cat.high * 1.3).toFixed(2); flag = "high"; }
      else if (n % 11 === 0) { val = +(cat.low * 0.7).toFixed(2); flag = "low"; }
      insert("lab_results", { id: newId(), order_id: oid, analyte: LAB.find((l) => l[0] === c)?.[1] ?? c, value: String(val), unit: cat.unit, ref_range: `${cat.low}–${cat.high}`, flag, stage: status === "validated" ? "validated" : "tech_validated", validated_by: status === "validated" ? staff.lab1 : null });
    }
  }
  return oid;
}
labOrder(encounters[0], ["WBC", "HGB", "PLT", "CRP", "LAC"], "validated", "icu1");
labOrder(encounters[6], ["TROP", "K", "NA", "CREA"], "validated", "card1");
labOrder(encounters[7], ["TROP", "GLU", "K"], "resulted", "ed1");
labOrder(encounters[9], ["WBC", "CRP", "GLU"], "in_progress", "ed1");
labOrder(encounters[12], ["WBC", "PLT", "CREA"], "ordered", "onc1");
labOrder(encounters[1], ["GLU", "K", "NA", "CREA", "LAC"], "collected", "icu1");

// ---- radiology ----
function radOrder(enc: Enc, modality: string, bodyPart: string, status: string, ordererKey: string, findings = "", impression = "") {
  const oid = newId();
  insert("orders", { id: oid, encounter_id: enc.id, kind: "radiology", name: `${modality} ${bodyPart}`, priority: enc.acuity === "red" ? "stat" : "routine", status: status === "reported" ? "validated" : "in_progress", ordered_by: staff[ordererKey], target_department_id: dept.RAD, resulted_at: status === "reported" ? iso(-40) : null });
  insert("rad_studies", { id: newId(), order_id: oid, modality, body_part: bodyPart, status, image_seed: oid.slice(-6), findings, impression, radiologist_id: status === "reported" ? staff.rad1 : null });
}
radOrder(encounters[7], "X-Ray", "Chest", "reported", "ed1", "Mild cardiomegaly. No acute infiltrate.", "No acute cardiopulmonary process.");
radOrder(encounters[10], "X-Ray", "Chest", "reported", "admin", "Right lower lobe consolidation.", "Findings consistent with pneumonia.");
radOrder(encounters[9], "CT", "Head", "acquired", "ed1");
radOrder(encounters[2], "CT", "Chest", "scheduled", "icu1");
radOrder(encounters[12], "MRI", "Breast", "reported", "onc1", "Stable post-treatment changes.", "No evidence of disease progression.");

// ---- medications + prescriptions ----
const MEDS: Array<[string, string, string, number, number, string[]]> = [
  ["Amoxicillin", "Capsule", "500 mg", 480, 50, []],
  ["Atorvastatin", "Tablet", "20 mg", 360, 40, []],
  ["Metformin", "Tablet", "850 mg", 300, 40, []],
  ["Aspirin", "Tablet", "75 mg", 800, 60, ["Warfarin"]],
  ["Warfarin", "Tablet", "5 mg", 120, 30, ["Aspirin", "Amoxicillin"]],
  ["Furosemide", "Injection", "40 mg", 90, 20, []],
  ["Noradrenaline", "Injection", "4 mg/4 mL", 40, 15, []],
  ["Paracetamol", "Tablet", "1 g", 900, 80, []],
  ["Morphine", "Injection", "10 mg/mL", 60, 15, []],
  ["Ceftriaxone", "Injection", "1 g", 200, 30, []],
  ["Insulin Glargine", "Pen", "100 U/mL", 70, 20, []],
  ["Omeprazole", "Capsule", "20 mg", 400, 40, []],
  ["Salbutamol", "Inhaler", "100 mcg", 150, 25, []],
  ["Heparin", "Injection", "5000 IU", 80, 20, ["Aspirin"]],
];
const med: Record<string, string> = {};
for (const [name, form, strength, stock, reorder, inter] of MEDS) {
  const id = newId(); med[name] = id;
  insert("med_catalog", { id, name, form, strength, atc: "N/A", stock, reorder_level: reorder, price: 2 + name.length, interactions: JSON.stringify(inter) });
}
function rx(enc: Enc, name: string, dose: string, route: string, freq: string, dur: string, status: string, byKey: string) {
  insert("prescriptions", { id: newId(), encounter_id: enc.id, med_id: med[name], name, dose, route, frequency: freq, duration: dur, qty: 14, status, prescribed_by: staff[byKey], dispensed_by: status === "dispensed" ? staff.pharm1 : null });
}
rx(encounters[0], "Ceftriaxone", "1 g", "IV", "BD", "7 days", "verified", "icu1");
rx(encounters[0], "Noradrenaline", "0.1 mcg/kg/min", "IV", "Infusion", "ongoing", "dispensed", "icu1");
rx(encounters[6], "Aspirin", "75 mg", "PO", "OD", "ongoing", "dispensed", "card1");
rx(encounters[6], "Atorvastatin", "20 mg", "PO", "ON", "ongoing", "prescribed", "card1");
rx(encounters[7], "Morphine", "5 mg", "IV", "PRN", "stat", "verified", "ed1");
rx(encounters[10], "Amoxicillin", "500 mg", "PO", "TDS", "5 days", "dispensed", "admin");
rx(encounters[13], "Insulin Glargine", "12 U", "SC", "ON", "ongoing", "prescribed", "obg1");

// ---- referrals (inter-department) ----
function referral(enc: Enc, fromKey: string, fromCode: string, toCode: string, toKey: string | null, reason: string, status: string, response = "") {
  insert("referrals", { id: newId(), patient_id: enc.patient, encounter_id: enc.id, from_department_id: dept[fromCode], to_department_id: dept[toCode], from_staff_id: staff[fromKey], to_staff_id: toKey ? staff[toKey] : null, reason, priority: status === "pending" ? "urgent" : "routine", status, response, responded_at: status === "completed" || status === "accepted" ? iso(-20) : null });
}
referral(encounters[7], "ed1", "ED", "CARD", "card1", "Chest pain with troponin rise — please assess for ACS.", "accepted", "Reviewed. Started dual antiplatelet, booking angiography.");
referral(encounters[9], "ed1", "ED", "RAD", "rad1", "Persistent headache post-fall — request CT head.", "completed", "CT head acquired, report pending.");
referral(encounters[12], "onc1", "ONC", "RAD", "rad1", "Restaging MRI breast prior to next cycle.", "completed", "No progression. Cleared for chemotherapy.");
referral(encounters[0], "icu1", "ICU", "NEU", "neu1", "Altered consciousness — neuro consult requested.", "pending");
referral(encounters[10], "admin", "IM", "PHY", null, "Post-pneumonia chest physiotherapy.", "pending");
referral(encounters[6], "card1", "CCU", "OT", "surg1", "Consider CABG if angiography shows triple-vessel disease.", "pending");

// ---- threads + messages ----
function thread(subject: string, patientIdx: number | null, members: string[], msgs: Array<[string, string]>) {
  const tid = newId();
  insert("threads", { id: tid, subject, patient_id: patientIdx != null ? patients[patientIdx] : null, kind: "direct", created_by: staff[members[0]], last_at: iso(-5) });
  for (const m of members) insert("thread_members", { thread_id: tid, staff_id: staff[m], read_at: m === members[0] ? iso(-5) : null });
  msgs.forEach(([k, body], i) => insert("messages", { id: newId(), thread_id: tid, author_id: staff[k], body, created_at: iso(-30 + i * 5) }));
}
thread("ICU bed 1 — sepsis management", 0, ["icu1", "nurse1", "pharm1"], [
  ["icu1", "Started broad-spectrum antibiotics, lactate trending up. Please prioritise blood cultures."],
  ["nurse1", "Cultures sent. Noradrenaline running at 0.1 mcg/kg/min."],
  ["pharm1", "Ceftriaxone verified and dispensed. Watch renal function with current doses."],
]);
thread("MI patient — angiography slot", 6, ["card1", "surg1"], [
  ["card1", "STEMI in CCU-1, troponin 2.4. Can we get a cath lab slot this afternoon?"],
  ["surg1", "Theatre 2 free at 15:00. Surgical standby on alert."],
]);
thread("Chemo protocol query", 12, ["onc1", "pharm1"], [
  ["onc1", "BSA 1.72 m². Please verify carboplatin AUC 5 dosing for next cycle."],
  ["pharm1", "Calculated dose prepared. Pre-meds added to the chart."],
]);

// ---- surgeries ----
const checklist = JSON.stringify({ signIn: true, timeOut: false, signOut: false, counts: { instruments: 24, swabs: 18 } });
insert("surgeries", { id: newId(), encounter_id: encounters[6].id, patient_id: patients[6], theatre: "Theatre 2", procedure: "Coronary angiography ± PCI", surgeon_id: staff.card1, anesthesiologist_id: staff.surg1, scheduled_at: iso(180), duration_min: 90, status: "scheduled", checklist });
insert("surgeries", { id: newId(), encounter_id: null, patient_id: patients[3], theatre: "Theatre 1", procedure: "Laparoscopic appendectomy", surgeon_id: staff.surg1, anesthesiologist_id: staff.icu1, scheduled_at: iso(300), duration_min: 60, status: "scheduled", checklist });
insert("surgeries", { id: newId(), encounter_id: null, patient_id: patients[5], theatre: "Theatre 3", procedure: "Craniotomy for tumor resection", surgeon_id: staff.neu1, anesthesiologist_id: staff.icu1, scheduled_at: iso(60 * 26), duration_min: 240, status: "scheduled", checklist });
insert("surgeries", { id: newId(), encounter_id: null, patient_id: patients[1], theatre: "Theatre 2", procedure: "Cesarean section", surgeon_id: staff.obg1, anesthesiologist_id: staff.icu1, scheduled_at: iso(-120), duration_min: 75, status: "completed", checklist: JSON.stringify({ signIn: true, timeOut: true, signOut: true, counts: { instruments: 20, swabs: 14 } }) });

// ---- appointments ----
const apptReasons = ["Follow-up", "New consultation", "Review results", "Antenatal", "Post-op check", "Medication review"];
let ai = 0;
for (const k of docKeys) {
  for (let d = 0; d < 3; d++) {
    insert("appointments", { id: newId(), patient_id: patients[(ai + d) % patients.length], staff_id: staff[k], department_id: db.prepare("SELECT department_id FROM staff WHERE id=?").get(staff[k]) ? (db.prepare("SELECT department_id AS x FROM staff WHERE id=?").get(staff[k]) as any).x : null, starts_at: iso(60 * (2 + ai * 3 + d * 6)), duration_min: 20, status: pick(["booked", "booked", "arrived", "done"], ai + d), reason: pick(apptReasons, ai + d) });
  }
  ai++;
}

// ---- invoices ----
let invN = 0;
function invoice(enc: Enc, items: Array<[string, number, number, string]>, payerType: string, payRatio: number) {
  const id = newId(); invN++;
  let total = 0;
  for (const [, qty, price] of items) total += qty * price;
  const paid = +(total * payRatio).toFixed(2);
  insert("invoices", { id, number: invoiceNo(invN), patient_id: enc.patient, encounter_id: enc.id, total: +total.toFixed(2), paid, payer_type: payerType, status: payRatio >= 1 ? "paid" : payRatio > 0 ? "partial" : "open" });
  for (const [desc, qty, price, source] of items) insert("invoice_items", { id: newId(), invoice_id: id, description: desc, qty, unit_price: price, amount: +(qty * price).toFixed(2), source });
  if (paid > 0) insert("payments", { id: newId(), invoice_id: id, amount: paid, method: pick(["card", "cash", "insurance"], invN) });
}
invoice(encounters[6], [["Coronary care — daily", 1, 1200, "ward"], ["Troponin panel", 1, 60, "lab"], ["ECG", 2, 40, "procedure"], ["Aspirin", 14, 3, "pharmacy"]], "insurance", 0.6);
invoice(encounters[10], [["Ward bed — 2 days", 2, 400, "ward"], ["Chest X-Ray", 1, 80, "radiology"], ["Amoxicillin", 15, 4, "pharmacy"], ["CBC", 1, 36, "lab"]], "self", 1);
invoice(encounters[7], [["Emergency consult", 1, 120, "consult"], ["Troponin", 1, 60, "lab"], ["Chest X-Ray", 1, 80, "radiology"]], "insurance", 0);
invoice(encounters[11], [["Cardiology consult", 1, 180, "consult"], ["ECG", 1, 40, "procedure"]], "corporate", 1);

// ---- notifications ----
insert("notifications", { id: newId(), scope: "icu", target_role: "nurse", severity: "critical", title: "Critical lactate · ICU-1", body: "Lactate 4.6 mmol/L — review immediately", link: "/icu", entity: "encounter", entity_id: encounters[0].id });
insert("notifications", { id: newId(), scope: "ed", target_role: "doctor", severity: "warn", title: "Red triage · Chest pain", body: "New red-zone patient awaiting review", link: "/emergency", entity: "encounter", entity_id: encounters[7].id });
insert("notifications", { id: newId(), scope: "global", target_role: "pharmacy", severity: "warn", title: "Low stock · Noradrenaline", body: "Below reorder level (40 < 15)", link: "/pharmacy" });
insert("notifications", { id: newId(), scope: "global", target_role: "doctor", severity: "info", title: "Referral accepted · Cardiology", body: "Dr. Hale accepted your ACS referral", link: "/referrals" });

console.log(`Seeded: ${DEPTS.length} departments, ${STAFF.length} staff, ${patients.length} patients, ${encounters.length} encounters.`);
console.log("Login: admin@lumora.health / Lumora2026!  (all staff use the same password)");
