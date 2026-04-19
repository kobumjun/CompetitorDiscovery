import OpenAI from "openai";
import type { BusinessProfile, ProposalContent, ProposalTone, OutreachType } from "@/types";

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

interface GenerateInput {
  profile: BusinessProfile | null;
  clientName: string;
  contactName: string | null;
  projectName: string;
  projectDescription: string;
  budget: number | null;
  timeline: string | null;
  sections: string[];
  tone: ProposalTone;
  additionalInstructions: string | null;
  currency: string;
  language: string;
}

export async function generateProposal(input: GenerateInput): Promise<ProposalContent> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are an expert proposal writer who helps freelancers, agencies, and consultants win clients. Generate a professional, compelling proposal.

Freelancer/Agency Info:
- Business: ${input.profile?.business_name || "Independent Professional"}
- Owner: ${input.profile?.owner_name || "N/A"}
- Industry: ${input.profile?.industry || "N/A"}
- Services: ${input.profile?.services?.join(", ") || "N/A"}
- Hourly Rate: ${input.profile?.hourly_rate ? `${input.currency} ${input.profile.hourly_rate}/hr` : "N/A"}
- Standard Terms: ${input.profile?.standard_terms || "Standard terms apply"}
- Payment Terms: ${input.profile?.payment_terms || "50% upfront, 50% on delivery"}

Client Info:
- Company: ${input.clientName || "N/A"}
- Contact: ${input.contactName || "the client"}

Project:
- Name: ${input.projectName}
- Description: ${input.projectDescription}
- Budget: ${input.budget ? `${input.currency} ${input.budget}` : "To be determined based on scope"}
- Timeline: ${input.timeline || "To be discussed"}

Tone: ${input.tone}
Language: ${input.language === "ko" ? "Korean (한국어)" : input.language === "es" ? "Spanish" : input.language === "ja" ? "Japanese" : "English"}
Currency: ${input.currency}

${input.additionalInstructions ? `Additional instructions: ${input.additionalInstructions}` : ""}

Sections to include: ${input.sections.join(", ")}

Return a JSON object:
{
  "coverLetter": "2-3 paragraphs personalized cover letter addressing the client by name",
  "scope": [
    { "title": "Phase 1: ...", "description": "1-2 sentences" }
  ],
  "deliverables": ["Specific deliverable 1", "Deliverable 2"],
  "timeline": [
    { "phase": "Week 1-2", "description": "What happens" }
  ],
  "pricing": [
    { "item": "Line item name", "description": "What it includes", "amount": 1500 }
  ],
  "totalAmount": 5000,
  "terms": "Payment terms, revisions, ownership, cancellation. 2-3 paragraphs.",
  "nextSteps": "Clear call-to-action. 1-2 paragraphs."
}

Rules:
- Make the proposal SPECIFIC to this project using details from the description.
- Use realistic pricing that fits the stated budget. If no budget, estimate fairly.
- Write in the requested tone and language.
- Keep scope items to 3-5 phases max.
- Keep deliverables to 4-8 items.
- Pricing line items should add up to totalAmount.
- Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: systemPrompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  return JSON.parse(content) as ProposalContent;
}

interface WebsiteAnalysis {
  companyName: string;
  industry: string;
  description: string;
  keyPeople: string[];
}

interface GenerateOutreachInput {
  type: OutreachType;
  senderName: string;
  businessName: string;
  industry: string;
  services: string;
  tone: string;
  leadCompanyName: string;
  leadIndustry: string;
  leadInfo: string;
  context: string;
}

export async function analyzeWebsiteContent(rawContent: string): Promise<WebsiteAnalysis> {
  const openai = getOpenAIClient();
  const content = rawContent.slice(0, 3000);

  const prompt = `Analyze this website content and return a JSON object.

Content:
"${content}"

Return:
{
  "companyName": "Company or organization name",
  "industry": "Industry/sector",
  "description": "2-3 sentence summary of what they do",
  "keyPeople": ["Names of founders/leaders if mentioned"]
}

Rules:
- If unknown, use empty string or [].
- Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  return JSON.parse(raw) as WebsiteAnalysis;
}

export async function generateOutreachEmail(input: GenerateOutreachInput): Promise<{ subject: string; body: string }> {
  const openai = getOpenAIClient();

  const typePrompts: Record<OutreachType, string> = {
    proposal: "formal project proposal offering services",
    pitch: "compelling sales pitch introducing products/services",
    investment: "investment proposal pitching for funding or partnership",
    quote: "quote/estimate for specific services with pricing breakdown",
  };

  const prompt = `Generate a professional ${typePrompts[input.type]} email.

Sender:
- Name: ${input.senderName}
- Business: ${input.businessName}
- Industry: ${input.industry}
- Services: ${input.services}

Recipient Company:
- Name: ${input.leadCompanyName}
- Industry: ${input.leadIndustry}
- About: ${input.leadInfo}

Additional Context from Sender: ${input.context || "None"}

Return JSON:
{
  "subject": "Compelling subject line under 60 chars",
  "body": "Full email body. Start with 'Hi'. Make it specific to recipient company. Include CTA and sender signature."
}

Style: ${input.tone}
Keep body 150-250 words.
Return only valid JSON.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  return JSON.parse(raw) as { subject: string; body: string };
}
