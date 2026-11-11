/**
 * Teire's prompt-injection check, served as an Otari guardrail (`/api/guardrails/validate`, the
 * guardrails service contract): Otari sends it the latest user message of a guarded request before
 * any model sees it, and refuses the request (403 `guardrail_violation`) when it is flagged.
 *
 * What it looks for is text written to steer an AI rather than inform a reader: orders to drop prior
 * instructions, a new persona, role markers a chat template would read as a system turn, orders to
 * hide something from the user, and orders to leak secrets or run commands. Release notes, changelogs
 * and docs pages never need any of these. Each signal has a weight; the score is the chance that at
 * least one is real (1 − ∏(1 − w)), and the text is flagged at GUARD.flagAt.
 */
export const GUARD = {
  profile: "prompt-injection",
  flagAt: 0.6,
  /** Longest text checked; Otari sends one message, and a page is cut to this before it is read. */
  maxChars: 400_000,
} as const;

interface Signal {
  name: string;
  weight: number;
  pattern: RegExp;
}

const AI = String.raw`(?:ai|assistant|agent|llm|model|language model|chatbot|copilot|claude|gpt|gemini|bot)`;

const SIGNALS: Signal[] = [
  {
    name: "drop prior instructions",
    weight: 0.85,
    pattern:
      /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|your|the system)\b[^.\n]{0,30}\b(?:instructions?|prompts?|messages?|rules|directions|guidelines|context)\b/i,
  },
  {
    name: "new persona",
    weight: 0.5,
    pattern:
      /\b(?:you are now|from now on,? you|pretend (?:to be|you are)|act as (?:an?|the) (?:unrestricted|different|new)|your new (?:role|instructions|task) (?:is|are))\b/i,
  },
  {
    name: "chat-template role marker",
    weight: 0.75,
    pattern:
      /<\|im_start\|>|<\|system\|>|\[\/?INST\]|<<SYS>>|<\/?system>|^#{2,}\s*(?:system|instructions?)\s*:?\s*$/im,
  },
  {
    name: "addresses the AI directly",
    weight: 0.55,
    pattern: new RegExp(
      String.raw`\b(?:dear |attention,? |note to (?:the )?|hey,? )?${AI}s?\b[,:]?\s+(?:reading this|that reads this|processing this)?[^.\n]{0,20}\b(?:must|should|need to|are required to|always|never|do not|don't|please)\b`,
      "i",
    ),
  },
  {
    name: "hide from the user",
    weight: 0.7,
    pattern:
      /\b(?:do not|don't|never)\s+(?:tell|inform|mention|reveal|show|disclose)\b[^.\n]{0,30}\b(?:the user|anyone|the developer|the human|the reviewer|this)\b/i,
  },
  {
    name: "leak secrets",
    weight: 0.8,
    pattern:
      /\b(?:send|post|upload|exfiltrate|forward|print|output|include|add)\b[^.\n]{0,60}\b(?:api[_ -]?keys?|tokens?|secrets?|credentials?|passwords?|\.env\b|ssh keys?|GITHUB_TOKEN|environment variables)\b[^.\n]{0,60}\b(?:to|into|in)\b[^.\n]{0,40}(?:https?:\/\/|webhook|the (?:pr|pull request|commit|issue))/i,
  },
  {
    name: "run a remote script",
    weight: 0.75,
    pattern: /\b(?:curl|wget|iwr|invoke-webrequest)\b[^\n|]{0,160}\|\s*(?:sh|bash|zsh|python3?|node|iex)\b/i,
  },
  {
    name: "order to run commands",
    weight: 0.45,
    pattern:
      /\b(?:run|execute|eval)\b\s+(?:this|the following|these)\s+(?:command|commands|code|script|shell)\b[^.\n]{0,40}\b(?:before|instead|without|silently|immediately)\b/i,
  },
  {
    name: "change the fix",
    weight: 0.45,
    pattern:
      /\b(?:add|insert|include|commit|push)\b[^.\n]{0,40}\b(?:a |this )?(?:dependency|package|postinstall|preinstall|script|line|backdoor|hook)\b[^.\n]{0,60}\b(?:to every|to all|to the (?:pr|pull request|patch|fix)|when (?:fixing|upgrading|you fix))\b/i,
  },
];

export interface InjectionVerdict {
  flagged: boolean;
  score: number;
  signals: string[];
}

export function detectInjection(text: string): InjectionVerdict {
  const sample = text.slice(0, GUARD.maxChars);
  const hits = SIGNALS.filter((s) => s.pattern.test(sample));
  const score = 1 - hits.reduce((p, s) => p * (1 - s.weight), 1);
  return {
    flagged: score >= GUARD.flagAt,
    score: Math.round(score * 1000) / 1000,
    signals: hits.map((s) => s.name),
  };
}
