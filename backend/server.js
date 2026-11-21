import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './config/database.js';
import { seedDevelopmentData } from './database/seed.js';
import { attachAuthUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import quizRoutes from './routes/quiz.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..', 'frontend');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachAuthUser);

  // Initialize SQLite database, run migrations, and apply idempotent seed
  const db = getDb();
  seedDevelopmentData(db);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', quizRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
  });

  // Serve Vanilla HTML/CSS/JS frontend static assets
  app.use('/assets', express.static(path.join(frontendDir, 'assets')));
  app.use(express.static(frontendDir));

  // Clean URL routing to traditional HTML pages
  const sendHtml = (filename) => (_req, res) => {
    res.sendFile(path.join(frontendDir, filename));
  };

  app.get('/', sendHtml('index.html'));
  app.get('/login', sendHtml('login.html'));
  app.get('/register', sendHtml('register.html'));
  app.get('/dashboard', sendHtml('dashboard.html'));
  app.get('/create-quiz', sendHtml('create-quiz.html'));
  app.get('/create-quiz/:id', sendHtml('create-quiz.html'));
  app.get('/quiz/:username', sendHtml('public-quiz.html'));
  app.get('/quiz-result/:submissionId', sendHtml('quiz-result.html'));
  app.get('/leaderboard/:username', sendHtml('leaderboard.html'));
  app.get('/profile', sendHtml('profile.html'));
  app.get('/admin', sendHtml('admin.html'));

  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(404).sendFile(path.join(frontendDir, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Who Knows Me Better? server running on http://0.0.0.0:${port}`);
  });
}