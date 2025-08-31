# 🎨 ThumbnailAI - AI-Powered YouTube Thumbnail Generator

A modern, full-stack application that generates stunning YouTube thumbnails using AI. Built with React, TypeScript, Node.js, and powered by Google's Gemini AI and OpenRouter for query enhancement.

## ✨ Features

### 🚀 Core Functionality
- **AI-Powered Generation**: Create thumbnails using Google's Gemini 2.5 Flash Image Preview
- **Smart Query Rewriting**: Enhance prompts using OpenRouter's GPT-4o-mini model
- **Image Upload & Reference**: Upload reference images to guide AI generation
- **High-Quality Downloads**: Download thumbnails in high resolution
- **User Authentication**: Secure login/registration with JWT tokens
- **Google OAuth**: Sign in with Google (ready for integration)

### 🎯 User Experience
- **Beautiful Landing Page**: Stunning, animated landing page with modern design
- **Responsive Dashboard**: Clean, intuitive interface with tabbed navigation
- **Real-time Generation**: Live thumbnail generation with progress indicators
- **Gallery Management**: Organize and manage all generated thumbnails
- **History Tracking**: Complete generation history with metadata

### 🛠️ Technical Features
- **Modern Tech Stack**: React 19, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend API**: Express.js with MongoDB and JWT authentication
- **File Management**: Automatic file organization and cleanup
- **Error Handling**: Comprehensive error handling and user feedback
- **Performance**: Optimized image processing and caching

## 🏗️ Architecture

```
thumbnailcreator/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/    # Business logic
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API endpoints
│   │   ├── middlewares/    # Authentication & validation
│   │   └── config/         # Configuration files
│   └── generated/          # Generated thumbnails
├── frontend/               # React + TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Main application pages
│   │   └── lib/            # Utilities and helpers
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Google Gemini API key
- OpenRouter API key (for query enhancement)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd thumbnailcreator
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure environment variables
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Start development server
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- API Health Check: http://localhost:4000/health

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
MONGO_URI=mongodb://localhost:27017/thumbnailai

# Authentication
JWT_SECRET=your-super-secret-jwt-key

# AI Services
GEMINI_API_KEY=your-google-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Server
PORT=4000
FRONTEND_URL=http://localhost:5173
```

## 📱 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/auth/profile` - Get user profile

### Thumbnail Generation
- `POST /api/generate/rewrite-query` - Enhance prompts with AI
- `POST /api/generate/images` - Generate thumbnails
- `GET /api/generate/thumbnails` - Get user's thumbnails
- `DELETE /api/generate/thumbnails/:id` - Delete thumbnail

## 🎨 UI Components

The application uses Shadcn/ui components with a custom design system:

- **Modern Design**: Clean, professional interface with purple/pink gradient theme
- **Responsive Layout**: Mobile-first design that works on all devices
- **Smooth Animations**: Framer Motion animations for enhanced user experience
- **Accessibility**: WCAG compliant with proper ARIA labels and keyboard navigation

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password encryption
- **Input Validation**: Comprehensive input sanitization and validation
- **CORS Protection**: Configured CORS for secure cross-origin requests
- **Rate Limiting**: API rate limiting (can be added)

## 🚀 Deployment

### Backend Deployment
```bash
cd backend
npm run build
npm start
```

### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting service
```

### Environment Setup
- Set production environment variables
- Configure MongoDB connection for production
- Set up proper CORS origins
- Configure static file serving

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI** for image generation capabilities
- **OpenRouter** for AI-powered query enhancement
- **Shadcn/ui** for beautiful, accessible components
- **Framer Motion** for smooth animations
- **Tailwind CSS** for utility-first styling

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Built with ❤️ for content creators everywhere**
