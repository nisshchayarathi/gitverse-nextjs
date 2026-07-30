export async function GET(request: Request) {
  const host = request.headers.get('host') || 'gitverse-nextjs.vercel.app'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  const body = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /analysis
Disallow: /analyze
Disallow: /repo
Disallow: /search
Disallow: /settings
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  })
}