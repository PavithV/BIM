// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const options = {
      name: '__session',
      value: '',
      maxAge: -1,
    };

    const response = NextResponse.json({}, { status: 200 });
    response.cookies.set(options);
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
