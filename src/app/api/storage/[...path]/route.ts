import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to proxy storage files to avoid CORS or auth headers issues on client for public/signed URLs.
 * Usage: /api/storage?url={url}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    console.log('Proxying file from URL:', url);

    const response = await fetch(url);

    if (!response.ok) {
      console.error('Storage response not OK:', response.status, response.statusText);
      return NextResponse.json(
        { error: `File not found or access denied: ${response.statusText}` },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length') || blob.size.toString();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error proxying file:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
