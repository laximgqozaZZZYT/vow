# Vow - Personal Goal & Habit Tracking Application

A secure, modern web application for tracking personal goals, habits, and activities with integrated diary functionality.

## 🔒 Security Features

### Authentication
- **Supabase JWT Authentication** - Industry-standard JWT with signature verification
- **OAuth Integration** - Google and GitHub login support
- **Session Management** - Secure HTTP-only cookies with CSRF protection
- **Input Sanitization** - XSS protection with DOMPurify

### Security Measures
- **Rate Limiting** - Protection against brute force attacks
- **CORS Protection** - Strict origin validation
- **Security Headers** - Helmet.js with CSP, HSTS, and more
- **No X-User-Id Authentication** - Removed insecure development authentication

### Security Testing
```bash
# Run all security tests
npm run security-full

# Individual tests
npm run security-test      # Basic security validation
npm run penetration-test   # Advanced security testing
```

## 🚀 Quick Start

### 🌐 WEBサービスとして公開（推奨）

最短5分でWEBサービスとして公開できます：

```bash
# 1. セットアップスクリプト実行
./scripts/quick-deploy.sh

# 2. デプロイガイドに従って外部サービス設定
cat docs/deployment-guide.md
```

**推奨構成**:
- **フロントエンド**: Vercel（無料）
- **バックエンド**: Railway（$5/月）
- **データベース**: Railway PostgreSQL（無料枠）
- **認証**: Supabase（無料枠）

### 💻 ローカル開発

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (または MySQL 8.0+)
- Supabase account

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure your environment variables
npm run build
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configure your Supabase credentials
npm run dev
```

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/vowdb"

# Supabase JWT (REQUIRED)
SUPABASE_JWKS_URL="https://your-project.supabase.co/.well-known/jwks.json"
SUPABASE_JWT_AUD="authenticated"
SUPABASE_JWT_ISS="https://your-project.supabase.co/auth/v1"

# Security
NODE_ENV=development
VOW_COOKIE_SECURE=false  # Set to true in production
CORS_ORIGINS="http://localhost:3000"
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📁 Project Structure

```
vow/
├── backend/          # Express.js API server
│   ├── src/         # TypeScript source code
│   ├── prisma/      # Database schema and migrations
│   └── dist/        # Compiled JavaScript
├── frontend/         # Next.js React application
│   ├── app/         # App Router pages
│   ├── lib/         # Utilities and API client
│   └── public/      # Static assets
├── docs/            # Documentation
├── scripts/         # Security testing scripts
└── infra/           # AWS CloudFormation templates
```

## 🛡️ Security Documentation

- [Security Guide](docs/security.md) - Comprehensive security overview
- [Deployment Security Checklist](docs/deployment-security-checklist.md) - Pre-deployment validation

## 🧪 Testing

### Security Tests
- **Basic Security**: Authentication, CORS, XSS, SQL injection protection
- **Penetration Testing**: Advanced attack simulation and vulnerability assessment
- **Rate Limiting**: Brute force protection validation

### Running Tests
```bash
# Security validation
npm run security-test

# Advanced penetration testing
npm run penetration-test

# Complete security suite
npm run security-full
```

## 🚀 Deployment

### 🌐 Production Deployment (Recommended)

**Quick Deploy (5 minutes)**:
```bash
./scripts/quick-deploy.sh
```

**Manual Setup**:
1. **Supabase**: Create project → Configure OAuth
2. **Railway**: Deploy backend → Add PostgreSQL → Set environment variables
3. **Vercel**: Deploy frontend → Set environment variables
4. **Update URLs**: Configure CORS and redirect URLs

📖 **Full Guide**: [docs/deployment-guide.md](docs/deployment-guide.md)

### 📚 デプロイメント関連ドキュメント
- **[デプロイガイド](docs/deployment-guide.md)** - 詳細な設定手順
- **[トラブルシューティング](docs/troubleshooting.md)** - よくある問題と解決方法  
- **[デプロイチェックリスト](docs/deployment-checklist.md)** - 設定確認用チェックリスト
- **[セキュリティガイド](docs/security.md)** - セキュリティ対策の詳細

### 💰 Cost Estimate
- **Free Tier**: $5/month (Railway only)
- **Production**: $65/month (all services paid plans)

### 🔧 Local Development

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Enable `VOW_COOKIE_SECURE=true`
- [ ] Configure production CORS origins
- [ ] Set up HTTPS certificates
- [ ] Run security tests
- [ ] Configure monitoring and alerts

### AWS Deployment (Alternative)
```bash
cd infra
# Configure your parameters
sam deploy --guided
```

## 📊 Features

### Core Functionality
- **Goal Management** - Hierarchical goal organization
- **Habit Tracking** - Daily habit monitoring with streaks
- **Activity Logging** - Time-based activity tracking
- **Diary Integration** - Personal journaling with tagging
- **Dashboard** - Comprehensive overview and analytics

### Technical Features
- **Responsive Design** - Mobile-first UI with Tailwind CSS
- **Real-time Updates** - Live data synchronization
- **Offline Support** - Progressive Web App capabilities
- **Data Export** - JSON/CSV export functionality

## 🔧 Development

### Database Migrations
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Code Quality
```bash
# TypeScript compilation
npm run build

# Security validation
npm run security-full
```

## 📈 Monitoring

### Security Monitoring
- Authentication failure rates
- Rate limit violations
- CORS policy violations
- Unusual access patterns

### Performance Monitoring
- API response times
- Database query performance
- Frontend load times
- Error rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run security tests: `npm run security-full`
4. Submit a pull request

### Security Guidelines
- Never commit secrets or API keys
- Run security tests before submitting PRs
- Follow secure coding practices
- Report security issues privately

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Security Issues**: Report privately to security@yourcompany.com
- **General Issues**: Use GitHub Issues
- **Questions**: Use GitHub Discussions

---

**Security Status**: ✅ Production Ready  
**Last Security Review**: January 3, 2026  
**Test Coverage**: 100% security tests passing