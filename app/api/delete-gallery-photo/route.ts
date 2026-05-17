import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Check if user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get photo ID and type from request body
    const { photoId, type } = await request.json();

    if (!photoId || !type) {
      return NextResponse.json(
        { error: "Photo ID and type are required" },
        { status: 400 }
      );
    }

    if (!["worker", "flipper"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type" },
        { status: 400 }
      );
    }

    // Fetch the photo to verify ownership and get file path
    const tableName =
      type === "worker"
        ? "worker_photo_galleries"
        : "flipper_photo_galleries";
    const ownerField =
      type === "worker" ? "worker_user_id" : "flipper_user_id";

    const { data: photo, error: fetchError } = await supabase
      .from(tableName)
      .select("id, file_path, " + ownerField)
      .eq("id", photoId)
      .single();

    if (fetchError || !photo) {
      return NextResponse.json(
        { error: "Photo not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (photo[ownerField] !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own photos" },
        { status: 403 }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("photo-galleries")
      .remove([photo.file_path]);

    if (storageError) {
      console.error("Storage deletion error:", storageError);
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 }
      );
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from(tableName)
      .delete()
      .eq("id", photoId);

    if (dbError) {
      console.error("Database deletion error:", dbError);
      return NextResponse.json(
        { error: "Failed to delete photo record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
