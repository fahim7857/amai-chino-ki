import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './backend/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from the project root regardless of Passenger/cPanel cwd
dotenv.config({ path: path.join(__dirname, '.env') });

const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Who Knows Me Better? running on http://0.0.0.0:${port} (base: ${process.env.BASE_PATH || '/bondhu'})`);
});

export default app;
