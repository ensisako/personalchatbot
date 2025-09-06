// src/lib/academicGuard.ts
export type GuardVerdict = {
  blocked: boolean;
  reason?: string;
  hit?: string; // which keyword triggered (optional)
};

const KEYWORDS = [
  // direct asks
  'do my assignment', 'write my assignment', 'finish my coursework', 'solve my homework',
  'complete my essay', 'write my dissertation', 'make my report',
  // milder forms
  'make an assignment for me', 'generate my assignment', 'full assignment',
  'ready to submit', 'no plagiarism detector',
  // exam/test
  'answer this exam', 'quiz answer key', 'test answers'
];

// quick allowlist to reduce false positives
const ALLOW_HINTS = [
  'outline', 'plan', 'rubric', 'explain', 'feedback', 'critique',
  'practice questions', 'example questions', 'worked example'
];

/** Fast keyword guard */
export function ruleGuard(input: string): GuardVerdict {
  const s = (input || '').toLowerCase();

  // if the user explicitly asks for allowed help, don't block on keyword collisions
  if (ALLOW_HINTS.some(h => s.includes(h))) return { blocked: false };

  const hit = KEYWORDS.find(k => s.includes(k));
  if (hit) return { blocked: true, reason: 'Direct request to generate assessed work.', hit };

  // Heuristic: mentions assessed work + “for me/submit/ready”
  if (/(assignment|coursework|essay|report|dissertation|homework|exam|quiz).*(for me|submit|ready)/i.test(input)) {
    return { blocked: true, reason: 'Likely assessed work request.' };
  }

  return { blocked: false };
}

/** Helper to decide when to run the slower LLM guard */
export function mentionsAssessedWork(input: string): boolean {
  return /(assignment|coursework|essay|report|dissertation|homework|exam|quiz)/i.test(input || '');
}
