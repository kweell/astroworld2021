import { readConfig } from '../config.js';
import { connectDatabase } from '../db/client.js';
import { demoAuth } from '../auth/demo-auth.js';
import { supabaseAuth } from '../auth/auth-adapter.js';
import {
  createPlatform,
  registerMatchingRoutes,
} from '../../integration/index.js';
import { createApp } from './app.js';
const config = readConfig();
const db = await connectDatabase(config);
const auth = config.DEMO_AUTH_MODE
  ? demoAuth(db, true, config.NODE_ENV)
  : supabaseAuth(db, config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!);
const { core, matching } = createPlatform(db);
const app = createApp(core, auth, (api) =>
  registerMatchingRoutes(api, matching),
);
app.addHook('onClose', async () => db.close());
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void app.close();
  });
try {
  await db.list('users');
  await app.listen({ host: config.HOST, port: config.PORT });
  console.log(
    `Micro-Access API listening on http://${config.HOST}:${config.PORT} (${config.DATABASE_MODE}, ${config.DEMO_AUTH_MODE ? 'demo identity headers' : 'Supabase bearer auth'})`,
  );
} catch {
  console.error(
    'API startup failed. Check database configuration and run npm run db:migrate.',
  );
  await app.close();
  process.exitCode = 1;
}
