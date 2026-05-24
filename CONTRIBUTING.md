# Contributing to GitVerse Next.js

Thank you for your interest in contributing to **GitVerse Next.js**! GitVerse is an AI-powered repository analyzer and assistant. We want to make contributing to this project as easy and transparent as possible. 

By following these guidelines, you help keep the codebase clean, stable, and maintainable for everyone.

---

## Code of Conduct

We expect all contributors to adhere to a professional, respectful, and inclusive environment. Please be supportive, patient, and constructive in all communication and code reviews.

---

## Branching Conventions

We use a structured branch naming convention. Before you start writing code, make sure to create a branch from the `main` branch named according to the type of work you are doing:

| Branch Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feature/` | New features, enhancements, or additions | `feature/ai-chat-history` |
| `bugfix/` | Fixing a bug or unexpected behavior | `bugfix/login-error-toast` |
| `refactor/` | Code structure changes with no new features/fixes | `refactor/api-response-types` |
| `docs/` | Updates or additions to documentation | `docs/contributing-guide` |
| `chore/` | Maintenance tasks, library upgrades, configuration changes | `chore/upgrade-prisma` |

---

## Local Development Setup

To set up GitVerse Next.js locally, follow these steps:

### 1. Prerequisites
Ensure you have the following installed on your system:
- **Node.js**: Version 18 or newer (version 22.x recommended)
- **Git**: For version control
- **PostgreSQL**: Local instance or a remote database (Neon DB recommended)

### 2. Fork & Clone
Fork the repository on GitHub, then clone your fork locally:
```bash
git clone https://github.com/SatyamPandey-07/gitverse-nextjs.git
cd gitverse-nextjs
```

### 3. Install Dependencies
Install all required package dependencies:
```bash
npm install
```

### 4. Configure Environment Variables
Create a local environment file by copying the example template:
```bash
cp .env.example .env.local
```
Edit `.env.local` and configure your credentials:
- **`DATABASE_URL`**: Your PostgreSQL connection string.
- **`JWT_SECRET`**: A secure, random string used for local JWT sessions.
- **`GEMINI_API_KEY`**: Obtain this from Google MakerSuite to enable AI Assistant features.
- **`NEXTAUTH_SECRET`** and **`NEXTAUTH_URL`**: For session authentication.

> [!IMPORTANT]
> Always copy `.env.local` to `.env` as well so that the Prisma CLI can read your database connection:
> ```bash
> cp .env.local .env
> ```

### 5. Generate and Migrate Database
Initialize your database and generate the Prisma Client:
```bash
# Generate the type-safe Prisma client
npm run prisma:generate

# Apply migrations to your database
npm run prisma:migrate
```

### 6. Run the Application
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application in action.

---

## Commit Message Guidelines

We enforce a professional commit message style based on the **Conventional Commits** standard. This structure makes our project git history clean, readable, and easy to parse automatically.

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types
- **`feat`**: A new feature or enhancement
- **`fix`**: A bug fix
- **`docs`**: Documentation changes only
- **`style`**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **`refactor`**: A code change that neither fixes a bug nor adds a feature
- **`perf`**: A code change that improves performance
- **`test`**: Adding missing tests or correcting existing tests
- **`chore`**: Changes to the build process or auxiliary tools and libraries

### Example Commits
* **New feature**: `feat(ai): add history logs to repository chatbot dashboard`
* **Bugfix**: `fix(auth): redirect user to login on token expiration`
* **Documentation**: `docs(readme): update environment setup instructions`

---

## Pre-submission Checklist

Before pushing your changes and opening a Pull Request, please ensure you perform the following checks locally:

### 1. Code Formatting
Format your code using Prettier:
```bash
npm run format
```

### 2. Linting
Verify there are no syntax or pattern warnings from ESLint:
```bash
npm run lint
```

### 3. Type Checking
Make sure your TypeScript changes compile successfully:
```bash
npm run typecheck
```

---

## Submitting a Pull Request (PR)

1. **Commit and Push**: Commit your changes using a Conventional Commit message, and push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Open a PR**: Go to the GitHub repository and click "Compare & pull request".
3. **Describe Your Changes**:
   - Provide a clear explanation of *what* you changed and *why*.
   - Link any related issues using `Fixes #<issue-number>`.
4. **Await Review**: Core maintainers will review your changes, offer feedback, and merge once all criteria are met.

Thank you again for contributing and helping make GitVerse Next.js awesome! 🚀
