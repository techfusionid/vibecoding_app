# Vibe - AI-Powered Code Generation Platform

<div align="center">
  <img src="public/logo.svg" alt="Vibe Logo" width="80" height="80">
  <h3>Build something with Vibe</h3>
  <p>Create apps and websites by chatting with AI</p>
</div>

## Overview

Vibe is a modern AI-powered code generation platform that transforms natural language descriptions into fully functional Next.js applications. Simply describe what you want to build, and Vibe's intelligent AI agent will generate complete, production-ready code with live preview capabilities.

## ✨ Key Features

- **AI-Powered Code Generation**: OpenAI GPT-4 powered agent that understands natural language
- **Live Preview**: Instant preview of generated applications in secure E2B sandboxes
- **Pre-Built Templates**: Netflix, YouTube, Airbnb, Spotify clones and more
- **Code Explorer**: Browse and examine generated source code with syntax highlighting
- **Project Management**: Save, organize, and iterate on your projects
- **Authentication**: Secure user management with Clerk
- **Usage Tracking**: Credit-based system with free and pro tiers

## 🚀 Tech Stack

**Frontend**: Next.js 15, TypeScript, Tailwind CSS, Shadcn/UI, React Query
**Backend**: tRPC, PostgreSQL, Prisma ORM, Clerk Auth
**AI & Jobs**: OpenAI GPT-4, Inngest, E2B sandboxes

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key
- E2B API key
- Clerk authentication setup
- Inngest account

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/vibe.git
cd vibe
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
```

Configure the following environment variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/vibe"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# AI Integration
OPENAI_API_KEY=your_openai_api_key

# E2B Sandboxes
E2B_API_KEY=your_e2b_api_key

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

4. **Set up the database**

```bash
npx prisma generate
npx prisma migrate deploy
```

5. **Seed the database (optional)**

```bash
npm run db:seed
```

## 🔥 Development

### Start the development server

```bash
npm run dev
```

### Run background job processing

```bash
npx inngest-cli@latest dev
```

### Development Database Commands

Apply schema changes in development:

```bash
npx prisma migrate dev
```

Open Prisma Studio for database management:

```bash
npx prisma studio
```

Reset database (⚠️ This will delete all data):

```bash
npx prisma migrate reset
```

## 📁 Project Structure

```
vibe/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/            # Reusable UI components
│   ├── modules/              # Feature-based modules
│   ├── lib/                  # Utility functions
│   ├── hooks/                # Custom React hooks
│   ├── inngest/              # Background job functions
│   └── trpc/                 # tRPC router and client setup
├── prisma/                   # Database schema and migrations
├── public/                   # Static assets
└── sandbox-templates/        # E2B sandbox configurations
```

## 🎯 Usage

### Creating Your First Project

1. Sign up/Sign in to your Vibe account
2. Describe your app in the main input field
3. Choose a template or write a custom description
4. Submit and watch the AI generate your application
5. Preview the live result in the embedded sandbox
6. Explore the generated code using the file explorer

### Example Prompts

- "Build a modern todo app with drag-and-drop functionality"
- "Create a social media dashboard with user posts and analytics"
- "Build a restaurant website with menu and online ordering"
- "Create a fitness tracker with workout logging and progress charts"

## 💳 Usage & Billing

**Free Tier**: 2 credits per month
**Pro Tier**: 100 credits per month with priority generation

## 🚀 Deployment

### Vercel (Recommended)

1. **Deploy to Vercel**

```bash
npm run build
vercel --prod
```

2. **Configure environment variables** in Vercel dashboard
3. **Set up database** connection
4. **Configure webhooks** for Inngest

### Docker

```bash
docker build -t vibe .
docker run -p 3000:3000 vibe
```

## 🐛 Troubleshooting

**Database Connection Issues**

- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running

**AI Generation Failures**

- Verify OpenAI API key is valid
- Check API usage limits

**Sandbox Issues**

- Verify E2B API key
- Check sandbox quotas
