export type FactSourceType = "RESEARCHED" | "USER_PROVIDED";
export type RoundStatusView = "UPCOMING" | "COMPLETED" | "NOT_HAPPENING";
export type ResearchStatusView = "NOT_STARTED" | "RESEARCHING" | "DONE" | "FAILED";

export interface FactView {
  id: string;
  content: string;
  sourceType: FactSourceType;
  sourceDetail: string;
}

export interface ThreadSummary {
  id: string;
  companyName: string;
  position: string;
  location: string;
  completedRounds: number;
  totalRounds: number | null;
  hasNotHappeningRound: boolean;
}

export interface InterviewerView {
  id: string;
  name: string;
  role: string | null;
  tenure: string | null;
  background: string | null;
}

export interface RoundView {
  id: string;
  name: string;
  order: number;
  status: RoundStatusView;
  prepMaterial: FactView[];
  smartQuestions: FactView[];
  yourNotes: FactView[];
  interviewers: InterviewerView[];
}

export interface ThreadReport {
  id: string;
  companyName: string;
  position: string;
  location: string;
  companyDomain: string | null;
  confirmedTotalRounds: number | null;
  confirmedTotalRoundsSource: string | null;
  researchStatus: ResearchStatusView;
  researchError: string | null;
  sections: Record<string, FactView[]>;
  rounds: RoundView[];
}

export type ChatMessageStatus = "PENDING" | "DONE" | "FAILED";

export interface ChatMessage {
  id: string;
  from: "you" | "assistant";
  text: string;
  status: ChatMessageStatus;
}
