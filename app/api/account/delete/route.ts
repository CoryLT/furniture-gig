// ============================================================
// POST /api/account/delete
// ============================================================
// Deletes the signed-in user's account and personal data.
//
// The Privacy Policy + TOS promise account deletion on request.
// This route fulfills that in-app so the user doesn't have to
// email us.
//
// Safety rails:
//   1. Must be signed in (401 otherwise).
//   2. Must POST { confirmEmail } that matches the account email
//      exactly, case-insensitive (400 otherwise). This is the
//      "type your email to confirm" gate — same pattern GitHub,
//      Stripe, etc. use.
//
// What we delete:
//   - Files in Supabase Storage owned by this user (avatar,
//     gallery photos, gig images, marketplace photos, receipts).
//   - Rows in every public.* table that holds this user's data,
//     in an order that respects foreign keys.
//   - The auth.users row itself (via the admin API).
//
// What we may retain (per Privacy Policy §6):
//   - Anonymized / aggregated business records for tax + legal
//     compliance. In this MVP we do a full delete; if that ever
//     needs to change we'll add a de-identification step here.
//
// Never expose this route to unauthenticated callers, and always
// use the service-role admin client for the actual deletes so
// we bypass RLS cleanly.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Tables where the user owns the row via a "user_id"-shaped
// column. Order matters: child tables first, parents last. We
// delete every table on this list even if the column doesn't
// exist for a given deploy — an "unknown column" error just
// gets logged and skipped so the whole delete doesn't fail.
type Sweep = { table: string; column: string };

const USER_OWNED_TABLES: Sweep[] = [
  // --- ledger children (must go before transactions / accounts) ---
  { table: "entry_lines", column: "user_id" },
  { table: "transactions", column: "user_id" },
  { table: "accounts", column: "user_id" },
  { table: "books_bank_feed", column: "user_id" },
  { table: "books_inventory_items", column: "user_id" },

  // --- pieces + everything hanging off them ---
  { table: "piece_supplies", column: "user_id" },
  { table: "inventory_pieces", column: "user_id" },

  // --- crew + contacts ---
  { table: "crew_members", column: "operator_user_id" },
  { table: "contacts", column: "user_id" },

  // --- messaging / conversations ---
  { table: "user_messages", column: "sender_id" },
  { table: "user_messages", column: "recipient_id" },
  { table: "user_conversations", column: "user_id" },
  { table: "conversation_user_state", column: "user_id" },
  { table: "listing_messages", column: "sender_id" },
  { table: "listing_conversations", column: "buyer_id" },
  { table: "listing_conversations", column: "seller_id" },
  { table: "gig_messages", column: "sender_id" },
  { table: "gig_conversations", column: "worker_id" },
  { table: "gig_conversations", column: "flipper_id" },
  { table: "support_messages", column: "sender_id" },
  { table: "support_conversations", column: "user_id" },

  // --- reports / blocks / moderation ---
  { table: "image_reports", column: "reporter_id" },
  { table: "listing_reports", column: "reporter_id" },
  { table: "message_reports", column: "reporter_id" },
  { table: "user_blocks", column: "blocker_id" },
  { table: "user_blocks", column: "blocked_id" },

  // --- marketplace (mothballed but rows may exist) ---
  { table: "marketplace_photos", column: "user_id" },
  { table: "marketplace_listings", column: "seller_id" },

  // --- gigs (mothballed but rows may exist) ---
  { table: "gig_payments", column: "worker_id" },
  { table: "gig_payments", column: "flipper_id" },
  { table: "gig_photo_uploads", column: "user_id" },
  { table: "gig_task_completions", column: "worker_id" },
  { table: "gig_claims", column: "worker_id" },
  { table: "gig_checklist_items", column: "user_id" },
  { table: "gig_images", column: "user_id" },
  { table: "gigs", column: "flipper_id" },
  { table: "payout_records", column: "worker_id" },
  { table: "payout_records", column: "flipper_id" },
  { table: "worker_services", column: "worker_id" },
  { table: "worker_payout_handles", column: "user_id" },

  // --- follows / social ---
  { table: "follows", column: "follower_id" },
  { table: "follows", column: "followed_id" },

  // --- notifications + prefs ---
  { table: "notifications", column: "user_id" },
  { table: "notification_preferences", column: "user_id" },
  { table: "push_subscriptions", column: "user_id" },
  { table: "email_log", column: "user_id" },

  // --- billing ---
  { table: "subscriptions", column: "user_id" },

  // --- business + legal ---
  { table: "business_profiles", column: "user_id" },
  { table: "user_agreement_acceptances", column: "user_id" },

  // --- photo galleries ---
  { table: "worker_photo_galleries", column: "worker_user_id" },
  { table: "flipper_photo_galleries", column: "flipper_user_id" },

  // --- profiles (last, since other tables may FK to them) ---
  { table: "worker_profiles", column: "user_id" },
  { table: "flipper_profiles", column: "user_id" },
  { table: "admin_profiles", column: "user_id" },
  { table: "users", column: "id" },
];

