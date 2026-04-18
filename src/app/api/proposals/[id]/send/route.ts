import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendProposalToClient } from "@/lib/email";
import { formatCurrency } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { recipientEmail } = body;

  if (!recipientEmail) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: proposal } = await serviceClient
    .from("proposals")
    .select("*, client:clients(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const { data: profile } = await serviceClient
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const shareUrl = `${appUrl}/proposal/view/${proposal.share_token}`;

  try {
    await sendProposalToClient({
      recipientEmail,
      recipientName: proposal.client?.contact_name || "",
      proposalTitle: proposal.title,
      businessName: profile?.business_name || user.email || "A business",
      totalAmount: proposal.total_amount
        ? formatCurrency(proposal.total_amount, proposal.currency)
        : "See proposal",
      shareUrl,
      expiresAt: proposal.expires_at
        ? new Date(proposal.expires_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null,
    });

    // Update status to "sent"
    await serviceClient
      .from("proposals")
      .update({ status: "sent" })
      .eq("id", id);

    await serviceClient.from("proposal_activities").insert({
      proposal_id: id,
      type: "sent",
      metadata: { recipient: recipientEmail },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to send proposal email:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
