// Edge function: seed-demo
// Creates 3 demo users, wipes data, and seeds fake patients/appointments/schedules.
// Idempotent — safe to re-run to reset the demo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_USERS = [
  {
    email: "secretaria@demo.com",
    password: "demo1234",
    full_name: "SECRETARIA DEMO",
    role: "secretary" as const,
    specialty: null,
    license_numbers: null,
  },
  {
    email: "doctor@demo.com",
    password: "demo1234",
    full_name: "DR. JUAN PÉREZ",
    role: "doctor" as const,
    specialty: "ECOGRAFÍA Y DOPPLER",
    license_numbers: "MP 12345 / MN 98765",
  },
  {
    email: "visor@demo.com",
    password: "demo1234",
    full_name: "DRA. MARÍA LÓPEZ",
    role: "viewer" as const,
    specialty: "MEDICINA GENERAL",
    license_numbers: "MP 54321",
  },
];

const FAKE_PATIENTS = [
  { dni: "30111222", name: "ANA GARCÍA", phone: "3493111111", obra_social: "OSDE", fn: "1980-05-12" },
  { dni: "28333444", name: "CARLOS RODRÍGUEZ", phone: "3493222222", obra_social: "SWISS MEDICAL", fn: "1975-09-23" },
  { dni: "35555666", name: "LUCÍA MARTÍNEZ", phone: "3493333333", obra_social: "IAPOS", fn: "1992-02-08" },
  { dni: "40777888", name: "MATÍAS FERNÁNDEZ", phone: "3493444444", obra_social: "PARTICULAR", fn: "1998-11-30" },
  { dni: "25999000", name: "SOFÍA GÓMEZ", phone: "3493555555", obra_social: "GALENO", fn: "1970-07-14" },
  { dni: "45112233", name: "TOMÁS LÓPEZ", phone: "3493666666", obra_social: "OSDE", fn: "2002-03-19" },
  { dni: "32445566", name: "VALERIA SUÁREZ", phone: "3493777777", obra_social: "IAPOS", fn: "1985-12-01" },
  { dni: "38778899", name: "DIEGO ROMERO", phone: "3493888888", obra_social: "SWISS MEDICAL", fn: "1989-06-25" },
  { dni: "29001122", name: "MARTINA SILVA", phone: "3493999999", obra_social: "PARTICULAR", fn: "1978-08-17" },
  { dni: "41223344", name: "FRANCO BENÍTEZ", phone: "3493000000", obra_social: "GALENO", fn: "1999-10-05" },
];

const STUDY_TYPES = [
  "ECOGRAFÍA ABDOMINAL",
  "ECOGRAFÍA TIROIDEA",
  "ECOGRAFÍA OBSTÉTRICA",
  "ECOGRAFÍA MAMARIA",
  "ECOGRAFÍA DOPPLER VENOSO MMII",
  "ECOGRAFÍA RENAL Y VESICOPROSTÁTICA",
  "ECOGRAFÍA GINECOLÓGICA",
  "TN Y DOPPLER UTERINO",
];

const SAMPLE_REPORT = `<p><strong>HALLAZGOS:</strong></p><p>Hígado de tamaño, forma y ecoestructura conservada. Vesícula biliar de paredes finas, sin litiasis. Vía biliar no dilatada. Páncreas de difícil visualización por interposición gaseosa. Bazo de tamaño normal. Riñones de morfología y ecoestructura conservadas, sin litiasis ni dilatación pielocalicial.</p><p><strong>CONCLUSIÓN:</strong></p><p>Ecografía abdominal sin particularidades.</p>`;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function ensureUser(u: typeof DEMO_USERS[number]): Promise<string> {
  // Try to find existing user
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((x) => x.email === u.email);
  let userId: string;
  if (existing) {
    userId = existing.id;
    // Reset password just in case
    await admin.auth.admin.updateUserById(userId, { password: u.password, email_confirm: true });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  // Upsert profile
  await admin.from("profiles").upsert({
    user_id: userId,
    full_name: u.full_name,
    email: u.email,
    specialty: u.specialty,
    license_numbers: u.license_numbers,
    slot_interval: 10,
  }, { onConflict: "user_id" });

  // Upsert role
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: u.role });

  return userId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1) Wipe transactional data
    await admin.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("clinic_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("blocked_dates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("doctor_schedules").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2) Create / refresh users
    const ids: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      ids[u.role] = await ensureUser(u);
    }
    const doctorId = ids["doctor"];
    const secretaryId = ids["secretary"];

    // 3) Doctor schedules: Mon-Fri 08:00-12:00 and 16:00-20:00
    const schedules: any[] = [];
    for (let dow = 1; dow <= 5; dow++) {
      schedules.push({ doctor_id: doctorId, day_of_week: dow, start_time: "08:00", end_time: "12:00", active: true });
      schedules.push({ doctor_id: doctorId, day_of_week: dow, start_time: "16:00", end_time: "20:00", active: true });
    }
    await admin.from("doctor_schedules").insert(schedules);

    // 4) Patients
    const today = new Date();
    const patientRows = FAKE_PATIENTS.map((p) => {
      const [y, m, d] = p.fn.split("-").map(Number);
      const birth = new Date(y, m - 1, d);
      const age = today.getFullYear() - birth.getFullYear();
      return {
        dni: p.dni,
        name: p.name,
        phone: p.phone,
        age,
        fecha_nacimiento: p.fn,
        obra_social: p.obra_social,
        created_by: secretaryId,
      };
    });
    const { data: insertedPatients } = await admin.from("patients").insert(patientRows).select();
    const patients = insertedPatients ?? [];

    // 5) Appointments: spread across past week (reported) and next 2 weeks (pending)
    const appts: any[] = [];
    const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "16:00", "16:30", "17:00", "17:30", "18:00"];
    for (let i = 0; i < patients.length; i++) {
      const p = patients[i];
      // Past appointment (reported)
      const past = new Date(today);
      past.setDate(today.getDate() - (i + 1));
      // skip Sunday(0) and Saturday(6)
      while (past.getDay() === 0 || past.getDay() === 6) past.setDate(past.getDate() - 1);
      appts.push({
        patient_id: p.id,
        study_type: STUDY_TYPES[i % STUDY_TYPES.length],
        status: "reported",
        date: isoDate(past),
        time: times[i % times.length],
        report: SAMPLE_REPORT,
        asistio: true,
        created_by: secretaryId,
        reported_by: doctorId,
      });
      // Future appointment (pending)
      const future = new Date(today);
      future.setDate(today.getDate() + (i + 2));
      while (future.getDay() === 0 || future.getDay() === 6) future.setDate(future.getDate() + 1);
      appts.push({
        patient_id: p.id,
        study_type: STUDY_TYPES[(i + 3) % STUDY_TYPES.length],
        status: "pending",
        date: isoDate(future),
        time: times[(i + 2) % times.length],
        report: "",
        asistio: false,
        created_by: secretaryId,
      });
    }
    await admin.from("appointments").insert(appts);

    return new Response(
      JSON.stringify({ ok: true, users: DEMO_USERS.map((u) => ({ email: u.email, role: u.role })), patients: patients.length, appointments: appts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
