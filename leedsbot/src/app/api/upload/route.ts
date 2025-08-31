import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { prisma } from '@/lib/prisma';

// Helpers (lazy import CJS libs to avoid ESM friction)
// Helpers (lazy import to keep cold starts low and avoid ESM friction)
async function extractText(file: File): Promise<{ text: string; mimeType: string }> {
  const mime = file.type || '';
  const name = (file.name || '').toLowerCase();

  // Plain text / markdown
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    return { text, mimeType: mime || 'text/plain' };
  }

  // PDF
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default; // typed by src/types/pdf-parse.d.ts
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await pdfParse(buf);
    return { text: out.text || '', mimeType: 'application/pdf' };
  }

  // DOCX
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    const { extractRawText } = await import('mammoth'); // typed by src/types/mammoth.d.ts
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await extractRawText({ buffer: buf });
    return {
      text: out.value || '',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // Fallback
  return { text: '', mimeType: mime || 'application/octet-stream' };
}


export async function POST(req: NextRequest) {
  const { getUser } = getKindeServerSession();
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();

  const subject = String(form.get('subject') || 'MATHS') as 'MATHS' | 'MIDGE' | 'DATABASE_SYSTEMS';
  const level = String(form.get('level') || 'BEGINNER') as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

  const files = form.getAll('files').filter(Boolean) as File[];
  if (!files.length) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const MAX_TEXT = 200_000; // per file cap for prototype
  const created = [];

  for (const file of files) {
    const { text, mimeType } = await extractText(file);
    await prisma.document.create({
      data: {
        ownerEmail: user.email,
        subject: subject as any,
        level: level as any,
        filename: file.name,
        mimeType,
        textContent: (text || '').slice(0, MAX_TEXT),
      },
    });
    created.push(file.name);
  }

  return NextResponse.json({ ok: true, count: created.length, files: created });
}
