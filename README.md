# GitVerse

Turn any GitHub repo into an interactive map of its architecture, modules, and risks.

GitVerse is built for the moment you open a new codebase and ask: “Where do I start?”

## Pitch

### Problem

Open-source and internal repos are hard to contribute to because context is scattered across folders, commits, and tribal knowledge.

### Why now

Repos are larger, teams are more distributed, and AI can finally summarize + connect the dots fast enough to change the contributor experience.

### Solution

Paste a repo → GitVerse builds a visual map + AI onboarding so contributors can understand architecture and pick a starting point in minutes.

### Impact

- Faster onboarding for new contributors
- Clearer ownership and hotspots
- Better PR quality (less back-and-forth)

## “Repo-to-Map in 10 seconds” (MVP flow)

1. Paste a GitHub URL
2. GitVerse generates:
   - Architecture / module map (visual)
   - Modules + dependencies
   - Top risks / hotspots
   - 3 concrete improvement suggestions
3. Click a module → ask AI: “What does this do?” “Where should I start contributing?”

## What you can do today

- Visualize repository structure and key paths
- Explore commits/branches and contributor activity
- Ask AI questions about files, folders, and architecture
- Generate analysis jobs and track progress

## Quickstart (local dev)

```bash
npm install
cp .env.example .env.local
cp .env.local .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open http://localhost:3000

## Contribution-first onboarding (the hackathon angle)

GitVerse is designed to make contributing to unfamiliar repos easier:

- “How do I run this project?”
- “Where is auth?”
- “Explain this folder like I’m new.”
- “Give me 3 beginner-friendly issues.”

That’s the MVP: turn repo complexity into a contributor roadmap.

## Tech stack

- Next.js 14 (App Router), React, TypeScript, Tailwind
- Prisma + Postgres (Neon)
- Gemini for AI analysis
- D3/Recharts for visualizations
- Auth: NextAuth (Google) + credentials

## 🏗️ Project Structure

```
gitverse-nextjs/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── repositories/    # Repository management
│   │   ├── ai/              # AI-powered features
│   │   ├── users/           # User management
│   │   └── integrations/    # Git platform integrations
│   ├── (pages)/             # Page routes
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── src/
│   ├── components/          # React components
│   │   ├── ai/              # AI components
│   │   ├── auth/            # Authentication components
│   │   ├── layout/          # Layout components
│   │   ├── repository/      # Repository components
│   │   ├── ui/              # Reusable UI components
│   │   └── visualizations/  # Data visualization components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   ├── services/            # API service functions
│   └── utils/               # Utility functions
├── lib/
│   ├── services/            # Backend services
│   │   ├── gitService.ts    # Git operations
│   │   ├── geminiService.ts # AI integration
│   │   └── repositoryService.ts # Repository logic
│   ├── prisma.ts            # Prisma client
│   ├── auth.ts              # Authentication utilities
│   └── middleware.ts        # Auth middleware
├── prisma/
│   └── schema.prisma        # Database schema
├── public/                  # Static assets
└── package.json             # Dependencies
```

## 🎨 Design System

### Color Palette

- **Primary:** Deep Blue (#1E3A8A) - Professional and trustworthy
- **Secondary:** Slate Gray (#475569) - Neutral and sophisticated
- **Accent:** Electric Green (#10B981) - Active elements and success states
- **Supporting:** Orange (#F59E0B) for warnings, Red (#EF4444) for errors

### Typography

- **Headings:** Inter
- **Body:** Source Sans 3
- **Code:** JetBrains Mono

## 🧩 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run Next.js linter
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## 🔧 API Routes

All API routes are available under `/api`:

- `/api/auth/*` - Authentication (login, signup, logout, me)
- `/api/repositories` - Repository CRUD operations
- `/api/repositories/[id]` - Specific repository operations
- `/api/repositories/[id]/stats` - Repository statistics
- `/api/repositories/[id]/analyze` - Trigger repository analysis
- `/api/ai/analyze-repository` - AI repository analysis
- `/api/ai/analyze-code` - AI code analysis
- `/api/ai/chat` - AI chat interface
- `/api/users/profile` - User profile management
- `/api/integrations/*` - Git platform integrations

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Docker

```bash
docker build -t gitverse-nextjs .
docker run -p 3000:3000 gitverse-nextjs
```

### Firebase App Hosting (Cloud Run)

This repo includes App Hosting config in `apphosting.yaml`.

1. Create Secret Manager entries (names must match `apphosting.yaml`):

```bash
firebase apphosting:secrets:set webapp-firebase-api-key
firebase apphosting:secrets:set gemini-api-key
firebase apphosting:secrets:set database-url
firebase apphosting:secrets:set jwt-secret

firebase apphosting:secrets:set nextauth-url
firebase apphosting:secrets:set nextauth-secret
firebase apphosting:secrets:set google-client-id
firebase apphosting:secrets:set google-client-secret
```

2. Deploy:

```bash
firebase deploy
```

3. In Google Cloud Console (OAuth client), add redirect URI:

- `https://<your-domain>/api/auth/callback/google`

## 📝 Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret key
- `GEMINI_API_KEY` - Google Gemini API key

OAuth (Google / NextAuth):

- `NEXTAUTH_URL` - Deployed base URL (e.g. `https://<your-domain>`)
- `NEXTAUTH_SECRET` - Session/JWT signing secret (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client id
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

Optional:

- `NEXT_PUBLIC_API_URL` - API URL for client-side (defaults to current domain)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting solutions
- Google for Gemini AI
- NeonDB for serverless PostgreSQL
- All contributors and users of GitVerse

---

Made with ❤️ by the GitVerse Team
