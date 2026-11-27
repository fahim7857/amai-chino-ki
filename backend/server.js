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

export const BASE_PATH = (process.env.BASE_PATH || '/bondhu').replace(/\/+$/, '') || '/bondhu';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(attachAuthUser);

  // Initialize SQLite database, run migrations, and apply idempotent seed
  const db = getDb();
  seedDevelopmentData(db);

  const router = express.Router();

  router.get('/api/health', (_req, res) => {
    res.json({ ok: true, basePath: BASE_PATH });
  });

  router.use('/api/auth', authRoutes);
  router.use('/api', adminRoutes);
  router.use('/api', quizRoutes);
  router.use('/api', publicRoutes);

  router.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
  });

  // Serve Vanilla HTML/CSS/JS frontend static assets
  router.use('/assets', express.static(path.join(frontendDir, 'assets')));
  router.use(express.static(frontendDir));

  // Clean URL routing to traditional HTML pages
  const sendHtml = (filename) => (_req, res) => {
    res.sendFile(path.join(frontendDir, filename));
  };

  // Main homepage serves frontend/index.html directly (no redirect to /dashboard)
  router.get('/', sendHtml('index.html'));
  router.get('/dashboard', sendHtml('dashboard.html'));
  router.get('/quiz', sendHtml('create-quiz.html'));
  router.get('/create-quiz', sendHtml('create-quiz.html'));
  router.get('/create-quiz/:id', sendHtml('create-quiz.html'));
  router.get('/profile', sendHtml('profile.html'));
  router.get('/leaderboard', sendHtml('leaderboard.html'));
  router.get('/leaderboard/:username', sendHtml('leaderboard.html'));

  // Auth pages
  router.get('/login', sendHtml('login.html'));
  router.get('/register', sendHtml('register.html'));

  // Taking an exam & viewing result
  router.get('/quiz/:username', sendHtml('public-quiz.html'));
  router.get('/quiz-result/:submissionId', sendHtml('quiz-result.html'));
  router.get('/admin', sendHtml('admin.html'));

  router.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
      return;
    }
    res.redirect(`${BASE_PATH}/`);
  });

  // Mount under BASE_PATH (/bondhu) AND at root '/' (for cPanel Passenger when PassengerBaseURI strips /bondhu)
  app.use(BASE_PATH, router);
  app.use('/', router);

  app.use(errorHandler);

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Who Knows Me Better? server running on http://0.0.0.0:${port}${BASE_PATH}`);
  });
}
