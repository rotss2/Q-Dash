# Q-Dash - Questionnaire Data Analysis Shell

A modern, web-based R&D platform for creating dynamic questionnaires and analyzing respondent data in real-time.

## Features

### Core Platform
- **Cloud-Native Authentication**: Secure user onboarding with Supabase Auth
- **Role-Based Access Control**: Automatic redirection (Admins → Creator Studio, Users → Respondent Portal)
- **Error Boundaries & Loading States**: Graceful error handling with EmptyState, LoadingSkeleton components

### Survey/Quiz/Exam Management
- **Dynamic Form Builder**: Create surveys with Text, Multiple Choice, and Likert Scale questions
- **Multiple Modes**: Survey, Quiz, and Exam modes with different settings
- **Anti-Cheating Measures**: Tab switching detection, copy/paste prevention, fullscreen enforcement
- **Question Bank**: Centralized question management with bulk import via text parser
- **Bulk Import**: Parse questions from formatted text with support for multiple question types

### Student Features
- **Mode-Specific Dashboards**: 
  - Survey Dashboard: Response tracking and completion rates
  - Quiz Dashboard: XP system, badges, leaderboard, topic mastery
  - Exam Dashboard: Serious assessment layout with pass/fail tracking
- **Student Profile Page**: Complete learning progress dashboard with stats, badges, activity history
- **Personalized Review Mode**: Detailed quiz/exam review with explanations and score breakdown

### Live Quiz Battle Mode
- **Real-time Multiplayer**: Host live quiz rooms with students joining via room code
- **Live Leaderboard**: Real-time score updates and rankings during quiz
- **Speed-Based Scoring**: 1000 base points + speed bonus up to 500 points
- **Podium Results**: Visual top 3 podium display at end of quiz
- **Supabase Realtime**: Live updates for participants, answers, and scores

### Analytics & Reporting
- **Smart Analytics Dashboard**: Overview, student performance, and topic analysis
- **Score Trends**: Visual tracking of performance over time
- **Student Leaderboard**: Ranked performance with medals for top performers
- **Topic Performance**: Accuracy rates and time spent per topic
- **Response Management**: Export results to CSV/JSON formats

### Admin Features
- **Admin Command Center**: Modern dashboard with overview cards, activity feed, quick actions
- **Live Activity Feed**: Real-time tracking of platform activities
- **Survey Analytics**: Detailed breakdown of survey responses
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

The database includes core tables:

- **profiles**: User roles and metadata (extends auth.users)
- **surveys**: Survey/quiz/exam titles, descriptions, status, mode, and ownership
- **questions**: Child table defining survey questions with topics and correct answers
- **responses**: Quiz/exam attempt data with scores and time tracking
- **quiz_exam_results**: Detailed scoring results with pass/fail status
- **question_bank**: Centralized question storage for reuse
- **live_rooms**: Live quiz battle rooms with status and settings
- **live_room_participants**: Joined participants with real-time scores
- **activity_logs**: Platform activity tracking

Key features:
- Row-Level Security (RLS) policies for strict data isolation
- PostgreSQL functions for quiz scoring and analytics
- Realtime subscriptions for live quiz battles
- UUID-based identifiers for enhanced security

## Usage

### As an Admin (Researcher)

1. Log in to the Admin Dashboard (`/admin`)
2. Use the **Command Center** for quick overview and actions
3. Create quizzes/exams/surveys in the **Creator Studio**
4. Access the **Question Bank** for centralized question management
5. Launch **Live Quiz Battles** for real-time multiplayer quizzes
6. View detailed **Analytics** on student performance and topic mastery
7. Share generated survey links with respondents

### As a Student (Respondent)

1. Log in to access your personalized **Student Dashboard**
2. Navigate to **Survey**, **Quiz**, or **Exam** dashboards based on content
3. View your **Profile Page** for stats, badges, and progress
4. Join **Live Quiz Battles** using room codes
5. Complete surveys/quizzes/exams via unique links
6. Review past attempts in **Review Mode**
7. Track progress on the **Leaderboard**

## Project Structure

```
src/
├── components/              # Reusable UI components
│   ├── admin/              # Admin-specific components
│   ├── ErrorBoundary.tsx   # Error handling
│   ├── LoadingSkeleton.tsx # Loading states
│   └── EmptyState.tsx      # Empty data states
├── hooks/                  # Custom React hooks
│   ├── useAuth.tsx         # Authentication
│   ├── useToast.tsx        # Notifications
│   ├── useLiveRoom.ts      # Live quiz battle
│   └── useAnalytics.ts     # Analytics data
├── lib/                    # Utilities and clients
│   ├── supabase.ts         # Supabase client
│   ├── database.types.ts   # Generated types
│   └── liveScoring.ts      # Live quiz scoring
├── pages/                  # Route components
│   ├── admin/              # Admin pages
│   │   ├── CommandCenter.tsx
│   │   ├── QuestionBank.tsx
│   │   └── AnalyticsDashboard.tsx
│   ├── student/            # Student pages
│   │   ├── SurveyDashboard.tsx
│   │   ├── QuizDashboard.tsx
│   │   ├── ExamDashboard.tsx
│   │   ├── ReviewMode.tsx
│   │   └── StudentProfilePage.tsx
│   ├── live/               # Live quiz pages
│   │   ├── LiveRoomCreate.tsx
│   │   ├── LiveRoomHost.tsx
│   │   ├── LiveRoomStudent.tsx
│   │   └── JoinLiveRoom.tsx
│   └── user/               # User pages
│       ├── Dashboard.tsx
│       └── SurveyResponse.tsx
├── types/                  # TypeScript definitions
│   ├── index.ts           # Core types
│   ├── live.ts            # Live battle types
│   ├── activity.ts        # Activity feed types
│   ├── analytics.ts       # Analytics types
│   └── profile.ts         # Profile types
├── App.tsx                # Main router
└── main.tsx               # Entry point
└── index.css        # Tailwind styles
```

## Routes

### Public Routes
- `/login` - Authentication page
- `/forbidden` - Access denied page

### Student Routes (Protected)
- `/dashboard` - Main student dashboard
- `/student/surveys` - Survey dashboard
- `/student/quizzes` - Quiz dashboard
- `/student/exams` - Exam dashboard
- `/profile` - Student profile page
- `/review/:surveyId` - Review mode for past attempts
- `/live/join` - Join live quiz room
- `/live/room/:roomCode` - Student live quiz view

### Admin Routes (Protected, Admin Only)
- `/admin` - Command Center dashboard
- `/admin/surveys` - All surveys management
- `/admin/analytics` - Analytics dashboard
- `/admin/question-bank` - Question bank management
- `/live/create` - Create live quiz room
- `/live/host/:roomId` - Host live quiz

### API/Survey Routes
- `/survey/:surveyId` - Public survey response page
- `/survey/:surveyId/results` - Survey results (if enabled)

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
