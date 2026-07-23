import type { ParsedFact } from "./researchParsing";

export interface ResearchInput {
  threadId: string;
  companyName: string;
  companyDomain: string | null;
  position: string;
  location: string;
}

function companyLine(input: ResearchInput): string {
  const domainNote = input.companyDomain ? ` (${input.companyDomain})` : "";
  return `"${input.companyName}"${domainNote} for a "${input.position}" position in ${input.location}`;
}

const SOURCING_NOTE = `Pick sources appropriate to this company's likely region based on its name and location — do not assume a fixed site list works everywhere (e.g. AmbitionBox, Naukri, and Cutshort tend to have far better coverage for India-based companies than Glassdoor or Levels.fyi alone). If your first source comes up dry, try a second one rather than settling for nothing.`;

const ECONOMY_NOTE = `Be economical: make at most 6 total WebSearch/WebFetch calls for this task, then synthesize your final answer from what you found. A focused set of well-sourced facts beats exhaustively searching for completeness — stop once you have a reasonable picture rather than continuing to search for marginal additions.`;

function withFocusNote(fixedNote: string | undefined, focusNote: string | undefined): string | undefined {
  const focusText = focusNote ? `Additional focus for this specific research pass: ${focusNote}` : undefined;
  if (fixedNote && focusText) return `${fixedNote}\n${focusText}`;
  return fixedNote ?? focusText;
}

function outputInstructions(sections: string): string {
  return `Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"facts": [{"section": "<section>", "content": "<content>", "sourceDetail": "<short source description>", "sourceUrl": "<the exact URL you found this at>"}]}

Valid "section" values for this task: ${sections}, sources.

Every fact must come from something you actually found via search — never fabricate. If you cannot confidently find something, leave it out rather than guessing. An empty facts array is correct if nothing confident turned up.`;
}

function buildClusterPrompt(
  input: ResearchInput,
  opts: {
    sections: string;
    sourcingGuidance: string;
    contentConventions: string;
    extraInstructions?: string;
  }
): string {
  const extra = opts.extraInstructions ? `\n${opts.extraInstructions}\n` : "";
  return `Research ${companyLine(input)}.

Use WebSearch and WebFetch to find real, current, verifiable information.

${opts.sourcingGuidance}

${SOURCING_NOTE}
${ECONOMY_NOTE}
${extra}
${outputInstructions(opts.sections)}

For "content", follow these conventions exactly where applicable:
${opts.contentConventions}
- sources: "domain — short description of what you found there", one per source actually used for this specific task`;
}

export function buildCompanyFundamentalsPrompt(input: ResearchInput, focusNote?: string): string {
  return buildClusterPrompt(input, {
    sections: "companySnapshot, fundingNews",
    sourcingGuidance:
      "Check the official company site, Crunchbase, Wikipedia, and region-appropriate business press (e.g. TechCrunch or Business Insider for US companies, YourStory/Inc42/Moneycontrol for India-based companies).",
    contentConventions: `- companySnapshot: one plain sentence describing what the company does, then separate facts "Founded: YYYY", "Employees: ~N", "HQ: City, ST"
- fundingNews: "YYYY: event description", most recent first — include recent leadership changes (CEO/CTO/founder departures or hires) as their own fundingNews-style facts, since these are material context for a candidate`,
    extraInstructions: withFocusNote(undefined, focusNote),
  });
}

export function buildEmployeeExperiencePrompt(input: ResearchInput, focusNote?: string): string {
  const layoffNote =
    "Explicitly check for recent layoffs at this company (the WARN tracker for US companies, general business-news search otherwise) and log any confirmed layoff as a redFlags fact.";
  return buildClusterPrompt(input, {
    sections: "cultureValues, redFlags",
    sourcingGuidance:
      "Check Glassdoor, AmbitionBox (India), Blind, Comparably, Fishbowl, and relevant subreddits (e.g. r/cscareerquestions, r/developersIndia).",
    contentConventions: `- cultureValues: "Glassdoor: X.X/5, N reviews", up to 2 category sub-ratings like "Work-Life Balance: X.X", plus "Pro: ..." and "Con: ..." facts — omit any of these you can't confidently find, don't guess
- redFlags: one plain sentence per concern`,
    extraInstructions: withFocusNote(layoffNote, focusNote),
  });
}

export function buildRoleTeamTechPrompt(input: ResearchInput, focusNote?: string): string {
  return buildClusterPrompt(input, {
    sections: "roleSpecifics, techStack, companyAtLocation",
    sourcingGuidance:
      "Prefer the company's own engineering or tech blog when one exists — it's a more reliable primary source than a scraped aggregator summary. Also check StackShare, the company's LinkedIn page, the job posting itself if discoverable, and Wellfound for startups.",
    contentConventions: `- roleSpecifics: "Team size: ...", "Schedule: ...", "Focus: ..."
- techStack: one short technology name per fact (e.g. "Go", "Kubernetes")
- companyAtLocation: "Office opened: YYYY", "Local team: ~N engineers", "Reports to: ..." — omit any of these you can't confidently find, don't guess`,
    extraInstructions: withFocusNote(undefined, focusNote),
  });
}

