import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import {
  clearRateLimit,
  hashRateLimitIdentifier,
} from '../middleware/rateLimit.js';
import { AdminUser } from '../models/AdminUser.js';
import {
  generateStrongPassword,
  hashPassword,
  validateNewPassword,
} from './password.js';

/**
 * Programmatic & CLI helper to reset (or optionally create) an admin password.
 * Automatically bumps tokenVersion to revoke all active sessions and clears login lockouts.
 */
export async function resetAdminPassword({
  email = '',
  newPassword = '',
  name = env.adminName || 'Colombo Tours Staff',
  createIfMissing = false,
} = {}) {
  let targetEmail = String(email || '')
    .trim()
    .toLowerCase();

  let admin = targetEmail ? await AdminUser.findOne({ email: targetEmail }) : null;

  if (!targetEmail) {
    const existingAdmins = await AdminUser.find().limit(2);
    if (existingAdmins.length === 1) {
      admin = existingAdmins[0];
      targetEmail = admin.email;
    } else if (existingAdmins.length === 0) {
      targetEmail = env.adminEmail;
    } else {
      throw new Error(
        'Multiple admin accounts exist. Specify --email=<admin-email> (or RESET_ADMIN_EMAIL).'
      );
    }
  }

  const check = validateNewPassword(newPassword, { email: targetEmail });
  if (!check.valid) {
    throw new Error(check.error);
  }

  const now = new Date();
  const passwordHash = await hashPassword(newPassword);

  if (!admin) {
    if (!createIfMissing) {
      throw new Error(
        `No admin account found for "${targetEmail}". Re-run with --create to create it.`
      );
    }
    admin = await AdminUser.create({
      email: targetEmail,
      passwordHash,
      name: String(name || 'Colombo Tours Staff').trim().slice(0, 100),
      role: 'admin',
      isActive: true,
      tokenVersion: 1,
      passwordChangedAt: now,
      failedLoginAttempts: 0,
      lockUntil: null,
    });
  } else {
    admin.passwordHash = passwordHash;
    admin.tokenVersion = Number(admin.tokenVersion || 0) + 1;
    admin.passwordChangedAt = now;
    admin.isActive = true;
    admin.failedLoginAttempts = 0;
    admin.lockUntil = null;
    await admin.save();
  }

  // Clear any active email lockout window so the admin can sign in immediately
  await clearRateLimit(
    `login-fail-email:${hashRateLimitIdentifier(admin.email)}`
  );

  return {
    id: String(admin._id),
    email: admin.email,
    name: admin.name,
    tokenVersion: admin.tokenVersion,
    passwordChangedAt: admin.passwordChangedAt,
  };
}

function promptLine(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'Interactive hidden prompt requires a TTY. Provide RESET_ADMIN_PASSWORD or pass --generate.'
        )
      );
      return;
    }

    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = Boolean(stdin.isRaw);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          // Ctrl+C
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Password reset canceled.'));
          return;
        }
        if (ch === '\r' || ch === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
          }
          continue;
        }
        value += ch;
      }
    };

    stdin.on('data', onData);
  });
}

function parseCliArgs(argv) {
  const opts = {
    email: process.env.RESET_ADMIN_EMAIL || '',
    name: process.env.RESET_ADMIN_NAME || env.adminName || 'Colombo Tours Staff',
    generate: false,
    create: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--generate') {
      opts.generate = true;
    } else if (arg === '--create') {
      opts.create = true;
    } else if (arg.startsWith('--email=')) {
      opts.email = arg.slice('--email='.length);
    } else if (arg === '--email' && argv[i + 1]) {
      opts.email = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--name=')) {
      opts.name = arg.slice('--name='.length);
    } else if (arg === '--name' && argv[i + 1]) {
      opts.name = argv[i + 1];
      i += 1;
    }
  }

  return opts;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(
      'Colombo Tours Admin Password Reset CLI\n\n' +
        'Usage:\n' +
        '  npm run reset-password [-- --email=admin@domain.com] [-- --generate] [-- --create]\n\n' +
        'Options:\n' +
        '  --email <email>  Target admin email (defaults to the sole existing admin)\n' +
        '  --generate       Generate a strong 20-character random password\n' +
        '  --create         Create the admin account if it does not exist yet\n' +
        '  --name <name>    Display name when creating a new account\n\n' +
        'Non-interactive env vars:\n' +
        '  RESET_ADMIN_EMAIL, RESET_ADMIN_PASSWORD\n'
    );
    return;
  }

  try {
    await connectDB();

    let email = opts.email.trim().toLowerCase();
    if (!email && process.stdin.isTTY) {
      const existing = await AdminUser.find().select('email').limit(5).lean();
      if (existing.length === 1) {
        email = existing[0].email;
        console.log(`Target admin account: ${email}`);
      } else {
        const entered = await promptLine(
          `Admin email${env.adminEmail ? ` [${env.adminEmail}]` : ''}: `
        );
        email = (entered.trim() || env.adminEmail).toLowerCase();
      }
    }

    let newPassword = '';
    let generated = false;

    if (opts.generate) {
      newPassword = generateStrongPassword(20);
      generated = true;
    } else if (process.env.RESET_ADMIN_PASSWORD) {
      newPassword = process.env.RESET_ADMIN_PASSWORD;
    } else {
      const first = await promptHidden('Enter new strong password (min 12 chars): ');
      const confirm = await promptHidden('Confirm new password: ');
      if (first !== confirm) {
        throw new Error('Passwords do not match.');
      }
      newPassword = first;
    }

    const updated = await resetAdminPassword({
      email,
      newPassword,
      name: opts.name,
      createIfMissing: opts.create,
    });

    console.log(
      `[Security] Password updated for ${updated.email}. All existing admin sessions have been revoked and login lockouts cleared.`
    );
    if (generated) {
      console.log(
        `[Security] Generated one-time password (store it in your password manager now — it will not be shown again):\n${newPassword}`
      );
    }
  } catch (error) {
    console.error('[Reset Password] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

const isDirectEntry =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectEntry) {
  main();
}
