// src/app/api/auth/logout/route.ts
import { getAdminAuth } from '@/firebase/admin';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = cookies().get('__session')?.value;
    if (sessionCookie) {
        const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie).catch(() => null);
        if(decodedClaims) {
            await getAdminAuth().revokeRefreshTokens(decodedClaims.sub);
        }
    }

    const options = {
      name: '__session',
      value: '',
      maxAge: -1,
    };

    const response = NextResponse.json({success: true}, { status: 200 });
    response.cookies.set(options);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