export function buildCompensationPrompt(input: ResearchInput, focusNote?: string): string {
  return buildClusterPrompt(input, {
    sections: "compensation",
    sourcingGuidance: "Check Levels.fyi (best for large/well-known tech companies), Glassdoor, AmbitionBox, Blind, PayScale, and Naukri.",
    contentConventions: `- compensation: "Role (related role): ~range" only when exact-role data is sparse — label it clearly as a related-role estimate, not as data for the actual role, since a proxy from a lower-level title can meaningfully understate what a senior/lead role actually pays`,
    extraInstructions: withFocusNote(undefined, focusNote),
  });
}

export function buildInterviewProcessPrompt(input: ResearchInput, focusNote?: string): string {
  return buildClusterPrompt(input, {
    sections: "interviewProcess",
    sourcingGuidance:
      "Check Glassdoor's Interviews tab, Blind, LeetCode Discuss, GeeksforGeeks \"interview experience\" posts, relevant subreddits, 1point3acres, and personal \"my interview at X\" blog posts.",
    contentConventions: `- interviewProcess: one plain sentence per fact, covering things like commonly reported round count and format (e.g. "Commonly reported: 4-5 rounds over 3-4 weeks, including a system design round"), recurring question themes (e.g. "Frequently asked: reverse a linked list, design a rate limiter"), and overall experience/difficulty sentiment (e.g. "Candidates commonly describe the process as fast-paced but fair")`,
    extraInstructions: withFocusNote(undefined, focusNote),
  });
}

export const SECTION_TO_BUILDER: Record<string, (input: ResearchInput, focusNote?: string) => string> = {
  companySnapshot: buildCompanyFundamentalsPrompt,
  fundingNews: buildCompanyFundamentalsPrompt,
  cultureValues: buildEmployeeExperiencePrompt,
  redFlags: buildEmployeeExperiencePrompt,
  roleSpecifics: buildRoleTeamTechPrompt,
  techStack: buildRoleTeamTechPrompt,
  companyAtLocation: buildRoleTeamTechPrompt,
  compensation: buildCompensationPrompt,
  interviewProcess: buildInterviewProcessPrompt,
};

export function buildSectionDedupPrompt(existingFacts: ParsedFact[], newFacts: ParsedFact[]): string {
  return `You are reviewing newly-researched facts before they get added to a company research report, to avoid adding near-duplicates of what's already there.

You do NOT have any tool access for this pass — no WebSearch, WebFetch, or anything else. Base your review entirely on comparing the two lists below.

Facts already saved for this section (JSON):
${JSON.stringify(existingFacts)}

Newly-found facts, candidates to add (JSON):
${JSON.stringify(newFacts)}

For each newly-found fact, drop it only if it is a near-duplicate of one already saved (same underlying information, even if worded differently) — otherwise keep it, even if it's related to or overlaps partially with an existing fact. When in doubt, keep it: the cost of a redundant fact is much lower than the cost of dropping genuinely new information.

Never edit a fact's content and never include anything from the "already saved" list in your output — your only job is to filter the newly-found list down to what's worth adding.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"facts": [{"section": "<section>", "content": "<content>", "sourceDetail": "<source>"}]}

Include exactly the newly-found facts (unchanged) that are worth adding. Omit any that duplicate what's already saved. An empty facts array is correct if everything new was a duplicate.`;
}

export function buildResearchVerifyPrompt(facts: ParsedFact[]): string {
  return `You are fact-checking a list of researched facts about a company, before they get saved.

You do NOT have any tool access for this pass — no WebSearch, WebFetch, or anything else. Each fact was already found via real web research by a separate process; your job here is judgment, not re-searching. Base your review entirely on your own reasoning and general knowledge.

Facts to check (JSON):
${JSON.stringify(facts)}

Drop a fact only if it is implausible on its face, internally contradictory, garbled or nonsensical, or a near-duplicate of another fact in the list (in which case keep the more specific one). When you are not sure either way, keep it — it was already sourced by the original research, so the default should favor keeping, not dropping.

Never add a new fact that was not in the input list, and never edit a fact's content — your only job is to remove facts that do not hold up, not to add or improve them.

Respond with ONLY a JSON object (no markdown, no commentary, no code fences) in exactly this shape:

{"facts": [{"section": "<section>", "content": "<content>", "sourceDetail": "<source>"}]}

Include exactly the facts (unchanged) that you confirmed. Omit any fact that did not hold up. An empty facts array is correct if none held up.`;
}
