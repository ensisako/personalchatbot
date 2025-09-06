'use client';
import { useEffect, useState } from 'react';

type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
type Item = { question: string; choices: string[]; answerIndex: number; explanation: string; topic?: string; difficulty?: Level; };

export default function QuizPage() {
  const [subject, setSubject] = useState<'MATHS' | 'MIDGE' | 'DATABASE_SYSTEMS'>('DATABASE_SYSTEMS');
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; max: number } | null>(null);
  const [meta, setMeta] = useState<{ weakTopics?: string[]; targetLevel?: Level } | null>(null);
  const [loading, setLoading] = useState(false);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [needed, setNeeded] = useState<{ uploadsRemaining?: number; questionsRemaining?: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const generate = async (mode: 'new' | 'focus' = 'new') => {
    setLoading(true);
    try {
      const r = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, mode }),
      });
      const data = await r.json();

      setAvailable(!!data.available);
      setWarning(data.warning || null);

      if (!data.available) {
        setNeeded(data.needed || null);
        setItems([]);
        setAnswers({});
        setResult(null);
        setMeta(null);
        return;
      }

      setItems(data.items || []);
      setAnswers({});
      setResult(null);
      setMeta({ weakTopics: data.weakTopics || [], targetLevel: data.targetLevel as Level | undefined });
      setNeeded(null);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/quiz/generate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, items, answers }),
      });
      const data = await r.json();
      setResult({ score: data.score, max: data.max });
    } finally {
      setLoading(false);
    }
  };

  // Do NOT auto-generate; wait for user to click "Check availability"
  useEffect(() => {
    setAvailable(null);
    setItems([]);
    setAnswers({});
    setResult(null);
    setMeta(null);
    setNeeded(null);
    setWarning(null);
  }, [subject]);

  const chosen = (idx: number) => answers[idx];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Quiz</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="mr-2 text-sm">Subject:</label>
        <select className="rounded border p-2" value={subject} onChange={(e) => setSubject(e.target.value as any)}>
          <option value="MATHS">Maths</option>
          <option value="MIDGE">Midge</option>
          <option value="DATABASE_SYSTEMS">Database Systems</option>
        </select>

        <button className="ml-3 rounded border px-3 py-2" onClick={() => generate('new')} disabled={loading}>
          {available === null ? 'Check availability' : 'New quiz'}
        </button>

        <button
          className="rounded border px-3 py-2"
          onClick={() => generate('focus')}
          disabled={loading || !available}
          title="Focus on weak topics from your last attempt"
        >
          Focus practice
        </button>

        {meta?.targetLevel && <span className="ml-3 text-xs text-gray-500">Difficulty: {meta.targetLevel}</span>}
        {!!meta?.weakTopics?.length && (
          <span className="ml-3 text-xs text-gray-500">Weak topics: {meta.weakTopics.join(', ')}</span>
        )}
      </div>

      {/* LOCKED PANEL */}
      {available === false && (
        <div className="rounded border p-4 bg-amber-50">
          <div className="font-medium">Quiz locked until we know what to target</div>
          <p className="mt-1 text-sm">
            Add <strong>notes</strong> or ask at least <strong>{needed?.questionsRemaining ?? 0}</strong> more questions.
          </p>
          <ul className="mt-2 text-sm list-disc pl-5">
            <li>Uploads remaining: <strong>{needed?.uploadsRemaining ?? 0}</strong></li>
            <li>Questions remaining: <strong>{needed?.questionsRemaining ?? 0}</strong></li>
          </ul>
          <div className="mt-3 flex gap-2">
            <a href="/uploads" className="rounded bg-black px-3 py-2 text-white">Upload notes</a>
            <a href="/chat" className="rounded border px-3 py-2">Ask questions</a>
          </div>
        </div>
      )}

      {/* WARNING IF GENERATION FAILED */}
      {warning && available && (
        <div className="rounded border p-3 text-sm bg-yellow-50">{warning}</div>
      )}

      {/* QUESTIONS */}
      {items.map((it, idx) => (
        <div key={idx} className="rounded border p-3">
          <div className="font-medium">Q{idx + 1}. {it.question}</div>
          <div className="mt-1 text-xs text-gray-500">
            {it.topic ? `Topic: ${it.topic}` : null} {it.difficulty ? (it.topic ? ' • ' : '') + it.difficulty : null}
          </div>
          <div className="mt-2 space-y-1">
            {it.choices.map((c, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`q${idx}`}
                  checked={chosen(idx) === i}
                  onChange={() => setAnswers((a) => ({ ...a, [idx]: i }))}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
          {result && (
            <div className="mt-2 rounded bg-gray-50 p-2 text-sm">
              {answers[idx] === it.answerIndex ? (
                <div>✅ Correct</div>
              ) : (
                <div>
                  ❌ Incorrect • Correct answer: <strong>{it.choices[it.answerIndex]}</strong>
                  <div className="mt-1 text-gray-700">Explanation: {it.explanation}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={submit}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={loading || items.length === 0}
      >
        Submit
      </button>

      {result && (
        <div className="rounded border p-4">
          <div className="font-medium">Result</div>
          <div className="mt-1">Score: {result.score} / {result.max}</div>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500">Working…</div>}
    </div>
  );
}
