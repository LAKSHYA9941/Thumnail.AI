# ThumbnailAI Setup Guide

## Fixing the 500 Internal Server Error

The 500 error is occurring because the backend is missing environment variables. Here's how to fix it:

### 1. Create Backend Environment File

Create a `.env` file in the `backend` directory with the following content:

```env
# Database Configuration
MONGO_URI=mongodb://localhost:27017/thumbnailai

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AI Services
OPENROUTER_API_KEY=your-openrouter-api-key

# Server Configuration
PORT=4000
FRONTEND_URL=http://localhost:5173

# Environment
NODE_ENV=development
```

### 2. Get OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. Replace `your-openrouter-api-key` in the `.env` file with your actual API key

### 3. Install Missing Dependencies

Run these commands in the frontend directory:

```bash
cd frontend
npm install @radix-ui/react-scroll-area class-variance-authority
```

### 4. Start the Application

1. Start MongoDB (if not already running):
   ```bash
   mongod
   ```

2. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## New Features Added

### 1. Chat UI Interface
- Conversational interface for generating thumbnails
- Real-time chat with AI assistant
- Message history with generated images
- Enter key to send messages

### 2. Skeleton Loading States
- Loading spinners during image generation
- Skeleton cards while content loads
- Smooth transitions and animations

### 3. Enhanced Image Display
- Download functionality for all generated images
- Copy prompt to clipboard
- Enhanced gallery view with badges
- Better error handling with toast notifications

### 4. Improved Error Handling
- Custom toast notification system
- Better error messages
- Graceful fallbacks when API keys are missing

### 5. Better User Experience
- Chat-based workflow as default
- Improved navigation between tabs
- Better visual feedback for all actions

## Troubleshooting

### If you still get 500 errors:
1. Check that MongoDB is running
2. Verify your OpenRouter API key is correct
3. Make sure all environment variables are set
4. Check the backend console for specific error messages

### If frontend doesn't load:
1. Make sure all dependencies are installed
2. Check that the backend is running on port 4000
3. Verify the frontend is running on port 5173

## API Key Setup

The application uses OpenRouter for AI image generation. You can get a free API key by:

1. Visiting [OpenRouter](https://openrouter.ai/)
2. Creating an account
3. Getting your API key from the dashboard
4. Adding it to the `.env` file

Without a valid API key, the image generation will return a 503 error with a helpful message.
