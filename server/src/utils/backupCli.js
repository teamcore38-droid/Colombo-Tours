import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDB, disconnectDB } from '../config/db.js';
import { exportBackupSnapshot, restoreBackupSnapshot } from './backup.js';

function getTodayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (command !== 'export' && command !== 'restore') {
    console.error(
      'Usage:\n' +
        '  node src/utils/backupCli.js export [output-file.json]\n' +
        '  node src/utils/backupCli.js restore <backup-file.json> [--replace|--merge]'
    );
    process.exit(1);
  }

  try {
    await connectDB();

    if (command === 'export') {
      const targetArg =
        args.find((a) => !a.startsWith('--')) ||
        `colombo-tours-backup-${getTodayStamp()}.json`;
      const outputPath = path.resolve(process.cwd(), targetArg);
      const snapshot = await exportBackupSnapshot({ exportedBy: 'cli' });
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
      console.log(
        `[Backup] Saved snapshot to ${outputPath} (${snapshot.counts.vehicles} vehicles, ${snapshot.counts.categories} categories, ${snapshot.counts.services} services).`
      );
      return;
    }

    const inputArg = args.find((a) => !a.startsWith('--'));
    if (!inputArg) {
      throw new Error('Please provide the path to a Colombo Tours backup JSON file.');
    }
    const mode = args.includes('--replace') ? 'replace' : 'merge';
    const inputPath = path.resolve(process.cwd(), inputArg);
    const rawText = await fs.readFile(inputPath, 'utf8');
    const parsed = JSON.parse(rawText);
    const result = await restoreBackupSnapshot(parsed, { mode });
    console.log(
      `[Restore] Completed (${result.mode}) from ${inputPath}: ${result.restored.vehicles} vehicles, ${result.restored.categories} categories, ${result.restored.services} services.`
    );
  } catch (error) {
    console.error(`[Backup CLI] Failed:`, error.message || error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
