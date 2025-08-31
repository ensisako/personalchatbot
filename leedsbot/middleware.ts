import { withAuth } from '@kinde-oss/kinde-auth-nextjs/middleware';

export default function middleware(req: Request) {
  return withAuth(req);
}

export const config = {
  // Protect only app pages (NOT /api/*)
  matcher: ['/dashboard', '/chat', '/quiz', '/uploads'],
};
