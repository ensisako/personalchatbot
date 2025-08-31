'use client';
import { useState } from 'react';

export default function Uploads(){
  const [subject, setSubject] = useState<'MATHS'|'MIDGE'|'DATABASE_SYSTEMS'>('MATHS');
  const [level, setLevel] = useState<'BEGINNER'|'INTERMEDIATE'|'ADVANCED'>('BEGINNER');
  const [text, setText] = useState('');
  const [list, setList] = useState<any[]>([]);

  const save = async () => {
    const r = await fetch('/api/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subject, level, text }) });
    if (r.ok) { setText(''); load(); }
  };
  const load = async () => {
    const r = await fetch('/api/upload'); const data = await r.json(); setList(data.docs);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Uploads (prototype)</h1>
      <div className="rounded border p-3 space-y-2">
        <div className="flex gap-2">
          <select className="rounded border p-2" value={subject} onChange={e=>setSubject(e.target.value as any)}>
            <option value="MATHS">Maths</option>
            <option value="MIDGE">Midge</option>
            <option value="DATABASE_SYSTEMS">Database Systems</option>
          </select>
          <select className="rounded border p-2" value={level} onChange={e=>setLevel(e.target.value as any)}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
        <textarea className="mt-2 w-full rounded border p-2" rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste notes (text only for prototype)" />
        <button onClick={save} className="rounded bg-black px-4 py-2 text-white">Save</button>
        <button onClick={load} className="ml-2 rounded border px-3 py-2">Refresh list</button>
      </div>

      <div className="space-y-3">
        {list.map((d:any)=> (
          <div key={d.id} className="rounded border p-3">
            <div className="text-sm text-gray-600">{d.subject} · {d.level}</div>
            <div className="mt-1 whitespace-pre-wrap">{d.textContent?.slice(0,500)}{(d.textContent?.length||0)>500?'…':''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}