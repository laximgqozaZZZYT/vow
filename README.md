# Vow App

A personal productivity application built with Next.js and Supabase, featuring goal tracking, habit management, and diary functionality.

## 🚀 Tech Stack

- **Frontend**: Next.js 16.1.1, React 19, TypeScript
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (Frontend) + Supabase (Backend)
- **CI/CD**: GitHub Actions

## 📋 Features

- 🎯 Goal tracking and management
- 📅 Habit tracking with calendar integration
- 📝 Activity logging
- 📖 Digital diary with markdown support
- 🔐 OAuth authentication (Google/GitHub)
- 📱 Responsive design
- 🔒 Row-level security for data isolation

## 🛠️ Development Setup

### Prerequisites

- Node.js 20.x or later
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vow-app
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open http://localhost:3000 in your browser

### Environment Variables

Create a `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_STATIC_EXPORT=false
```

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Fork/Clone this repository**

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Set Root Directory to `frontend`

3. **Configure Environment Variables**
   - Add all environment variables from `.env.local`
   - Set `NEXT_STATIC_EXPORT=false` for Vercel deployment

4. **Deploy**
   - Vercel will automatically deploy on push to main branch
   - Or use GitHub Actions for CI/CD control

### Supabase Static Hosting (Alternative)

1. **Build for static export**
   ```bash
   cd frontend
   npm run build:static
   ```

2. **Deploy to Supabase Storage**
   ```bash
   supabase storage cp -r out/* supabase://website/
   ```

## 🔧 CI/CD Pipeline

The project uses GitHub Actions for automated testing and deployment:

- **Testing**: Runs on every push and PR
- **Deployment**: Deploys to Vercel on push to main branch
- **Security**: Automated security tests with Supabase integration

### GitHub Secrets Required

For CI/CD deployment, add these secrets to your GitHub repository:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_ORG_ID
```

## 📁 Project Structure

```
├── frontend/                 # Next.js application
│   ├── app/                 # App Router pages
│   ├── lib/                 # Utilities and configurations
│   ├── public/              # Static assets
│   └── package.json
├── docs/                    # Documentation
├── scripts/                 # Build and deployment scripts
├── .github/workflows/       # GitHub Actions
└── vercel.json             # Vercel configuration
```

## 🔒 Security

- Row Level Security (RLS) enabled on all database tables
- OAuth authentication with Google and GitHub
- HTTPS enforced in production
- Security headers configured
- Environment variables encrypted

## 📖 Documentation

- [Deployment Guide](docs/deployment-guide.md)
- [Vercel Setup Guide](docs/vercel-setup-guide.md)
- [API Documentation](docs/api.md)
- [Security Guide](docs/security.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [troubleshooting guide](docs/troubleshooting.md)
2. Search existing [GitHub issues](https://github.com/your-username/vow-app/issues)
3. Create a new issue with detailed information

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics and insights
- [ ] Team collaboration features
- [ ] API integrations (calendar, fitness trackers)
- [ ] Offline support with sync