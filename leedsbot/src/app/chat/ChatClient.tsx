// src/app/chat/ChatClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Subject = 'MATHS' | 'MIDGE' | 'DATABASE_SYSTEMS';
type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

type Msg = { role: 'user' | 'assistant'; content: string; nextSteps?: string[] };
type AskPayload = { ask: string[] };
type ChatReply = { answer: string; nextSteps?: string[]; ask?: string[] };

export default function ChatClient() {
  const [subject, setSubject] = useState<Subject>('MATHS');
  const [level, setLevel] = useState<Level>('BEGINNER');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [ask, setAsk] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const intakeComplete = useMemo(
    () => !!ask && ask.length > 0 && ask.every((_, i) => (answers[i] ?? '').trim().length > 0),
    [ask, answers]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    beginIntake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const beginIntake = async () => {
    setMessages([]);
    setAsk(null);
    setAnswers({});
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, init: true }),
      });
      const data: AskPayload = await res.json();
      setAsk(data.ask || defaultQuestions(subject));
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Tell me a bit so I can tailor help. You can also upload notes — I’ll use them to guide the questions and answers.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendIntake = async () => {
    if (!intakeComplete) return;
    setLoading(true);
    try {
      const intake = ask!.map((q, i) => ({ q, a: answers[i] }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, intake }),
      });
      const data: ChatReply = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, nextSteps: data.nextSteps }]);
      if (data.ask?.length) {
        setAsk(data.ask);
        setAnswers({});
      } else {
        setAsk(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message: q }),
      });
      const data: ChatReply = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, nextSteps: data.nextSteps }]);
      if (data.ask?.length) {
        setAsk(data.ask);
        setAnswers({});
      }
    } finally {
      setLoading(false);
    }
  };

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesChosen: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('level', level);
      for (const f of files) fd.append('files', f);

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `Uploaded ${data.count} file(s): ${data.files?.join(', ') || ''}. I’ll use them for tailored help.`,
          },
        ]);
        await beginIntake();
      } else {
        alert(data?.error || 'Upload failed');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Chat</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Subject:</label>
        <select className="rounded border p-2" value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
          <option value="MATHS">Maths</option>
          <option value="MIDGE">Midge</option>
          <option value="DATABASE_SYSTEMS">Database Systems</option>
        </select>

        <label className="ml-4 text-sm">Level (for uploads):</label>
        <select className="rounded border p-2" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </select>

        <button
          onClick={onPickFiles}
          className="ml-auto rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : 'Upload notes'}
        </button>
        <input type="file" multiple accept=".pdf,.txt,.md,.docx" hidden ref={fileInputRef} onChange={onFilesChosen} />
      </div>

      {/* Intake panel */}
      {ask && (
        <div className="rounded border p-4 space-y-3 bg-white">
          <div className="font-medium">Quick personalisation</div>
          {ask.map((q, i) => (
            <div key={i}>
              <label className="block text-sm text-gray-700">{q}</label>
              <input
                className="mt-1 w-full rounded border p-2"
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((s) => ({ ...s, [i]: e.target.value }))}
              />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              disabled={!intakeComplete || loading}
              onClick={sendIntake}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Save & continue'}
            </button>
            <button
              disabled={loading}
              onClick={() => {
                setAsk(null);
              }}
              className="rounded border px-4 py-2"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="rounded border p-3 bg-white">
        {messages.length === 0 && !ask && (
          <p className="text-sm text-gray-500">Ask anything about your subject. Upload notes to make answers specific.</p>
        )}

        <div className="space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div
                className={
                  'inline-block max-w-full whitespace-pre-wrap rounded-lg border px-3 py-2 ' +
                  (m.role === 'user' ? '' : 'bg-gray-50')
                }
              >
                {m.content}
              </div>

              {!!m.nextSteps?.length && (
                <div className="mt-2 text-left">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Next steps</div>
                  <ul className="list-disc pl-5 text-sm">
                    {m.nextSteps.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {loading && <div className="text-sm text-gray-500">Thinking…</div>}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask a question (e.g., Explain 3NF with a quick example)"
        />
        <button onClick={send} className="rounded bg-black px-4 py-2 text-white">
          Send
        </button>
      </div>

      <p className="text-xs text-gray-500">Notes are pooled by subject + level for this prototype.</p>
    </div>
  );
}

function defaultQuestions(subject: string) {
  return [
    `Which topics in ${subject.replace('_', ' ')} are you working on right now?`,
    'What’s your immediate goal (exam, assignment, concept mastery)?',
    'Where do you feel least confident?',
    'Do you prefer step-by-step derivations or high-level intuition?',
    'Deadline or timeline?',
  ];
}
