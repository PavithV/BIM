// src/app/api/auth/logout/route.ts
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Clear the session cookie
    const options = {
      name: '__session',
      value: '',
      maxAge: -1,
    };

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set(options);
    
    // Invalidate the session on the client side by clearing the cookie
    const session = cookies().get('__session');
    if (session) {
      cookies().delete('__session');
    }

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
