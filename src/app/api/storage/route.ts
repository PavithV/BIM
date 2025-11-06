import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to proxy Firebase Storage files with CORS headers
 * 
 * Usage:
 * /api/storage?url={signedUrl} - Use signed URL from Firebase Storage
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const signedUrl = searchParams.get('url');
    
    if (!signedUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }
    
    console.log('Fetching from Firebase Storage:', signedUrl);
    
    // Fetch the file from Firebase Storage
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      console.error('Firebase Storage response not OK:', response.status, response.statusText);
      return NextResponse.json(
        { error: `File not found or access denied: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length') || blob.size.toString();
    
    console.log('File loaded successfully, size:', blob.size);
    
    // Return file with CORS headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error proxying file from storage:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
    },
  });
}
