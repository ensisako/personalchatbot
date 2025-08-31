'use client';
import { useEffect, useState } from 'react';

type Item = { question: string; choices: string[]; answerIndex: number; explanation: string; topic?: string };

export default function QuizPage(){
  const [subject, setSubject] = useState<'MATHS'|'MIDGE'|'DATABASE_SYSTEMS'>('DATABASE_SYSTEMS');
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{score:number;max:number}|null>(null);

  const generate = async () => {
    const r = await fetch('/api/quiz/generate', { method:'POST', body: JSON.stringify({ subject }) });
    const data = await r.json(); setItems(data.items); setAnswers({}); setResult(null);
  };

  const submit = async () => {
    const r = await fetch('/api/quiz/generate', { method:'PUT', body: JSON.stringify({ subject, items, answers }) });
    const data = await r.json(); setResult({ score: data.score, max: data.max });
  };

  useEffect(()=>{ generate(); },[]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Quiz</h1>
      <div>
        <label className="mr-2 text-sm">Subject:</label>
        <select className="rounded border p-2" value={subject} onChange={(e)=>setSubject(e.target.value as any)}>
          <option value="MATHS">Maths</option>
          <option value="MIDGE">Midge</option>
          <option value="DATABASE_SYSTEMS">Database Systems</option>
        </select>
        <button className="ml-3 rounded border px-3 py-2" onClick={generate}>New quiz</button>
      </div>

      {items.map((it, idx)=> (
        <div key={idx} className="rounded border p-3">
          <div className="font-medium">Q{idx+1}. {it.question}</div>
          <div className="mt-2 space-y-1">
            {it.choices.map((c, i)=> (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={`q${idx}`} checked={answers[idx]===i} onChange={()=>setAnswers(a=>({...a,[idx]:i}))} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button onClick={submit} className="rounded bg-black px-4 py-2 text-white">Submit</button>

      {result && (
        <div className="rounded border p-4">
          <div className="font-medium">Result</div>
          <div className="mt-1">Score: {result.score} / {result.max}</div>
        </div>
      )}
    </div>
  );
}