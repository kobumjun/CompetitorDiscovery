import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendProposalSignedNotification } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, email, signatureData } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: proposal } = await serviceClient
    .from("proposals")
    .select("id, status, signed_at, title, user_id, share_token")
    .eq("id", id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.signed_at) {
    return NextResponse.json({ error: "Already signed" }, { status: 400 });
  }

  const signedAt = new Date().toISOString();

  await serviceClient
    .from("proposals")
    .update({
      signed_at: signedAt,
      signed_by_name: name,
      signed_by_email: email,
      signature_data: signatureData || null,
      status: "accepted",
    })
    .eq("id", id);

  await serviceClient.from("proposal_activities").insert({
    proposal_id: id,
    type: "signed",
    metadata: { name, email },
  });

  // Notify proposal owner via email
  try {
    const { data: owner } = await serviceClient
      .from("users")
      .select("email")
      .eq("id", proposal.user_id)
      .single();

    if (owner?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      await sendProposalSignedNotification({
        ownerEmail: owner.email,
        proposalTitle: proposal.title,
        signedByName: name,
        signedByEmail: email,
        signedAt: new Date(signedAt).toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        }),
        proposalUrl: `${appUrl}/dashboard/proposals/${proposal.id}`,
      });
    }
  } catch (err) {
    console.error("Failed to send signed notification email:", err);
  }

  return NextResponse.json({ success: true });
}
