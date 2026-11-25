import {
  Database,
  Download,
  FileJson,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '../lib/api';

const MAX_BACKUP_FILE_BYTES = 2 * 1024 * 1024; // 2 MB matches Express JSON body limit

async function readFileAsText(file) {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}

function triggerJsonDownload(snapshot) {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `colombo-tours-backup-${stamp}.json`;
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return filename;
}

export function AdminBackupCard({
  onRequestConfirm,
  onRestored,
  showToast,
  showError,
}) {
  const [downloading, setDownloading] = useState(false);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [pendingBackup, setPendingBackup] = useState(null);

  const handleDownloadBackup = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const snapshot = await apiFetch('/api/admin/backup', { timeoutMs: 25_000 });
      const filename = triggerJsonDownload(snapshot);
      const counts = snapshot.counts || {
        vehicles: snapshot.data?.vehicles?.length || 0,
        categories: snapshot.data?.categories?.length || 0,
        services: snapshot.data?.services?.length || 0,
      };
      showToast(
        `Downloaded ${filename} (${counts.vehicles} vehicles, ${counts.categories} categories, ${counts.services} services).`
      );
    } catch (err) {
      showError(err?.message || 'Could not download backup snapshot.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectBackupFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      showError('Backup file is too large (maximum 2 MB).');
      return;
    }

    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        parsed.app !== 'colombo-tours' ||
        parsed.schemaVersion !== 1 ||
        !parsed.data ||
        !Array.isArray(parsed.data.vehicles) ||
        !Array.isArray(parsed.data.categories) ||
        !Array.isArray(parsed.data.services)
      ) {
        throw new Error(
          'Invalid backup file. Please choose a JSON file exported from Colombo Tours.'
        );
      }

      setPendingBackup({
        filename: file.name,
        exportedAt: parsed.exportedAt || '',
        counts: {
          vehicles: parsed.data.vehicles.length,
          categories: parsed.data.categories.length,
          services: parsed.data.services.length,
          hasSettings: Boolean(parsed.data.settings),
        },
        payload: parsed,
      });
    } catch (err) {
      setPendingBackup(null);
      showError(
        err instanceof SyntaxError
          ? 'Selected file is not valid JSON.'
          : err?.message || 'Could not parse backup file.'
      );
    }
  };

  const handleRequestRestore = () => {
    if (!pendingBackup) return;
    const isReplace = restoreMode === 'replace';
    const { filename, counts, payload } = pendingBackup;

    onRequestConfirm({
      title: isReplace ? 'Full Restore (Replace All Data)?' : 'Merge Backup Data?',
      itemName: `${filename} · ${counts.vehicles} vehicles, ${counts.categories} categories, ${counts.services} services`,
      description: isReplace
        ? 'This will replace your current Fleet Vehicles, Categories, Services, and Storefront Settings with the exact contents of this backup.'
        : 'This will add missing items and update matching vehicles, categories, services, and settings from the backup without deleting newer records.',
      consequence:
        'Your staff login accounts and uploaded Cloudinary/stored image files are never deleted during a restore.',
      confirmLabel: isReplace ? 'Replace & Restore' : 'Merge & Restore',
      busyLabel: 'Restoring...',
      variant: isReplace ? 'danger' : 'warning',
      onConfirm: async () => {
        const res = await apiFetch('/api/admin/restore', {
          method: 'POST',
          timeoutMs: 30_000,
          body: {
            mode: restoreMode,
            backup: payload,
          },
        });
        setPendingBackup(null);
        await onRestored?.();
        showToast(
          `Backup restored (${res.mode}): ${res.restored.vehicles} vehicles, ${res.restored.categories} categories, ${res.restored.services} services.`
        );
      },
    });
  };

  return (
    <div
      data-testid="admin-backup-card"
      className="card-luxury rounded-2xl p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <Database className="h-4.5 w-4.5 text-[var(--gold-accent)]" />
            <span>Backup &amp; Restore</span>
          </h2>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Download a complete JSON snapshot of your fleet, categories,
            services, and booking channel settings before major edits — or
            restore from a saved snapshot anytime.
          </p>
        </div>

        <button
          type="button"
          disabled={downloading}
          onClick={handleDownloadBackup}
          data-testid="admin-backup-download-btn"
          className="btn-gold inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Download Backup (.json)</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-gold)]/60 bg-[var(--gold-soft-bg)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-accent)]" />
        <span>
          Backups never include staff passwords or login credentials. Restoring
          preserves your admin accounts and uploaded media assets safely.
        </span>
      </div>

      {/* Restore from Backup JSON */}
      <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Restore from Snapshot
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Select a Colombo Tours backup file to preview its contents before
              restoring.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer">
            <Upload className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
            <span>Choose Backup File</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleSelectBackupFile}
              data-testid="admin-backup-file-input"
              className="sr-only"
            />
          </label>
        </div>

        {pendingBackup ? (
          <div
            data-testid="admin-backup-preview"
            className="rounded-xl border border-[var(--border-gold)] bg-[var(--bg-card-elevated)] p-4 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <FileJson className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-accent)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {pendingBackup.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {pendingBackup.counts.vehicles} vehicles ·{' '}
                    {pendingBackup.counts.categories} categories ·{' '}
                    {pendingBackup.counts.services} services
                    {pendingBackup.counts.hasSettings ? ' · Settings included' : ''}
                  </p>
                  {pendingBackup.exportedAt ? (
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Exported:{' '}
                      {new Date(pendingBackup.exportedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                aria-label="Clear selected backup file"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                  restoreMode === 'merge'
                    ? 'border-[var(--border-gold-strong)] bg-[var(--gold-soft-bg)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                <input
                  type="radio"
                  name="backupRestoreMode"
                  value="merge"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                  data-testid="backup-mode-merge"
                  className="mt-0.5 accent-[#D4AF37]"
                />
                <span>
                  <strong className="block font-semibold">
                    Merge / Update (Safe)
                  </strong>
                  <span className="text-[11px] opacity-85">
                    Restores missing items and updates matches without deleting
                    newer entries.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                  restoreMode === 'replace'
                    ? 'border-red-500/50 bg-red-500/10 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)]'
                }`}
              >
                <input
                  type="radio"
                  name="backupRestoreMode"
                  value="replace"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                  data-testid="backup-mode-replace"
                  className="mt-0.5 accent-red-500"
                />
                <span>
                  <strong className="block font-semibold">
                    Full Replace
                  </strong>
                  <span className="text-[11px] opacity-85">
                    Replaces fleet, categories, services &amp; settings to match
                    this snapshot exactly.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="rounded-full border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestRestore}
                data-testid="admin-backup-restore-btn"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold-strong)] bg-[var(--gold-soft-bg)] px-4 py-2 text-xs font-semibold text-[var(--gold-accent)] hover:bg-[var(--gold-bright)] hover:text-[#12100a] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore Snapshot</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
