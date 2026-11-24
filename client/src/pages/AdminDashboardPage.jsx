import {
  AlertCircle,
  Car,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminVehicleModal } from '../components/AdminVehicleModal';
import { BrandLogo } from '../components/BrandLogo';
import {
  TelegramIcon,
  WeChatIcon,
  WhatsAppIcon,
} from '../components/ChannelButtons';
import { VehiclePhoto } from '../components/VehiclePhoto';
import { useSite } from '../context/SiteContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch, resolveApiUrl } from '../lib/api';
import {
  buildTelegramUrl,
  buildVehicleEnquiryMessage,
  buildWhatsAppUrl,
  formatTelegramDisplay,
  isValidTelegramHandle,
  isValidWeChatId,
  isValidWhatsAppNumber,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
} from '../lib/channels';
import { optimizeImageForUpload } from '../lib/imageOptimize';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { notifyDataUpdated } = useSite();

  const [admin, setAdmin] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('fleet');

  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [settingsForm, setSettingsForm] = useState({
    companyName: 'Colombo Tours',
    tagline: 'Built Trust in Excellence',
    whatsappNumber: '',
    telegramHandle: '',
    wechatId: '',
    wechatQrUrl: '',
    wechatQrStorageProvider: '',
    wechatQrMediaId: '',
    heroHeadline: '',
    heroSubheadline: '',
    supportGreeting: '',
  });
  const [channelStatus, setChannelStatus] = useState({
    whatsapp: false,
    telegram: false,
    wechat: false,
  });
  const [uploadingWeChatQr, setUploadingWeChatQr] = useState(false);

  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetStatus, setFleetStatus] = useState('all');
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');

  const [newService, setNewService] = useState({
    name: '',
    badge: '',
    description: '',
    icon: 'car',
  });

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const showToast = (msg) => {
    setError('');
    setNotice(msg);
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const [vRes, cRes, sRes, setRes] = await Promise.all([
        apiFetch('/api/admin/vehicles'),
        apiFetch('/api/admin/categories'),
        apiFetch('/api/admin/services'),
        apiFetch('/api/admin/settings'),
      ]);

      setVehicles(vRes.vehicles || []);
      setCategories(cRes.categories || []);
      setServices(sRes.services || []);
      if (setRes.settings) {
        setSettingsForm({
          companyName: setRes.settings.companyName || 'Colombo Tours',
          tagline: setRes.settings.tagline || '',
          whatsappNumber: setRes.settings.whatsappNumber
            ? `+${setRes.settings.whatsappNumber}`
            : '',
          telegramHandle: setRes.settings.telegramDisplay || '',
          wechatId: setRes.settings.wechatId || '',
          wechatQrUrl: setRes.settings.wechatQrUrl || '',
          wechatQrStorageProvider:
            setRes.settings.wechatQrStorageProvider || '',
          wechatQrMediaId: setRes.settings.wechatQrMediaId || '',
          heroHeadline: setRes.settings.heroHeadline || '',
          heroSubheadline: setRes.settings.heroSubheadline || '',
          supportGreeting: setRes.settings.supportGreeting || '',
        });
        setChannelStatus({
          whatsapp: Boolean(setRes.settings.whatsappConfigured),
          telegram: Boolean(setRes.settings.telegramConfigured),
          wechat: Boolean(setRes.settings.wechatConfigured),
        });
      }
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setError(err.message || 'Failed to load dashboard data.');
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/auth/me')
      .then((res) => {
        if (!mounted) return;
        setAdmin(res.admin);
        setAuthChecked(true);
        loadDashboardData();
      })
      .catch(() => {
        if (mounted) navigate('/admin/login', { replace: true });
      });
    return () => {
      mounted = false;
    };
  }, [navigate, loadDashboardData]);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    navigate('/admin/login', { replace: true });
  };

  const filteredVehicles = useMemo(() => {
    const q = fleetSearch.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (fleetStatus === 'published' && !v.isPublished) return false;
      if (fleetStatus === 'unpublished' && v.isPublished) return false;
      if (q) {
        const hay = `${v.name} ${v.model || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, fleetSearch, fleetStatus]);

  const stats = useMemo(() => {
    const published = vehicles.filter((v) => v.isPublished).length;
    const featured = vehicles.filter((v) => v.isFeatured && v.isPublished).length;
    return {
      total: vehicles.length,
      published,
      unpublished: vehicles.length - published,
      featured,
    };
  }, [vehicles]);

  const handleTogglePublish = async (vehicle) => {
    try {
      const res = await apiFetch(`/api/admin/vehicles/${vehicle._id}/publish`, {
        method: 'PATCH',
        body: { isPublished: !vehicle.isPublished },
      });
      setVehicles((prev) =>
        prev.map((v) => (v._id === vehicle._id ? res.vehicle : v))
      );
      await notifyDataUpdated();
      showToast(
        res.vehicle.isPublished
          ? `"${vehicle.name}" is now published on the storefront.`
          : `"${vehicle.name}" has been unpublished (hidden from public view).`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleFeatured = async (vehicle) => {
    try {
      const res = await apiFetch(
        `/api/admin/vehicles/${vehicle._id}/featured`,
        {
          method: 'PATCH',
          body: { isFeatured: !vehicle.isFeatured },
        }
      );
      setVehicles((prev) =>
        prev.map((v) => (v._id === vehicle._id ? res.vehicle : v))
      );
      await notifyDataUpdated();
      showToast(
        res.vehicle.isFeatured
          ? `"${vehicle.name}" added to Hero Banner.`
          : `"${vehicle.name}" removed from Hero Banner.`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteVehicle = async (vehicle) => {
    if (!window.confirm(`Remove "${vehicle.name}" permanently?`)) return;
    try {
      await apiFetch(`/api/admin/vehicles/${vehicle._id}`, {
        method: 'DELETE',
      });
      setVehicles((prev) => prev.filter((v) => v._id !== vehicle._id));
      await notifyDataUpdated();
      showToast(`Removed "${vehicle.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await apiFetch('/api/admin/categories', {
        method: 'POST',
        body: {
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
          sortOrder: categories.length + 1,
        },
      });
      setCategories((prev) => [...prev, { ...res.category, vehicleCount: 0 }]);
      setNewCategoryName('');
      setNewCategoryDesc('');
      await notifyDataUpdated();
      showToast(`Added category "${res.category.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateCategory = async (catId) => {
    try {
      const res = await apiFetch(`/api/admin/categories/${catId}`, {
        method: 'PUT',
        body: {
          name: editingCatName.trim(),
          description: editingCatDesc.trim(),
        },
      });
      setCategories((prev) =>
        prev.map((c) =>
          c._id === catId ? { ...c, ...res.category } : c
        )
      );
      setEditingCatId(null);
      await notifyDataUpdated();
      showToast(`Updated category "${res.category.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (
      !window.confirm(
        `Delete category "${cat.name}"? Vehicles in this category will remain in the fleet.`
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/admin/categories/${cat._id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c._id !== cat._id));
      await loadDashboardData();
      await notifyDataUpdated();
      showToast(`Deleted category "${cat.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!newService.name.trim()) return;
    try {
      const res = await apiFetch('/api/admin/services', {
        method: 'POST',
        body: {
          ...newService,
          sortOrder: services.length + 1,
        },
      });
      setServices((prev) => [...prev, res.service]);
      setNewService({ name: '', badge: '', description: '', icon: 'car' });
      await notifyDataUpdated();
      showToast(`Added service "${res.service.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleService = async (service) => {
    try {
      const res = await apiFetch(`/api/admin/services/${service._id}`, {
        method: 'PUT',
        body: { isActive: !service.isActive },
      });
      setServices((prev) =>
        prev.map((s) => (s._id === service._id ? res.service : s))
      );
      await notifyDataUpdated();
      showToast(
        res.service.isActive
          ? `Service "${service.name}" enabled.`
          : `Service "${service.name}" hidden.`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteService = async (service) => {
    if (!window.confirm(`Delete service "${service.name}"?`)) return;
    try {
      await apiFetch(`/api/admin/services/${service._id}`, { method: 'DELETE' });
      setServices((prev) => prev.filter((s) => s._id !== service._id));
      await notifyDataUpdated();
      showToast(`Deleted service "${service.name}".`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUploadWeChatQr = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingWeChatQr(true);
    setError('');
    setNotice('');
    try {
      const optimized = await optimizeImageForUpload(file, {
        maxWidth: 800,
        maxHeight: 800,
      });
      const formData = new FormData();
      formData.append('photos', optimized);
      const data = await apiFetch('/api/admin/uploads', {
        method: 'POST',
        body: formData,
      });
      const uploaded = data.photos?.[0];
      if (!uploaded?.url) {
        throw new Error('Could not upload WeChat QR image.');
      }
      setSettingsForm((prev) => ({
        ...prev,
        wechatQrUrl: uploaded.url,
        wechatQrStorageProvider: uploaded.storageProvider || '',
        wechatQrMediaId: uploaded.mediaId || '',
      }));
      showToast('WeChat QR image uploaded. Click "Save Settings" to publish.');
    } catch (err) {
      setError(err.message || 'Could not upload WeChat QR image.');
    } finally {
      setUploadingWeChatQr(false);
    }
  };

  const handleSaveSettings = async (e, overrides = null) => {
    e?.preventDefault();
    setSavingSettings(true);
    setError('');
    setNotice('');

    const payload = {
      ...settingsForm,
      whatsappNumber: settingsForm.whatsappNumber.trim(),
      telegramHandle: settingsForm.telegramHandle.trim(),
      wechatId: settingsForm.wechatId.trim(),
      wechatQrUrl: settingsForm.wechatQrUrl.trim(),
      ...(overrides || {}),
    };

    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: payload,
      });
      const saved = res.settings;
      setSettingsForm({
        companyName: saved.companyName,
        tagline: saved.tagline,
        whatsappNumber: saved.whatsappNumber ? `+${saved.whatsappNumber}` : '',
        telegramHandle: saved.telegramDisplay || '',
        wechatId: saved.wechatId || '',
        wechatQrUrl: saved.wechatQrUrl || '',
        wechatQrStorageProvider: saved.wechatQrStorageProvider || '',
        wechatQrMediaId: saved.wechatQrMediaId || '',
        heroHeadline: saved.heroHeadline,
        heroSubheadline: saved.heroSubheadline,
        supportGreeting: saved.supportGreeting,
      });
      setChannelStatus({
        whatsapp: Boolean(saved.whatsappConfigured),
        telegram: Boolean(saved.telegramConfigured),
        wechat: Boolean(saved.wechatConfigured),
      });
      await notifyDataUpdated();

      const activeLabels = [
        saved.whatsappConfigured ? `WhatsApp (+${saved.whatsappNumber})` : null,
        saved.telegramConfigured ? `Telegram (${saved.telegramDisplay})` : null,
        saved.wechatConfigured
          ? `WeChat (${saved.wechatId || 'QR Code'})`
          : null,
      ].filter(Boolean);

      showToast(
        activeLabels.length > 0
          ? `Settings saved! Active booking channels: ${activeLabels.join(' · ')}.`
          : 'Settings saved. All booking buttons are disabled until at least one channel is configured.'
      );
    } catch (err) {
      setError(err.message || 'Could not update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const previewDigits = normalizeWhatsAppNumber(settingsForm.whatsappNumber);
  const previewValid = isValidWhatsAppNumber(previewDigits);
  const sampleWaUrl = previewValid
    ? buildWhatsAppUrl(
        previewDigits,
        buildVehicleEnquiryMessage('2024 Mercedes-Benz S-Class')
      )
    : null;

  const previewTgHandle = normalizeTelegramHandle(settingsForm.telegramHandle);
  const previewTgValid = isValidTelegramHandle(previewTgHandle);
  const sampleTgUrl = previewTgValid
    ? buildTelegramUrl(
        previewTgHandle,
        buildVehicleEnquiryMessage('2024 Mercedes-Benz S-Class')
      )
    : null;

  const previewWeChatId = normalizeWeChatId(settingsForm.wechatId);
  const previewWeChatValid = isValidWeChatId(previewWeChatId);
  const configuredChannelCount =
    Number(channelStatus.whatsapp) +
    Number(channelStatus.telegram) +
    Number(channelStatus.wechat);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] text-sm text-[var(--text-muted)]">
        Verifying staff session...
      </div>
    );
  }

  return (
    <div
      translate="no"
      className="notranslate min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]"
    >
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-gold)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/">
              <BrandLogo variant="compact" />
            </Link>
            <span className="hidden sm:inline-flex rounded-full border border-[var(--border-gold)] bg-[var(--gold-soft-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--gold-accent)]">
              Staff Admin
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">View Storefront</span>
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] text-[var(--gold-accent)] cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              data-testid="admin-logout-btn"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-red-400/50 hover:text-red-400 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Welcome + Overview Stats */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Fleet &amp; Enquiry Management
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Signed in as {admin?.name} ({admin?.email})
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            data-testid="admin-whatsapp-status-pill"
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium cursor-pointer ${
              configuredChannelCount > 0
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
          >
            {configuredChannelCount > 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Channels Active ({configuredChannelCount}/3):{' '}
                  {[
                    channelStatus.whatsapp ? 'WhatsApp' : null,
                    channelStatus.telegram ? 'Telegram' : null,
                    channelStatus.wechat ? 'WeChat' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>No Booking Channels Set — Click to Configure</span>
              </>
            )}
          </button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card-luxury rounded-xl p-4">
            <p className="text-xs text-[var(--text-muted)]">Total Vehicles</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {stats.total}
            </p>
          </div>
          <div className="card-luxury rounded-xl p-4">
            <p className="text-xs text-[var(--text-muted)]">Published</p>
            <p className="mt-1 text-2xl font-bold text-emerald-500">
              {stats.published}
            </p>
          </div>
          <div className="card-luxury rounded-xl p-4">
            <p className="text-xs text-[var(--text-muted)]">Unpublished Drafts</p>
            <p className="mt-1 text-2xl font-bold text-[var(--text-secondary)]">
              {stats.unpublished}
            </p>
          </div>
          <div className="card-luxury rounded-xl p-4">
            <p className="text-xs text-[var(--text-muted)]">Hero Featured</p>
            <p className="mt-1 text-2xl font-bold text-[var(--gold-accent)]">
              {stats.featured}
            </p>
          </div>
        </div>

        {/* Feedback Banners */}
        {notice ? (
          <div
            role="status"
            data-testid="admin-toast-notice"
            className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            data-testid="admin-error-banner"
            className="flex items-center justify-between gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Section Tabs */}
        <div
          role="tablist"
          className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-3"
        >
          {[
            { id: 'fleet', label: 'Fleet Vehicles', icon: Car },
            { id: 'categories', label: 'Categories', icon: Layers },
            { id: 'services', label: 'Services', icon: Sparkles },
            { id: 'settings', label: 'Booking Channels & Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              data-testid={`admin-tab-${id}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
                activeTab === id
                  ? 'btn-gold'
                  : 'pill-gold-outline text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: FLEET VEHICLES */}
        {activeTab === 'fleet' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="search"
                    value={fleetSearch}
                    onChange={(e) => setFleetSearch(e.target.value)}
                    placeholder="Filter fleet by name or model..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                  />
                </div>

                <select
                  value={fleetStatus}
                  onChange={(e) => setFleetStatus(e.target.value)}
                  aria-label="Filter by publish status"
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published Only</option>
                  <option value="unpublished">Unpublished Drafts</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setShowVehicleModal(true);
                }}
                data-testid="admin-add-vehicle-btn"
                className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Vehicle</span>
              </button>
            </div>

            {filteredVehicles.length === 0 ? (
              <div className="card-luxury rounded-2xl p-10 text-center text-sm text-[var(--text-muted)]">
                No vehicles match your filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVehicles.map((vehicle) => {
                  const primaryPhoto =
                    vehicle.photos?.find((p) => p.isPrimary) ||
                    vehicle.photos?.[0] ||
                    null;

                  return (
                    <div
                      key={vehicle._id}
                      data-testid={`admin-vehicle-row-${vehicle.slug}`}
                      className="card-luxury flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center"
                    >
                      <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-[#121216] sm:h-20 sm:w-32">
                        <VehiclePhoto
                          src={primaryPhoto?.url}
                          alt={vehicle.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            {vehicle.name}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              vehicle.isPublished
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                : 'bg-zinc-500/20 text-[var(--text-muted)]'
                            }`}
                          >
                            {vehicle.isPublished ? 'Published' : 'Unpublished'}
                          </span>
                          {vehicle.isFeatured ? (
                            <span className="rounded-full bg-[var(--gold-soft-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold-accent)]">
                              Hero Featured
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          {[
                            vehicle.specs?.transmission,
                            vehicle.specs?.seats
                              ? `${vehicle.specs.seats} seats`
                              : null,
                            vehicle.specs?.luggage,
                            vehicle.specs?.chauffeur,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No specifications entered yet'}
                        </p>

                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(vehicle.categories || []).map((cat) => (
                            <span
                              key={cat._id || cat.slug}
                              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-pill)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(vehicle)}
                          data-testid={`toggle-publish-${vehicle.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--gold-soft-bg)] cursor-pointer"
                        >
                          {vehicle.isPublished ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Publish</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(vehicle)}
                          title={
                            vehicle.isFeatured
                              ? 'Remove from Hero Banner'
                              : 'Feature in Hero Banner'
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-full border cursor-pointer ${
                            vehicle.isFeatured
                              ? 'border-[var(--gold-bright)] bg-[var(--gold-soft-bg)] text-[var(--gold-accent)]'
                              : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--gold-accent)]'
                          }`}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicle(vehicle);
                            setShowVehicleModal(true);
                          }}
                          data-testid={`edit-vehicle-${vehicle.slug}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-gold)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVehicle(vehicle)}
                          data-testid={`delete-vehicle-${vehicle.slug}`}
                          aria-label={`Delete ${vehicle.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/25 text-red-500 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* TAB 2: CATEGORIES */}
        {activeTab === 'categories' ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateCategory}
                className="card-luxury rounded-2xl p-5 space-y-4"
              >
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Add Category
                </h2>
                <div>
                  <label
                    htmlFor="cat-name"
                    className="mb-1 block text-xs text-[var(--text-secondary)]"
                  >
                    Category Name *
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Self-Drive, Classic Wedding"
                    data-testid="new-category-name"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cat-desc"
                    className="mb-1 block text-xs text-[var(--text-secondary)]"
                  >
                    Description (optional)
                  </label>
                  <input
                    id="cat-desc"
                    type="text"
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder="Short category summary"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="add-category-submit"
                  className="btn-gold w-full rounded-full py-2.5 text-sm cursor-pointer"
                >
                  Create Category
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  className="card-luxury flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editingCatId === cat._id ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="rounded-lg border border-[var(--border-gold)] bg-[var(--bg-input)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        type="text"
                        value={editingCatDesc}
                        onChange={(e) => setEditingCatDesc(e.target.value)}
                        placeholder="Description"
                        className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat._id)}
                          className="btn-gold rounded-full px-3.5 py-1.5 text-xs cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {cat.name}
                          </h3>
                          <span className="rounded-full bg-[var(--bg-pill)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                            {cat.vehicleCount || 0} vehicles
                          </span>
                        </div>
                        {cat.description ? (
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {cat.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(cat._id);
                            setEditingCatName(cat.name);
                            setEditingCatDesc(cat.description || '');
                          }}
                          className="rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-gold)] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          aria-label={`Delete ${cat.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/25 text-red-500 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* TAB 3: SERVICES */}
        {activeTab === 'services' ? (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateService}
                className="card-luxury rounded-2xl p-5 space-y-3.5"
              >
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Add Rental Service
                </h2>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newService.name}
                    onChange={(e) =>
                      setNewService({ ...newService, name: e.target.value })
                    }
                    placeholder="e.g., VIP Airport Transfer (CMB)"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                    Short Badge
                  </label>
                  <input
                    type="text"
                    value={newService.badge}
                    onChange={(e) =>
                      setNewService({ ...newService, badge: e.target.value })
                    }
                    placeholder="e.g., 24/7 Concierge"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                    Icon
                  </label>
                  <select
                    value={newService.icon}
                    onChange={(e) =>
                      setNewService({ ...newService, icon: e.target.value })
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="car">Car</option>
                    <option value="plane">Airport / Plane</option>
                    <option value="heart">Wedding / Heart</option>
                    <option value="compass">Island Tour / Compass</option>
                    <option value="briefcase">Corporate / Briefcase</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newService.description}
                    onChange={(e) =>
                      setNewService({
                        ...newService,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-gold w-full rounded-full py-2.5 text-sm cursor-pointer"
                >
                  Create Service
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {services.map((service) => (
                <div
                  key={service._id}
                  className="card-luxury flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {service.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          service.isActive
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-zinc-500/20 text-[var(--text-muted)]'
                        }`}
                      >
                        {service.isActive ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleService(service)}
                      className="rounded-full border border-[var(--border-gold)] px-3 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      {service.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(service)}
                      aria-label={`Delete ${service.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/25 text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* TAB 4: BOOKING CHANNELS (WHATSAPP, TELEGRAM, WECHAT) & SITE SETTINGS */}
        {activeTab === 'settings' ? (
          <section className="max-w-3xl">
            <form
              onSubmit={(e) => handleSaveSettings(e)}
              className="card-luxury rounded-2xl p-6 space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Global Booking Channels
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  Manage your WhatsApp, Telegram, and WeChat details from one
                  place. Changing a channel updates every booking button across
                  the storefront (Floating Dock, Header, Hero, Vehicle Cards,
                  Specs Modal, Quick Enquiry, and Services). Leaving a channel
                  blank disables only that channel.
                </p>

                <div className="mt-5 space-y-5">
                  {/* 1. WhatsApp */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="settings-whatsapp"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <WhatsAppIcon className="h-4 w-4 text-[var(--gold-accent)]" />
                        <span>
                          WhatsApp Number (International format with country code)
                        </span>
                      </label>
                      {settingsForm.whatsappNumber ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              whatsappNumber: '',
                            })
                          }
                          className="text-[11px] text-red-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <input
                      id="settings-whatsapp"
                      type="text"
                      value={settingsForm.whatsappNumber}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          whatsappNumber: e.target.value,
                        })
                      }
                      placeholder="e.g., +94 77 123 4567"
                      data-testid="admin-whatsapp-input"
                      className="w-full rounded-xl border border-[var(--border-gold)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                    />

                    {settingsForm.whatsappNumber.trim() ? (
                      previewValid ? (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300 space-y-1">
                          <p className="font-medium">
                            Valid WhatsApp number: +{previewDigits}
                          </p>
                          <p className="break-all text-[11px] opacity-85">
                            Sample link: {sampleWaUrl}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-500 dark:text-red-300">
                          Please enter 8–15 digits including international country
                          code without leading zero (for Sri Lanka start with +94).
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        Empty: WhatsApp buttons will remain disabled on the
                        storefront.
                      </p>
                    )}
                  </div>

                  {/* 2. Telegram */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="settings-telegram"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <TelegramIcon className="h-4 w-4 text-[#2AABEE]" />
                        <span>
                          Telegram Username or International Phone Number
                        </span>
                      </label>
                      {settingsForm.telegramHandle ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm({
                              ...settingsForm,
                              telegramHandle: '',
                            })
                          }
                          className="text-[11px] text-red-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <input
                      id="settings-telegram"
                      type="text"
                      value={settingsForm.telegramHandle}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          telegramHandle: e.target.value,
                        })
                      }
                      placeholder="e.g., @ColomboTours or +94 77 123 4567"
                      data-testid="admin-telegram-input"
                      className="w-full rounded-xl border border-[var(--border-gold)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                    />

                    {settingsForm.telegramHandle.trim() ? (
                      previewTgValid ? (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300 space-y-1">
                          <p className="font-medium">
                            Valid Telegram contact:{' '}
                            {formatTelegramDisplay(previewTgHandle)}
                          </p>
                          <p className="break-all text-[11px] opacity-85">
                            Sample link: {sampleTgUrl}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-500 dark:text-red-300">
                          Enter a valid Telegram username (5–32 letters, numbers,
                          underscores) or international phone number (e.g., +94
                          77 123 4567).
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        Empty: Telegram buttons will remain disabled on the
                        storefront.
                      </p>
                    )}
                  </div>

                  {/* 3. WeChat */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card-elevated)] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="settings-wechat"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <WeChatIcon className="h-4 w-4 text-[#07C160]" />
                        <span>
                          WeChat ID or Phone Number (plus optional WeChat QR Code)
                        </span>
                      </label>
                      {settingsForm.wechatId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsForm({ ...settingsForm, wechatId: '' })
                          }
                          className="text-[11px] text-red-500 hover:underline cursor-pointer"
                        >
                          Clear ID
                        </button>
                      ) : null}
                    </div>
                    <input
                      id="settings-wechat"
                      type="text"
                      value={settingsForm.wechatId}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          wechatId: e.target.value,
                        })
                      }
                      placeholder="e.g., ColomboToursLK or +94 77 123 4567"
                      data-testid="admin-wechat-input"
                      className="w-full rounded-xl border border-[var(--border-gold)] bg-[var(--bg-input)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-gold-strong)] focus:outline-none"
                    />

                    {settingsForm.wechatId.trim() ? (
                      previewWeChatValid ? (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-300">
                          Valid WeChat contact: <strong>{previewWeChatId}</strong>
                        </div>
                      ) : (
                        <p className="text-xs text-red-500 dark:text-red-300">
                          Enter a valid WeChat ID (6–20 letters/numbers/underscore/hyphen
                          starting with a letter) or international phone number.
                        </p>
                      )
                    ) : !settingsForm.wechatQrUrl ? (
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        Empty: WeChat buttons will remain disabled unless a
                        WeChat ID or QR code is set.
                      </p>
                    ) : null}

                    {/* Optional WeChat QR code image upload */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {settingsForm.wechatQrUrl ? (
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-lg border border-[var(--border-gold)] bg-white p-1">
                            <img
                              src={resolveApiUrl(settingsForm.wechatQrUrl)}
                              alt="WeChat QR preview"
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSettingsForm((prev) => ({
                                ...prev,
                                wechatQrUrl: '',
                                wechatQrStorageProvider: '',
                                wechatQrMediaId: '',
                              }))
                            }
                            data-testid="admin-remove-wechat-qr-btn"
                            className="rounded-full border border-red-500/35 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 cursor-pointer"
                          >
                            Remove QR
                          </button>
                        </div>
                      ) : null}

                      <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-gold)] bg-[var(--bg-pill)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-gold-strong)] hover:bg-[var(--gold-soft-bg)] cursor-pointer">
                        <Upload className="h-3.5 w-3.5 text-[var(--gold-accent)]" />
                        <span>
                          {uploadingWeChatQr
                            ? 'Uploading QR...'
                            : settingsForm.wechatQrUrl
                              ? 'Replace WeChat QR Code'
                              : 'Upload WeChat QR Code (Optional)'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          disabled={uploadingWeChatQr}
                          onChange={handleUploadWeChatQr}
                          data-testid="admin-wechat-qr-input"
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-5 space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Storefront Messaging
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="settings-company"
                      className="mb-1 block text-xs text-[var(--text-secondary)]"
                    >
                      Company Name
                    </label>
                    <input
                      id="settings-company"
                      type="text"
                      value={settingsForm.companyName}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          companyName: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-tagline"
                      className="mb-1 block text-xs text-[var(--text-secondary)]"
                    >
                      Brand Tagline
                    </label>
                    <input
                      id="settings-tagline"
                      type="text"
                      value={settingsForm.tagline}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          tagline: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="settings-hero"
                    className="mb-1 block text-xs text-[var(--text-secondary)]"
                  >
                    Desktop Hero Headline
                  </label>
                  <input
                    id="settings-hero"
                    type="text"
                    value={settingsForm.heroHeadline}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        heroHeadline: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-hero-sub"
                    className="mb-1 block text-xs text-[var(--text-secondary)]"
                  >
                    Desktop Hero Subheadline
                  </label>
                  <textarea
                    id="settings-hero-sub"
                    rows={2}
                    value={settingsForm.heroSubheadline}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        heroSubheadline: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-support-msg"
                    className="mb-1 block text-xs text-[var(--text-secondary)]"
                  >
                    General Concierge Support Message (WhatsApp, Telegram &amp;
                    WeChat)
                  </label>
                  <textarea
                    id="settings-support-msg"
                    rows={2}
                    value={settingsForm.supportGreeting}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        supportGreeting: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  disabled={savingSettings}
                  onClick={() =>
                    handleSaveSettings(null, {
                      whatsappNumber: '',
                      telegramHandle: '',
                      wechatId: '',
                      wechatQrUrl: '',
                      wechatQrStorageProvider: '',
                      wechatQrMediaId: '',
                    })
                  }
                  data-testid="admin-clear-whatsapp-btn"
                  className="rounded-full border border-red-500/35 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  Clear All Channels (Disable Enquiries)
                </button>

                <button
                  type="submit"
                  disabled={savingSettings}
                  data-testid="admin-save-settings-btn"
                  className="btn-gold rounded-full px-6 py-2.5 text-sm cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </main>

      {showVehicleModal ? (
        <AdminVehicleModal
          vehicle={editingVehicle}
          categories={categories}
          onClose={() => {
            setShowVehicleModal(false);
            setEditingVehicle(null);
          }}
          onSaved={async (savedVehicle) => {
            setShowVehicleModal(false);
            setEditingVehicle(null);
            await loadDashboardData();
            await notifyDataUpdated();
            showToast(`Saved "${savedVehicle.name}".`);
          }}
        />
      ) : null}
    </div>
  );
}
