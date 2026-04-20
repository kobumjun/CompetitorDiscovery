import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("proposals")
    .select("*, client:clients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const serviceClient = await createServiceClient();

  // Public rejection from shared proposal page
  if (body.status === "rejected" && Object.keys(body).length === 1) {
    const { data: proposal } = await serviceClient
      .from("proposals")
      .select("id, title, user_id, status")
      .eq("id", id)
      .single();

    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await serviceClient
      .from("proposals")
      .update({ status: "rejected" })
      .eq("id", id);

    await serviceClient.from("proposal_activities").insert({
      proposal_id: id,
      type: "rejected",
    });

    return NextResponse.json({ status: "rejected" });
  }

  // Authenticated owner update
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await serviceClient
    .from("proposals")
    .update(body)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = await createServiceClient();
  await serviceClient.from("proposals").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ deleted: true });
}
