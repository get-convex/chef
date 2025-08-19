import { type LoaderFunctionArgs } from '@vercel/remix';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('img');

  if (!imageUrl) {
    return new Response('Missing img parameter', { status: 400 });
  }

  try {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new Response('Failed to fetch image', { status: imageResponse.status });
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await imageResponse.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