// Storage buckets to sweep. For each bucket we list all files
// under the user's folder prefix and delete them in one call.
const STORAGE_PREFIXES: { bucket: string; prefix: (uid: string) => string }[] = [
  { bucket: "avatars", prefix: (uid) => uid },
  { bucket: "photo-galleries", prefix: (uid) => uid },
  { bucket: "marketplace-photos", prefix: (uid) => uid },
  { bucket: "gig-photos", prefix: (uid) => uid },
  { bucket: "gig-images", prefix: (uid) => uid },
  { bucket: "receipts", prefix: (uid) => uid },
];

export async function POST(req: NextRequest) {
  try {
    // 1. Must be signed in.
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Must confirm by typing the account email.
    let confirmEmail = "";
    try {
      const body = await req.json();
      confirmEmail = (body?.confirmEmail ?? "").toString().trim();
    } catch {
      // fall through — empty confirmEmail will 400 below
    }

    if (!confirmEmail) {
      return NextResponse.json(
        { error: "Please type your email to confirm." },
        { status: 400 }
      );
    }

    if (confirmEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
      return NextResponse.json(
        {
          error:
            "That email doesn't match the account. Type the email you signed in with.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const uid = user.id;
    const warnings: string[] = [];

    // 3. Sweep storage. If a bucket doesn't exist or is empty
    // we just move on.
    for (const { bucket, prefix } of STORAGE_PREFIXES) {
      try {
        const { data: files, error: listErr } = await admin.storage
          .from(bucket)
          .list(prefix(uid), { limit: 1000 });

        if (listErr) {
          warnings.push(`storage list ${bucket}: ${listErr.message}`);
          continue;
        }
        if (!files || files.length === 0) continue;

        const paths = files.map((f) => `${prefix(uid)}/${f.name}`);
        const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
        if (rmErr) warnings.push(`storage remove ${bucket}: ${rmErr.message}`);
      } catch (e: any) {
        warnings.push(`storage ${bucket}: ${e?.message ?? "unknown"}`);
      }
    }

    // 4. Sweep DB tables. Missing tables / columns just log and skip.
    for (const { table, column } of USER_OWNED_TABLES) {
      const { error } = await admin.from(table).delete().eq(column, uid);
      if (error) {
        // 42P01 = table doesn't exist, 42703 = column doesn't exist.
        // Both are fine — this deploy just doesn't have that table.
        const code = (error as any).code;
        if (code !== "42P01" && code !== "42703") {
          warnings.push(`${table}.${column}: ${error.message}`);
        }
      }
    }

    // 5. NULL out crew_members rows where this user was the worker
    // side (someone else's crew list). We keep the row so the other
    // operator's records still show "paid Alice $200" — we just cut
    // the account link.
    {
      const { error } = await admin
        .from("crew_members")
        .update({ worker_user_id: null })
        .eq("worker_user_id", uid);
      if (error) warnings.push(`crew_members unlink: ${error.message}`);
    }

    // 6. Delete the auth user last.
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      // If we got here we've already wiped the public rows, so log
      // hard and tell the caller — Cory will need to finish this
      // one by hand in the Supabase dashboard.
      console.error("Failed to delete auth user", uid, authErr);
      return NextResponse.json(
        {
          error:
            "We deleted your data, but couldn't finish removing the sign-in itself. Please email CoryThacker@proton.me and we'll finish it manually.",
          warnings,
        },
        { status: 500 }
      );
    }

    if (warnings.length) {
      console.warn("Account delete completed with warnings", uid, warnings);
    }

    // 7. Best-effort sign-out on the server session cookie.
    try {
      await supabase.auth.signOut();
    } catch {
      // Cookie will get cleared client-side too.
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account delete error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
