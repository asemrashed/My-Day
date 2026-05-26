Build a full-stack productivity and expense management web application called "MyDay".

## TECH STACK
- Framework: Next.js 14 (App Router)
- Auth: NextAuth.js v5 (Credentials + Google OAuth)
- Database: MongoDB Atlas + Prisma ORM
- Styling: Tailwind CSS + shadcn/ui
- Notifications: Browser Web Notifications API + react-hot-toast
- Deployment: Vercel
- Language: TypeScript

## PRISMA + MONGODB SETUP
- Use provider = "mongodb" in schema.prisma
- All IDs: @id @default(auto()) @map("_id") @db.ObjectId
- Run: npx prisma db push (no migrations needed for MongoDB)
- Install: npm install next-auth @prisma/client @auth/prisma-adapter prisma --save-dev

## DATABASE SCHEMA (Prisma)
models:
- User: id, name, email, image, passwordHash, createdAt
- Task: id, userId, title, description, dueDate, priority (HIGH/MEDIUM/LOW), category, status (PENDING/IN_PROGRESS/DONE), isRecurring, recurringDays[], order, createdAt
- Event: id, userId, title, startAt, endAt, colorLabel, createdAt
- Transaction: id, userId, type (INCOME/EXPENSE), amount, category, note, date, createdAt
- Notification: id, userId, message, isRead, createdAt

## FEATURES

### Auth & Multi-User
- Register/Login with email+password (bcrypt for hashing)
- Google OAuth login
- Protected routes via NextAuth middleware
- Each user sees only their own data

### Dashboard (Home Page)
- Greeting: "Good morning/afternoon/evening, [Name]"
- Today's date in both English and Bengali
- Today's task summary card (X done / Y total)
- Current balance snapshot card (in ৳ BDT)
- Quick-add floating button for task or expense
- Recent activity feed (last 5 tasks + transactions)

### Task Manager
- Create, edit, delete tasks with: title, description, due date/time, priority, category, status
- Daily recurring tasks support
- Filter by: Today / This Week / Priority / Status
- Mark complete with checkbox
- Drag-and-drop reorder using @dnd-kit/core

### Schedule / Calendar
- Weekly and monthly calendar view
- Add events with title, start/end time, color label
- Upcoming tasks sidebar (next 5 due)

### Notifications & Alerts
- Request browser notification permission on first login
- Toast alert when a task is due within 30 minutes
- Daily summary notification at 8:00 AM
- In-app notification bell icon with unread count badge

### Expense Tracker
- Dashboard shows: Current Balance (৳), Total Income, Total Expenses, Savings %
- Add Income: Salary, Freelance, Side Project, Other
- Add Expense with these categories (Bangladeshi developer context):
  🚌 Transport (Rickshaw, Bus, Pathao, CNG, Uber)
  🍛 Food (Meal, Tea/Snacks, Restaurant)
  🌐 Internet (Broadband, Mobile Data)
  🤖 AI Tools (ChatGPT, Claude, Copilot, etc.)
  ☁️ Dev Tools & Subscriptions (domains, hosting, software)
  📱 Mobile Recharge
  🏠 Rent & Utilities (electricity, gas, water)
  👨‍👩‍👧 Family Support
  🏥 Healthcare
  📚 Learning (Udemy, courses, books)
  💸 Miscellaneous
- All amounts in BDT (৳)
- Monthly bar chart (recharts): Income vs Expenses
- Category pie chart for expense breakdown
- Transaction history table with search + filter by date/category
- Edit and delete any transaction

## FILE STRUCTURE
app/
  (auth)/login/page.tsx
  (auth)/register/page.tsx
  (dashboard)/layout.tsx       ← sidebar on desktop, bottom nav on mobile
  (dashboard)/page.tsx         ← home dashboard
  (dashboard)/tasks/page.tsx
  (dashboard)/schedule/page.tsx
  (dashboard)/expenses/page.tsx
  (dashboard)/profile/page.tsx
  api/auth/[...nextauth]/route.ts
  api/tasks/route.ts
  api/events/route.ts
  api/transactions/route.ts
  api/notifications/route.ts
components/
  TaskCard.tsx
  ExpenseForm.tsx
  BalanceWidget.tsx
  CalendarView.tsx
  NotificationBell.tsx
  Charts/BarChart.tsx
  Charts/PieChart.tsx
lib/
  prisma.ts
  auth.ts
  utils.ts
prisma/
  schema.prisma

## DESIGN REQUIREMENTS
- Mobile-first responsive (works on 375px and up)
- Bottom navigation on mobile: Home, Tasks, Schedule, Expenses, Profile
- Sidebar navigation on desktop
- Dark/light mode toggle (default: system preference)
- Primary accent: Green (#10B981) for income/positive, Red (#EF4444) for expenses
- shadcn/ui components throughout
- Loading skeletons on all data-fetching pages
- Empty states with friendly inline SVG illustrations

## ENV VARIABLES
Create a .env.example file with:
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

## ADDITIONAL
- Use Next.js server actions for all form submissions
- Validate session in every API route before responding
- Seed script: prisma/seed.ts with 1 demo user + sample tasks + transactions
- README.md with: setup steps, MongoDB Atlas setup guide, env config, Vercel deploy instructions
- Proper error handling and loading states everywhere
- Accessibility: aria labels, keyboard navigation, focus rings