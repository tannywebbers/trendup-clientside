// Seed users from the SEED_USERS env var into Supabase Auth + profiles + user_roles.
// Usage: node --env-file=.env scripts/seed-users.mjs
// SEED_USERS format (JSON array):
// [{"email":"u@x.com","password":"pw","role":"user|admin","first_name":"A","last_name":"B","tiktok_username":"c","tik_points":100}]

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[seed] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FALLBACK_USERS = [
  {
    email: "testuser@gmail.com",
    password: "testuser12345",
    role: "user",
    first_name: "Test",
    last_name: "User",
    tiktok_username: "testuser",
    tik_points: 100,
  },
  {
    email: "admin@trendup.com",
    password: "Admin12345",
    role: "admin",
    first_name: "TrendUp",
    last_name: "Admin",
    tiktok_username: "trendup_admin",
  },
];

function parseSeedUsers() {
  const raw = process.env.SEED_USERS;
  if (!raw) {
    console.log("[seed] SEED_USERS not set, using default seed users.");
    return FALLBACK_USERS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn("[seed] SEED_USERS invalid, using defaults.");
      return FALLBACK_USERS;
    }
    return parsed;
  } catch (err) {
    console.warn(`[seed] Could not parse SEED_USERS (${err.message}), using defaults.`);
    return FALLBACK_USERS;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findUserId(email) {
  let cursor = 0;
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: i, perPage: 1000 });
    if (error) throw error;
    const match = (data?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if ((data?.users ?? []).length < 1000) break;
  }
  return null;
}

async function ensureProfile(userId, email, user, avatarUrl) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const fields = {
    user_id: userId,
    email,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    tiktok_username: user.tiktok_username || `user_${userId.replace(/-/g, "").slice(0, 10)}`,
    avatar_url: avatarUrl ?? "🐼",
  };

  if (existing) {
    const { error } = await supabase.from("profiles").update(fields).eq("user_id", userId);
    if (error) throw new Error(`profile update: ${error.message}`);
  } else {
    const { error } = await supabase.from("profiles").insert(fields);
    if (error) throw new Error(`profile insert: ${error.message}`);
  }
}

async function ensureRole(userId, roleName) {
  const { data: existing, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", roleName);
  if (error) throw new Error(`role lookup: ${error.message}`);

  if (!existing || existing.length === 0) {
    const { error: upsertError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: roleName }, { onConflict: "user_id,role" });
    if (upsertError) throw new Error(`role upsert: ${upsertError.message}`);
  }
}

async function creditPoints(userId, amount, email) {
  const { data: existingTxn } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "seed");
  if (existingTxn && existingTxn.length > 0) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tik_points")
    .eq("user_id", userId)
    .single();

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    amount,
    type: "seed",
    description: `Seed Streak Points for ${email}`,
  });
  if (txError) throw new Error(`transaction insert: ${txError.message}`);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ tik_points: (profile?.tik_points ?? 0) + amount })
    .eq("user_id", userId);
  if (updateError) throw new Error(`points update: ${updateError.message}`);
}

async function main() {
  const users = parseSeedUsers();
  let created = 0;
  let updated = 0;

  for (const user of users) {
    const email = user.email?.trim();
    if (!email || !user.password) {
      console.warn("[seed] Skipping user with missing email/password.");
      continue;
    }

    const existingId = await findUserId(email);
    let userId = existingId;

    if (!existingId) {
      console.log(`[seed] Creating user: ${email}`);
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          first_name: user.first_name ?? "",
          last_name: user.last_name ?? "",
          tiktok_username: user.tiktok_username ?? "",
          tiktok_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        },
      });
      if (error) {
        console.error(`[seed] FAILED to create ${email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      created++;

      // Give the auth trigger a moment to create profile + role row
      await sleep(1500);
    } else {
      console.log(`[seed] User exists: ${email} (updating profile/role)`);
      updated++;
    }

    try {
      const roleName = user.role === "admin" ? "admin" : "user";
      await ensureProfile(userId, email, user, roleName === "admin" ? "👑" : "🐼");
      await ensureRole(userId, roleName);

      if (roleName === "admin") {
        // Admin still keeps 'user' role removed-free; just ensure admin role (done above).
      }

      if (user.tik_points && user.tik_points > 0) {
        await creditPoints(userId, user.tik_points, email);
      }

      console.log(`[seed] OK ${email} (${roleName})`);
    } catch (err) {
      console.error(`[seed] FAILED to finalize ${email}: ${err.message}`);
    }
  }

  console.log(`[seed] Done. Created: ${created}, Already existed: ${updated}.`);
}

main().catch((err) => {
  console.error("[seed] Unexpected error:", err);
  process.exit(1);
});