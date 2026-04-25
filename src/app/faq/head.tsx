const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is ProposalPilot?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ProposalPilot is a web tool that extracts contact emails from any website URL and generates personalized outreach emails using AI. You paste a URL, it finds the contact emails, and GPT-4o writes a tailored proposal, sales pitch, investment ask, or quote. Your email client opens ready to send — the whole process takes under 60 seconds.",
      },
    },
    {
      "@type": "Question",
      name: "How does email extraction work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you paste a website URL, ProposalPilot crawls the page and linked pages (like /contact, /about, /team) to find publicly listed email addresses. No scraping of private data — only emails that are already visible on the site.",
      },
    },
    {
      "@type": "Question",
      name: "What is Bulk Discovery?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bulk Discovery lets you paste up to 20 website URLs at once. ProposalPilot crawls all of them in parallel, extracts every contact email it finds, deduplicates them, and saves them to your client list. You can then generate a personalized proposal for each lead from one page. It costs 1 credit per email found.",
      },
    },
    {
      "@type": "Question",
      name: "How much does ProposalPilot cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Free tier includes 10 credits. Pro plan is $19/month with 150 credits. Agency plan is $49/month with 500 credits. Each AI-generated proposal costs 1 credit. Manual writing is always free.",
      },
    },
    {
      "@type": "Question",
      name: "Does ProposalPilot send emails for me?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. ProposalPilot opens your default email client (Gmail, Outlook, Apple Mail, etc.) with the email pre-filled. You send it yourself from your own email address — no deliverability issues, no spam folder risk.",
      },
    },
    {
      "@type": "Question",
      name: "How is ProposalPilot different from Apollo, Hunter, or Clay?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Those tools are built around pre-existing lead databases or enrichment workflows designed for sales teams. ProposalPilot is different — you start with a website you already found, extract the contact email from that site in real-time, and generate a personalized pitch in the same flow. It's built for people who do their own outreach manually and want to move faster, not for teams managing large sales pipelines.",
      },
    },
    {
      "@type": "Question",
      name: "Is ProposalPilot safe to use? Is it legal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ProposalPilot only extracts publicly visible email addresses from websites. It does not access private databases, bypass login walls, or scrape social media profiles. We recommend using it for businesses you have a genuine reason to contact.",
      },
    },
    {
      "@type": "Question",
      name: "What outreach types can I generate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Four types — Project Proposal, Sales Pitch, Investment Ask, and Quote Request. Each is personalized based on what the target company actually does, pulled from their website content.",
      },
    },
  ],
};

export default function Head() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}
