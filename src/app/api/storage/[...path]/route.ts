import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to proxy Firebase Storage files with CORS headers
 * 
 * Usage options:
 * 1. /api/storage?url={signedUrl} - Use signed URL from Firebase Storage (preferred)
 * 2. /api/storage/users/{userId}/ifcModels/{projectId}/{fileName} - Use storage path
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const signedUrl = searchParams.get('url');
    
    let storageUrl: string;
    
    if (signedUrl) {
      // Use signed URL directly (contains token)
      console.log('Using signed URL from query parameter');
      storageUrl = signedUrl;
    } else if (params?.path && params.path.length > 0) {
      // Construct URL from path
      const storagePath = params.path.join('/');
      const storageBucket = 'studio-1988865591-1562f.firebasestorage.app';
      
      console.log('Constructing URL from path:', storagePath);
      // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
      const encodedPath = encodeURIComponent(storagePath);
      storageUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodedPath}?alt=media`;
    } else {
      return NextResponse.json(
        { error: 'Missing url parameter or path' },
        { status: 400 }
      );
    }
    
    console.log('Fetching from Firebase Storage:', storageUrl);
    
    // Fetch the file from Firebase Storage
    const response = await fetch(storageUrl);
    
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

