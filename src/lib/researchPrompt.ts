export interface ResearchInput {
  threadId: string;
  companyName: string;
  companyDomain: string | null;
  position: string;
  location: string;
}

export function buildResearchPrompt(input: ResearchInput): string {
  const domainNote = input.companyDomain ? ` (${input.companyDomain})` : "";

  return `Research "${input.companyName}"${domainNote} for a "${input.position}" position in ${input.location}.

Use WebSearch and WebFetch to find real, current, verifiable information. Do not fabricate anything — if you can't confidently find something, leave it out rather than guessing.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"facts": [{"section": "<section>", "content": "<content>", "sourceDetail": "<source>"}]}

Valid "section" values: companySnapshot, fundingNews, companyAtLocation, cultureValues, roleSpecifics, techStack, compensation, redFlags, sources.

For "content", follow these conventions exactly where applicable:
- companySnapshot: one plain sentence describing what the company does, then separate facts "Founded: YYYY", "Employees: ~N", "HQ: City, ST"
- companyAtLocation: "Office opened: YYYY", "Local team: ~N engineers", "Reports to: ..." — omit any of these you can't confidently find, don't guess
- roleSpecifics: "Team size: ...", "Schedule: ...", "Focus: ..."
- cultureValues: "Glassdoor: X.X/5, N reviews", up to 2 category sub-ratings like "Work-Life Balance: X.X", plus "Pro: ..." and "Con: ..." facts
- fundingNews: "YYYY: event description", most recent first
- techStack: one short technology name per fact (e.g. "Go", "Kubernetes")
- compensation: "Role (related role): ~range" when exact-role data is sparse
- redFlags: one plain sentence per concern
- sources: "domain — short description of what you found there", one per source actually used

Every fact must come from something you actually found via search. An empty facts array for a section is correct if nothing confident turned up for it.`;
}
