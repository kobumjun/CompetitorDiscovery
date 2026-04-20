export function generateProposalEmailMailto(params: {
  recipientEmail: string;
  recipientName: string;
  proposalTitle: string;
  businessName: string;
  totalAmount: string;
  shareUrl: string;
  expiresAt: string | null;
}) {
  const subject = `New Proposal: ${params.proposalTitle}`;
  const bodyLines = [
    `Hi ${params.recipientName || "there"},`,
    "",
    `${params.businessName} sent you a proposal.`,
    `Proposal: ${params.proposalTitle}`,
    `Total: ${params.totalAmount}`,
    "",
    `View Proposal: ${params.shareUrl}`,
    params.expiresAt ? `Expires on: ${params.expiresAt}` : "",
  ].filter(Boolean);
  return `mailto:${encodeURIComponent(params.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
}
