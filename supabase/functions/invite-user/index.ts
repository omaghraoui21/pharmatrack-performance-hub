import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is manager or super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is manager_or_above
    const { data: isManager } = await anonClient.rpc("is_manager_or_above", {
      _user_id: caller.id,
    });
    if (!isManager) {
      return new Response(
        JSON.stringify({ error: "Accès refusé. Rôle manager requis." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, full_name, role, app_roles, unit_id } = await req.json();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "Email et nom complet requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to create user
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password: crypto.randomUUID().slice(0, 16) + "Aa1!",
        email_confirm: true,
        user_metadata: {
          full_name,
          role: role || "supervisor",
        },
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Update profile with unit_id if provided
    if (unit_id) {
      await adminClient
        .from("profiles")
        .update({ unit_id })
        .eq("id", userId);
    }

    // Insert app_roles if provided
    if (app_roles && Array.isArray(app_roles) && app_roles.length > 0) {
      const roleInserts = app_roles.map((r: string) => ({
        user_id: userId,
        role: r,
      }));
      const { error: rolesError } = await adminClient
        .from("user_roles")
        .insert(roleInserts);
      if (rolesError) {
        console.error("Error inserting roles:", rolesError);
      }
    }

    // Fetch the created profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    return new Response(
      JSON.stringify({ user_id: userId, profile }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur interne" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
