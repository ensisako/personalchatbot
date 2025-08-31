import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

function trim(str: string, max = 8000) {
  return str.length <= max ? str : str.slice(0, max);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey?.trim() ? new OpenAI({ apiKey }) : null;

  try {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const subject = String(body.subject || 'MATHS') as 'MATHS' | 'MIDGE' | 'DATABASE_SYSTEMS';
    const message = typeof body.message === 'string' ? body.message : '';
    const init = !!body.init;
    const intake: Array<{ q: string; a: string }> | undefined = Array.isArray(body.intake) ? body.intake : undefined;

    // Profile (for level + degree)
    const profile = await prisma.user.findUnique({
      where: { email: user.email },
      include: { subjectLvls: true },
    });
    const level = profile?.subjectLvls.find((s) => s.subject === subject)?.level ?? 'BEGINNER';
    const degree = profile?.degree ?? 'BACHELORS';

    // ==== DOCUMENTS (GLOBAL POOL) ====
    // Pool across ALL users by subject + level (as requested)
    const docs = await prisma.document.findMany({
      where: { subject: subject as any, level: level as any },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const usedDocIds = docs.map((d) => d.id);
    const docsText = trim(
      docs.map((d, i) => `#Doc${i + 1} (${d.filename})\n${(d.textContent || '').slice(0, 2000)}`).join('\n\n'),
      10_000
    );

    // ==== INIT: ask intake questions ====
    if (init) {
      // Prefer doc-based prompts if model is available and we have docs
      if (client && docs.length) {
        try {
          const sys = `You create 4-5 short intake questions tailored to ${subject} at ${level} level, based ONLY on the document snippets below. Return JSON: { "ask": string[] } and nothing else.`;
          const userMsg = `Documents:\n${docsText}`;

          const c = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: userMsg },
            ],
          });

          const raw = c.choices[0]?.message?.content?.trim() || '';
          try {
            const json = JSON.parse(raw) as { ask?: string[] };
            if (json.ask && json.ask.length) {
              return NextResponse.json({ ask: json.ask.slice(0, 6) });
            }
          } catch { /* fall through */ }
        } catch { /* fall through */ }
      }

      // Default fallback questions
      return NextResponse.json({
        ask: [
          `Which topics in ${subject.replace('_', ' ')} are you working on now?`,
          'What’s your immediate goal (exam, assignment, concept mastery)?',
          'Where do you feel least confident?',
          'Do you prefer worked examples or compact theory?',
          'Any deadlines?',
        ],
      });
    }

    // ==== OPTIONAL: persist intake summary into goals ====
    if (intake?.length) {
      const goalsSummary =
        'Goal: ' +
        (intake.find((x) => /goal/i.test(x.q))?.a || '') +
        ' | Topics: ' +
        (intake.find((x) => /topics?/i.test(x.q))?.a || '') +
        ' | Weakness: ' +
        (intake.find((x) => /(least confident|weak|struggl)/i.test(x.q))?.a || '');
      await prisma.user.update({
        where: { email: user.email },
        data: { goals: goalsSummary.slice(0, 1000) },
      });
    }

    // ==== Compose tutoring prompt ====
    const sys = [
      `You are LeedsBot, a concise HE tutor for ${subject} at ${level} level (degree: ${degree}).`,
      `Use ONLY the "Documents" and the user's message. If insufficient, reply "Insufficient context from uploaded notes." and ask for missing file/detail.`,
      `Format: return ONLY JSON -> { "answer": string, "nextSteps": string[], "ask"?: string[] }`,
      `Style: step-by-step, brief, practical. End with 3–6 actionable nextSteps.`,
    ].join(' ');

    const userMsg = [
      intake?.length
        ? `Intake:\n${intake.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join('\n')}`
        : 'No new intake answers.',
      `Documents:\n${docsText || '(none found for this subject/level)'}\n`,
      message ? `Question:\n${message}` : 'No direct question; give a short study plan based on intake + docs.',
    ].join('\n\n');

    // If no key → deterministic fallback
    if (!client) {
      const answer =
        'Model unavailable. Based on your notes, focus on: definitions → 2 practice problems → self-explanation. Upload more targeted notes if context is insufficient.';
      const nextSteps = [
        'Skim your notes and extract 3 key points.',
        'Solve 2 related practice questions.',
        'Write a 3-bullet summary and one worked example.',
      ];
      return NextResponse.json({ answer, nextSteps });
    }

    // Call OpenAI (with graceful quota fallback)
    let answer = 'Sorry, I could not generate an answer.';
    let nextSteps: string[] | undefined;
    let askBack: string[] | undefined;

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() || '';
      try {
        const json = JSON.parse(raw) as { answer?: string; nextSteps?: string[]; ask?: string[] };
        answer = json.answer || answer;
        nextSteps = Array.isArray(json.nextSteps) ? json.nextSteps.slice(0, 8) : undefined;
        askBack = Array.isArray(json.ask) ? json.ask.slice(0, 5) : undefined;
      } catch {
        answer = raw || answer;
        nextSteps = nextSteps ?? ['Review key definitions', 'Try 2 practice problems', 'Summarise one concept in your own words'];
      }
    } catch (e: any) {
      // Quota or network fallback
      const fbAnswer =
        'AI quota hit. Here’s a quick plan from your notes: focus on key terms, a worked example, and 2 practice questions. Upload more specific notes for deeper help.';
      const fbSteps = ['Extract 3 key ideas', 'Solve 2 problems', 'Write a brief summary'];
      answer = fbAnswer;
      nextSteps = fbSteps;
    }

    // ==== Store interaction (for future training/quizzes) ====
    // Note: we store per-user interaction, but docs are pooled.
    await prisma.interaction.create({
      data: {
        userEmail: user.email,
        subject: subject as any,
        level: level as any,
        prompt: (message || '[intake/plan]').slice(0, 8000),
        answer: (answer || '').slice(0, 8000),
        usedDocIds,
      },
    });

    return NextResponse.json({ answer, nextSteps, ask: askBack });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}
