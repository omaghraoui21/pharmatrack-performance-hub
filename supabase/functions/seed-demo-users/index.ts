import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = [
  {
    email: "superadmin@demo.com",
    full_name: "Sophie Martin (Super Admin)",
    password: "Demo1234!",
    role: "manager",
    app_roles: ["super_admin"],
    unit_name: null,
  },
  {
    email: "adminsite@demo.com",
    full_name: "Pierre Dupont (Admin Site)",
    password: "Demo1234!",
    role: "manager",
    app_roles: ["admin_site"],
    unit_name: null,
  },
  {
    email: "manager@demo.com",
    full_name: "Marc Leroy (Manager Unité)",
    password: "Demo1234!",
    role: "manager",
    app_roles: ["manager_unite"],
    unit_name: null, // will be set to first unit found
  },
  {
    email: "superviseur@demo.com",
    full_name: "Amina Khelifi (Superviseur)",
    password: "Demo1234!",
    role: "supervisor",
    app_roles: ["superviseur"],
    unit_name: null,
  },
  {
    email: "readonly@demo.com",
    full_name: "Jean Moreau (Lecture Seule)",
    password: "Demo1234!",
    role: "supervisor",
    app_roles: ["readonly"],
    unit_name: null,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Fetch units to assign to manager/supervisor
    const { data: units } = await adminClient
      .from("units")
      .select("id, name")
      .order("name")
      .limit(2);

    const firstUnitId = units?.[0]?.id || null;
    const secondUnitId = units?.[1]?.id || firstUnitId;

    const results: any[] = [];

    for (const demo of DEMO_USERS) {
      // Check if user already exists
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", demo.email)
        .maybeSingle();

      if (existing) {
        results.push({ email: demo.email, status: "already_exists", id: existing.id });
        continue;
      }

      // Determine unit
      let unitId: string | null = null;
      if (demo.app_roles.includes("manager_unite")) {
        unitId = firstUnitId;
      } else if (demo.app_roles.includes("superviseur")) {
        unitId = secondUnitId || firstUnitId;
      }

      // Create auth user
      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: demo.email,
          password: demo.password,
          email_confirm: true,
          user_metadata: {
            full_name: demo.full_name,
            role: demo.role,
          },
        });

      if (createError) {
        results.push({ email: demo.email, status: "error", error: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      // Update profile with unit
      if (unitId) {
        await adminClient
          .from("profiles")
          .update({ unit_id: unitId })
          .eq("id", userId);
      }

      // Insert app roles
      if (demo.app_roles.length > 0) {
        await adminClient.from("user_roles").insert(
          demo.app_roles.map((r) => ({ user_id: userId, role: r }))
        );
      }

      results.push({ email: demo.email, status: "created", id: userId, password: demo.password });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
