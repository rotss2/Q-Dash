# Q-Dash - Questionnaire Data Analysis Shell

A modern, web-based R&D platform for creating dynamic questionnaires and analyzing respondent data in real-time.

## Features

- **Cloud-Native Authentication**: Secure user onboarding with Supabase Auth
- **Role-Based Access Control**: Automatic redirection (Admins → Creator Studio, Users → Respondent Portal)
- **Dynamic Form Builder**: Create surveys with Text, Multiple Choice, and Likert Scale questions
- **Live Analytics Dashboard**: Real-time data visualization using Chart.js
- **Response Management**: Export results to CSV/JSON formats
- **URL-Driven Access**: Unique UUID-based survey links
- **Logic-Gated Submissions**: Prevent duplicate responses from the same user

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Charts**: Chart.js + react-chartjs-2
- **Icons**: Lucide React
- **Routing**: React Router v6

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A Supabase account (free tier works fine)

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor and run the schema from `supabase/schema.sql`
3. Run the admin user creation script from `supabase/create_admin_user.sql`
4. Go to Project Settings → API and copy your credentials:
   - Project URL
   - `anon` public API key
   - `service_role` secret key

### 3. Local Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your Supabase credentials and admin login values
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong-password
ADMIN_USER_ID=c6ae1256-0bda-4a98-8fcc-8765446f9d32
SESSION_SECRET=replace-with-a-strong-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Start development server
npm run dev
```

### 4. Database Schema

The database includes 4 main tables:

- **profiles**: User roles and metadata (extends auth.users)
- **surveys**: Survey titles, descriptions, status, and ownership
- **questions**: Child table defining survey questions
- **responses**: Junction table connecting users, surveys, and answers

Key features:
- Row-Level Security (RLS) policies for strict data isolation
- PostgreSQL trigger to auto-increment response counters
- UUID-based identifiers for enhanced security

## Usage

### As an Admin (Researcher)

1. Register with "Researcher" account type
2. Create surveys in the Creator Studio
3. Add questions (Text, Multiple Choice, Likert Scale)
4. Share the generated survey link with respondents
5. View real-time analytics and export data

### As a User (Respondent)

1. Register with "Respondent" account type
2. View available surveys in the Respondent Portal
3. Complete surveys via unique links
4. Cannot submit duplicate responses

## Project Structure

```
src/
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks (auth, toast)
├── lib/             # Supabase client and types
├── pages/           # Route components
│   ├── admin/       # Admin dashboard, builder, analytics
│   └── user/        # User dashboard, survey response
├── types/           # TypeScript type definitions
├── App.tsx          # Main app component
├── main.tsx         # Entry point
└── index.css        # Tailwind styles
```

## Deployment

### Netlify (Recommended)

1. Connect your GitHub repo to Netlify
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables in Site settings

### Vercel

1. Import your GitHub repo
2. Framework preset: Vite
3. Add environment variables

## Security

- Admin routes require a valid server-side admin session before rendering any admin pages
- Admin credentials are validated using environment variables, not stored in the client
- Admin analytics and raw survey data are loaded through protected server endpoints
- Supabase service role key is only used on the server, not in the browser
- Row-Level Security (RLS) ensures users can only access their own data
- Admins can only manage their own surveys
- Users can only INSERT responses, not read others' responses
- UUID-based survey links prevent URL guessing

## License

MIT
