import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { clearLocalData } from '../db/db';

afterEach(async () => { await clearLocalData(); });
