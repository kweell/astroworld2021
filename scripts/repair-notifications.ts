import { readConfig } from '../src/core/config.js';
import { connectDatabase } from '../src/core/db/client.js';
import { createPlatform } from '../src/integration/index.js';

const db = await connectDatabase(readConfig());
try {
  const count = await createPlatform(db).matching.repairNotifications();
  console.log(
    `Restored ${count} missing topic notifications. Existing bookings, declines and read status were preserved.`,
  );
} finally {
  await db.close();
}
