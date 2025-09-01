import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import generateRoutes from './routes/generate.routes.js';
import path from 'path';
import authRoutes from './routes/auth.routes.js';
import mongoose from "mongoose";
import { seedOneUser } from "./seed.js";
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from 'express';


dotenv.config();
const app = express();

// ✅ Fix CORS - Allow methods, headers, handle preflight
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://thumnail-ai.vercel.app',
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.options("*", cors()); // handle preflight globally

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));



// Static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/generated', express.static(path.join(__dirname, '../generated')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ Log incoming requests (helps debug 404)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api', generateRoutes);
app.use('/api', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Thumbnail Creator API');
});

// Error handling
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    await seedOneUser();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
