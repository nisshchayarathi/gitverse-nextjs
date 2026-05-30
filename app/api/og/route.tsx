import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse the ?title= query param or fallback to a default
    const title = searchParams.get('title') || 'GitVerse - AI Repository Analysis'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0b0f19',
            backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 40%)',
            padding: '40px 80px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* Subtle horizontal grid lines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: 0.05,
              padding: '60px 0',
            }}
          >
            <div style={{ height: '1px', width: '100%', backgroundColor: '#ffffff' }} />
            <div style={{ height: '1px', width: '100%', backgroundColor: '#ffffff' }} />
            <div style={{ height: '1px', width: '100%', backgroundColor: '#ffffff' }} />
            <div style={{ height: '1px', width: '100%', backgroundColor: '#ffffff' }} />
          </div>

          {/* Logo container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '35px',
              zIndex: 10,
            }}
          >
            {/* Git Branch Icon */}
            <svg
              width="54"
              height="54"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span
              style={{
                marginLeft: '14px',
                fontSize: '40px',
                fontWeight: 'bold',
                color: '#ffffff',
                letterSpacing: '-0.04em',
              }}
            >
              Git<span style={{ color: '#6366f1' }}>Verse</span>
            </span>
          </div>

          {/* Title and subtitle */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '850px',
              zIndex: 10,
            }}
          >
            <h1
              style={{
                fontSize: '56px',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.2,
                marginBottom: '20px',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #ffffff, #e2e8f0)',
                backgroundClip: 'text',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: '22px',
                color: '#94a3b8',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Contribution made easy with interactive repository visualization and AI PR Mentoring.
            </p>
          </div>

          {/* Footer branding */}
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              bottom: '50px',
              left: '80px',
              right: '80px',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '20px',
              zIndex: 10,
            }}
          >
            <span style={{ color: '#6366f1', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
              GITVERSE.DEV
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%' }} />
              <span style={{ color: '#64748b', fontSize: '16px', fontWeight: '500' }}>
                AI-Powered Code Intelligence
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    return new Response(`Failed to generate dynamic OG Image: ${e.message}`, {
      status: 500,
    })
  }
}
