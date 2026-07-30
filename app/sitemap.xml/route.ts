export async function GET(request: Request) {
  const forwardedProtoRaw = request.headers.get('x-forwarded-proto') || ''
  const forwardedHostRaw = request.headers.get('x-forwarded-host') || ''
  const hostRaw = request.headers.get('host') || ''

  const forwardedProto = forwardedProtoRaw.split(',')[0].trim()
  const protocol = forwardedProto || (process.env.NODE_ENV === 'development' ? 'http' : 'https')
  const host = forwardedHostRaw.split(',')[0].trim() || hostRaw || 'gitverse-nextjs.vercel.app'
  const baseUrl = `${protocol}://${host}`

  // IMPORTANT: Update this list when adding new public pages
  // Exclude authenticated routes (those are in robots.txt disallow list)
  const routes = ['', '/contribute', '/login', '/signup']

  const urls = routes
    .map(
      (route) => `
  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  })
}