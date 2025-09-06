// src/app/onboarding/OnboardingClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const PROGRAMMES: Record<'BACHELORS'|'MASTERS'|'PHD', string[]> = {
  BACHELORS: [
    'BSc (Hons) Computer Science',
    'BSc (Hons) Mathematics',
    'BSc (Hons) Software Engineering',
    'BEng (Hons) Electronics & Computer Engineering',
    'BA (Hons) Business & Management',
  ],
  MASTERS: [
    'MSc Data Science',
    'MSc Cyber Security',
    'MSc Software Engineering',
    'MSc Advanced Computer Science',
  ],
  PHD: ['PhD Computing', 'PhD Mathematics'],
};

const schema = z.object({
  studentId: z.string().regex(/^c\d{8}$/i, 'Student ID must be c########'),
  degree: z.enum(['BACHELORS','MASTERS','PHD']),
  degreeName: z.string().min(2, 'Select your programme'),
  goals: z.string().optional(),
  levels: z.object({
    MATHS: z.enum(['BEGINNER','INTERMEDIATE','ADVANCED']),
    MIDGE: z.enum(['BEGINNER','INTERMEDIATE','ADVANCED']),
    DATABASE_SYSTEMS: z.enum(['BEGINNER','INTERMEDIATE','ADVANCED']),
  }),
});
type FormData = z.infer<typeof schema>;

export default function OnboardingClient() {
  const [degree, setDegree] = useState<'BACHELORS'|'MASTERS'|'PHD'>('BACHELORS');
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        degree: 'BACHELORS',
        degreeName: PROGRAMMES.BACHELORS[0],
        levels: { MATHS:'BEGINNER', MIDGE:'BEGINNER', DATABASE_SYSTEMS:'BEGINNER' },
      },
    });

  const degreeWatch = watch('degree', degree);
  const programmeOptions = useMemo(() => PROGRAMMES[degreeWatch], [degreeWatch]);

  // Prefill from server — if already completed, bounce to /dashboard
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/profile', { method: 'GET' });
        const data = await r.json();
        if (data?.completed) {
          window.location.href = '/dashboard';
          return;
        }
        if (data?.profile) {
          const p = data.profile as Partial<FormData>;
          if (p.studentId) setValue('studentId', p.studentId);
          if (p.degree) setValue('degree', p.degree);
          if (p.degreeName) setValue('degreeName', p.degreeName);
          if (p.goals !== undefined) setValue('goals', p.goals);
          if (p.levels?.MATHS) setValue('levels.MATHS', p.levels.MATHS);
          if (p.levels?.MIDGE) setValue('levels.MIDGE', p.levels.MIDGE);
          if (p.levels?.DATABASE_SYSTEMS) setValue('levels.DATABASE_SYSTEMS', p.levels.DATABASE_SYSTEMS);

          // keep local degree state in sync for the programme list
          if (p.degree) setDegree(p.degree);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When degree changes, ensure degreeName is valid for that degree
  useEffect(() => {
    const current = (watch('degreeName') as string) || '';
    if (!programmeOptions.includes(current)) {
      setValue('degreeName', programmeOptions[0], { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmeOptions]);

  const onSubmit = async (data: FormData) => {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      window.location.href = '/dashboard';
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error ?? 'Failed to save profile');
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="text-sm text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Set up your profile</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your Student ID, select your degree & programme, then your current level in each subject.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Student ID</label>
          <input className="mt-1 w-full rounded border p-2" placeholder="c12345678" {...register('studentId')} />
          {errors.studentId && <p className="text-sm text-red-600">{errors.studentId.message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Degree type</label>
            <select
              className="mt-1 w-full rounded border p-2"
              {...register('degree')}
              onChange={(e) => setDegree(e.target.value as any)}
            >
              <option value="BACHELORS">Bachelors</option>
              <option value="MASTERS">Masters</option>
              <option value="PHD">PhD</option>
            </select>
            {errors.degree && <p className="text-sm text-red-600">{errors.degree.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">Programme (degree name)</label>
            <select className="mt-1 w-full rounded border p-2" {...register('degreeName')}>
              {programmeOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.degreeName && <p className="text-sm text-red-600">{errors.degreeName.message}</p>}
          </div>
        </div>

        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(['MATHS','MIDGE','DATABASE_SYSTEMS'] as const).map((s) => (
            <div key={s} className="rounded border p-3">
              <label className="block text-sm font-medium">{s.replace('_',' ')}</label>
              <select className="mt-1 w-full rounded border p-2" {...register(`levels.${s}`)}>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
              {errors.levels?.[s] && <p className="text-sm text-red-600">{(errors.levels as any)[s]?.message}</p>}
            </div>
          ))}
        </fieldset>

        <div>
          <label className="block text-sm font-medium">Goals (optional)</label>
          <textarea className="mt-1 w-full rounded border p-2" rows={3} {...register('goals')} />
        </div>

        <button disabled={isSubmitting} className="rounded bg-black px-4 py-2 text-white">
          {isSubmitting ? 'Saving…' : 'Save & Continue'}
        </button>
      </form>
    </main>
  );
}
