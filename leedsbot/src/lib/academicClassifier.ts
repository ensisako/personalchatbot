// src/lib/academicClassifier.ts
import OpenAI from 'openai';
import type { GuardVerdict } from './academicGuard';

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey?.trim() ? new OpenAI({ apiKey }) : null;

/**
 * LLM-based guard used only when the text mentions assessed work.
 * Returns { blocked: false } if no API key or on any error, so we never block by accident.
 */
export async function llmGuard(input: string): Promise<GuardVerdict> {
  if (!client) return { blocked: false };

  try {
    const msg = `Classify if the user is asking you to produce assessed academic work (verbatim, ready-to-submit). 
Answer ONLY "allow" or "block". 
Text: """${input}"""`;

    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [{ role: 'user', content: msg }],
    });

    const label = (r.choices[0]?.message?.content || '').toLowerCase();
    return { blocked: label.includes('block') };
  } catch {
    return { blocked: false };
  }
}
