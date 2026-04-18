import { Resend } from "resend";

const FROM = "ProposalPilot <onboarding@resend.dev>";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(apiKey);
}

export async function sendProposalToClient(params: {
  recipientEmail: string;
  recipientName: string;
  proposalTitle: string;
  businessName: string;
  totalAmount: string;
  shareUrl: string;
  expiresAt: string | null;
}) {
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to: params.recipientEmail,
    subject: `New Proposal: ${params.proposalTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="padding: 32px 0; border-bottom: 1px solid #e2e8f0;">
          <strong style="font-size: 18px;">🚀 ProposalPilot</strong>
        </div>
        <div style="padding: 32px 0;">
          <h2 style="margin: 0 0 8px; font-size: 20px;">${params.businessName} sent you a proposal</h2>
          <p style="color: #64748b; margin: 0 0 24px;">Hi ${params.recipientName || "there"},</p>
          <p style="margin: 0 0 8px;">You've received a new proposal:</p>
          <p style="margin: 0 0 4px;"><strong>${params.proposalTitle}</strong></p>
          <p style="margin: 0 0 24px; color: #64748b;">Total: ${params.totalAmount}</p>
          <a href="${params.shareUrl}"
             style="display: inline-block; background: #F97316; color: #fff; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Proposal
          </a>
          ${params.expiresAt ? `<p style="color: #94a3b8; margin-top: 24px; font-size: 13px;">This proposal expires on ${params.expiresAt}</p>` : ""}
        </div>
        <div style="padding: 24px 0; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          Sent via ProposalPilot
        </div>
      </div>
    `,
  });
}

export async function sendProposalSignedNotification(params: {
  ownerEmail: string;
  proposalTitle: string;
  signedByName: string;
  signedByEmail: string;
  signedAt: string;
  proposalUrl: string;
}) {
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to: params.ownerEmail,
    subject: `✓ Proposal Signed: ${params.proposalTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="padding: 32px 0; border-bottom: 1px solid #e2e8f0;">
          <strong style="font-size: 18px;">🚀 ProposalPilot</strong>
        </div>
        <div style="padding: 32px 0;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #166534; font-weight: 600;">✓ Your proposal has been accepted!</p>
          </div>
          <p style="margin: 0 0 8px;"><strong>${params.proposalTitle}</strong></p>
          <p style="margin: 0 0 4px; color: #64748b;">Signed by: ${params.signedByName} (${params.signedByEmail})</p>
          <p style="margin: 0 0 24px; color: #64748b;">Signed at: ${params.signedAt}</p>
          <a href="${params.proposalUrl}"
             style="display: inline-block; background: #F97316; color: #fff; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Proposal
          </a>
        </div>
        <div style="padding: 24px 0; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          Sent via ProposalPilot
        </div>
      </div>
    `,
  });
}

export async function sendProposalViewedNotification(params: {
  ownerEmail: string;
  proposalTitle: string;
  viewedAt: string;
  proposalUrl: string;
}) {
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to: params.ownerEmail,
    subject: `👀 Proposal Viewed: ${params.proposalTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="padding: 32px 0; border-bottom: 1px solid #e2e8f0;">
          <strong style="font-size: 18px;">🚀 ProposalPilot</strong>
        </div>
        <div style="padding: 32px 0;">
          <p style="margin: 0 0 8px;">Your proposal <strong>${params.proposalTitle}</strong> was just viewed.</p>
          <p style="margin: 0 0 24px; color: #64748b;">Viewed at: ${params.viewedAt}</p>
          <a href="${params.proposalUrl}"
             style="display: inline-block; background: #F97316; color: #fff; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Details
          </a>
        </div>
        <div style="padding: 24px 0; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          Sent via ProposalPilot
        </div>
      </div>
    `,
  });
}

export async function sendProposalRejectedNotification(params: {
  ownerEmail: string;
  proposalTitle: string;
  proposalUrl: string;
}) {
  const resend = getResend();

  await resend.emails.send({
    from: FROM,
    to: params.ownerEmail,
    subject: `Proposal Declined: ${params.proposalTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="padding: 32px 0; border-bottom: 1px solid #e2e8f0;">
          <strong style="font-size: 18px;">🚀 ProposalPilot</strong>
        </div>
        <div style="padding: 32px 0;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; color: #991b1b;">Your proposal has been declined.</p>
          </div>
          <p style="margin: 0 0 24px;"><strong>${params.proposalTitle}</strong></p>
          <a href="${params.proposalUrl}"
             style="display: inline-block; background: #64748b; color: #fff; padding: 14px 28px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Proposal
          </a>
        </div>
        <div style="padding: 24px 0; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          Sent via ProposalPilot
        </div>
      </div>
    `,
  });
}
