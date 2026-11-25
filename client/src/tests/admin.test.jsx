import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteProvider } from '../context/SiteContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';

function createAdminBootstrapPayload() {
  return {
    admin: {
      id: 'adm-1',
      email: 'staff@colombotours.lk',
      name: 'Colombo Tours Staff',
      role: 'admin',
    },
    vehicles: [
      {
        _id: 'veh-1',
        name: '2024 Mercedes-Benz S-Class',
        model: 'S 500 AMG',
        slug: '2024-mercedes-benz-s-class',
        year: 2024,
        categories: [{ _id: 'cat-lux', name: 'Luxury', slug: 'luxury' }],
        specs: {
          seats: 5,
          transmission: 'Automatic',
          luggage: '3 Suitcases',
          chauffeur: 'Chauffeur Included',
        },
        photos: [
          {
            url: '/vehicles/mercedes-s-class.webp',
            alt: 'Mercedes S-Class',
            isPrimary: true,
          },
        ],
        isPublished: true,
        isFeatured: true,
        sortOrder: 1,
      },
    ],
    categories: [
      {
        _id: 'cat-lux',
        name: 'Luxury',
        slug: 'luxury',
        description: 'Executive flagship sedans.',
        vehicleCount: 1,
      },
    ],
    services: [
      {
        _id: 'srv-air',
        name: 'Airport Transfers (BIA / CMB)',
        slug: 'airport-transfers',
        badge: '24/7 Tracking',
        description: 'Direct BIA transfers.',
        icon: 'plane',
        isActive: true,
      },
    ],
    settings: {
      companyName: 'Colombo Tours',
      tagline: 'Built Trust in Excellence',
      whatsappNumber: '94771234567',
      whatsappDisplay: '+94771234567',
      whatsappLink: '',
      whatsappMode: 'number',
      whatsappEnabled: true,
      whatsappConfigured: true,
      telegramHandle: '',
      telegramDisplay: '',
      telegramLink: '',
      telegramMode: 'handle',
      telegramEnabled: true,
      telegramConfigured: false,
      wechatId: '',
      wechatDisplay: '',
      wechatLink: '',
      wechatMode: 'id',
      wechatEnabled: true,
      wechatQrUrl: '',
      wechatQrStorageProvider: '',
      wechatQrMediaId: '',
      wechatConfigured: false,
      heroHeadline: 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
      heroSubheadline: 'Premier Sri Lankan chauffeur fleet.',
      supportGreeting: 'Hello Colombo Tours, I’d like to enquire.',
    },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  const existingRobots = document.querySelector('meta[name="robots"]');
  if (existingRobots) existingRobots.remove();
});

describe('Admin Portal Security, Confirmation Modals & Floating Toasts', () => {
  it('applies noindex robots meta on AdminLoginPage, hides default email placeholder, and supports password visibility toggle', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'Unauthorized' }, 401))
    );

    const { unmount } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta).not.toBeNull();
    expect(robotsMeta.getAttribute('content')).toContain('noindex');

    const emailInput = screen.getByTestId('admin-email-input');
    expect(emailInput.getAttribute('placeholder') || '').not.toContain(
      'admin@colombotours.lk'
    );

    const passwordInput = screen.getByTestId('admin-password-input');
    expect(passwordInput.getAttribute('type')).toBe('password');
    await user.click(screen.getByLabelText('Show password'));
    expect(passwordInput.getAttribute('type')).toBe('text');
    await user.click(screen.getByLabelText('Hide password'));
    expect(passwordInput.getAttribute('type')).toBe('password');

    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('uses branded confirmation modals (never window.confirm) and floating toasts for vehicle, category, service deletion, and Clear All Channels', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const payload = createAdminBootstrapPayload();
    const fetchMock = vi.fn(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (url === '/api/admin/bootstrap' && method === 'GET') {
        return jsonResponse(payload);
      }
      if (url === '/api/admin/vehicles/veh-1' && method === 'DELETE') {
        return jsonResponse({ ok: true, id: 'veh-1' });
      }
      if (url === '/api/admin/categories/cat-lux' && method === 'DELETE') {
        return jsonResponse({ ok: true, id: 'cat-lux' });
      }
      if (url === '/api/admin/services/srv-air' && method === 'DELETE') {
        return jsonResponse({ ok: true, id: 'srv-air' });
      }
      if (url === '/api/admin/settings' && method === 'PUT') {
        return jsonResponse({
          settings: {
            ...payload.settings,
            whatsappNumber: '',
            whatsappDisplay: '',
            whatsappEnabled: false,
            whatsappConfigured: false,
            telegramEnabled: false,
            telegramConfigured: false,
            wechatEnabled: false,
            wechatConfigured: false,
          },
        });
      }
      return jsonResponse({ error: `Unexpected ${method} ${url}` }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Simulate landing directly on /admin so SiteProvider skips unnecessary public /api/bootstrap
    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/admin');

    try {
      render(
        <ThemeProvider>
          <SiteProvider>
            <MemoryRouter initialEntries={['/admin']}>
              <Routes>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/login" element={<div>Login</div>} />
              </Routes>
            </MemoryRouter>
          </SiteProvider>
        </ThemeProvider>
      );

      await waitFor(() =>
        expect(
          screen.getByTestId('admin-vehicle-row-2024-mercedes-benz-s-class')
        ).toBeInTheDocument()
      );

      // Single-request admin bootstrap; zero public /api/bootstrap fetch while on /admin
      expect(
        fetchMock.mock.calls.filter(([u]) => u === '/api/admin/bootstrap').length
      ).toBe(1);
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/bootstrap'))
      ).toBe(false);

      // Robots noindex meta active on /admin
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute('content')
      ).toContain('noindex');

      // 1. Delete Vehicle: opens branded modal, Escape cancels cleanly, Confirm deletes + shows floating toast
      await user.click(
        screen.getByTestId('delete-vehicle-2024-mercedes-benz-s-class')
      );
      const vehDialog = screen.getByTestId('admin-confirm-dialog');
      expect(vehDialog).toHaveAttribute('role', 'alertdialog');
      expect(within(vehDialog).getByTestId('confirm-dialog-title')).toHaveTextContent(
        'Delete Vehicle?'
      );
      expect(vehDialog).toHaveTextContent('2024 Mercedes-Benz S-Class');

      // Pressing Escape cancels without issuing DELETE
      await user.keyboard('{Escape}');
      expect(
        screen.queryByTestId('admin-confirm-dialog')
      ).not.toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(
          ([u, o]) => u === '/api/admin/vehicles/veh-1' && o?.method === 'DELETE'
        )
      ).toBe(false);

      // Re-open and confirm deletion
      await user.click(
        screen.getByTestId('delete-vehicle-2024-mercedes-benz-s-class')
      );
      await user.click(screen.getByTestId('confirm-dialog-confirm'));

      await waitFor(() =>
        expect(
          screen.queryByTestId('admin-vehicle-row-2024-mercedes-benz-s-class')
        ).not.toBeInTheDocument()
      );
      const toastStack = screen.getByTestId('admin-toast-stack');
      expect(toastStack).toHaveTextContent(
        'Removed "2024 Mercedes-Benz S-Class" from the fleet.'
      );

      // Manual toast dismiss works
      await user.click(within(toastStack).getByTestId('admin-toast-dismiss'));
      expect(screen.queryByTestId('admin-toast-stack')).not.toBeInTheDocument();

      // 2. Delete Category via branded modal (no redundant /api/admin/bootstrap reload)
      await user.click(screen.getByTestId('admin-tab-categories'));
      await user.click(screen.getByTestId('delete-category-luxury'));
      const catDialog = screen.getByTestId('admin-confirm-dialog');
      expect(within(catDialog).getByTestId('confirm-dialog-title')).toHaveTextContent(
        'Delete Category?'
      );
      await user.click(within(catDialog).getByTestId('confirm-dialog-confirm'));
      await waitFor(() =>
        expect(
          screen.queryByTestId('delete-category-luxury')
        ).not.toBeInTheDocument()
      );
      expect(screen.getByTestId('admin-toast-stack')).toHaveTextContent(
        'Deleted category "Luxury".'
      );

      // 3. Delete Service via branded modal
      await user.click(screen.getByTestId('admin-tab-services'));
      await user.click(screen.getByTestId('delete-service-airport-transfers'));
      const srvDialog = screen.getByTestId('admin-confirm-dialog');
      expect(within(srvDialog).getByTestId('confirm-dialog-title')).toHaveTextContent(
        'Delete Rental Service?'
      );
      await user.click(within(srvDialog).getByTestId('confirm-dialog-confirm'));
      await waitFor(() =>
        expect(
          screen.queryByTestId('delete-service-airport-transfers')
        ).not.toBeInTheDocument()
      );
      expect(screen.getByTestId('admin-toast-stack')).toHaveTextContent(
        'Deleted service "Airport Transfers (BIA / CMB)".'
      );

      // 4. Clear All Channels now requires explicit confirmation modal before PUT /api/admin/settings
      await user.click(screen.getByTestId('admin-tab-settings'));
      await user.click(screen.getByTestId('admin-clear-whatsapp-btn'));
      const clearDialog = screen.getByTestId('admin-confirm-dialog');
      expect(
        within(clearDialog).getByTestId('confirm-dialog-title')
      ).toHaveTextContent('Clear All Booking Channels?');

      // Canceling leaves settings untouched
      await user.click(within(clearDialog).getByTestId('confirm-dialog-cancel'));
      expect(
        fetchMock.mock.calls.some(
          ([u, o]) => u === '/api/admin/settings' && o?.method === 'PUT'
        )
      ).toBe(false);

      // Confirming clears all channels and displays floating toast
      await user.click(screen.getByTestId('admin-clear-whatsapp-btn'));
      await user.click(screen.getByTestId('confirm-dialog-confirm'));
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(
            ([u, o]) => u === '/api/admin/settings' && o?.method === 'PUT'
          )
        ).toBe(true)
      );
      expect(screen.getByTestId('admin-toast-stack')).toHaveTextContent(
        /Settings saved/i
      );

      // Browser-native window.confirm was NEVER called anywhere
      expect(confirmSpy).not.toHaveBeenCalled();
    } finally {
      window.history.pushState({}, '', originalPathname);
    }
  });

  it('supports 1-click backup JSON download and confirmed backup restore flow in Admin Settings', async () => {
    const user = userEvent.setup();
    const payload = createAdminBootstrapPayload();
    const exportedSnapshot = {
      app: 'colombo-tours',
      schemaVersion: 1,
      exportedAt: '2026-11-25T12:00:00.000Z',
      counts: { vehicles: 1, categories: 1, services: 1 },
      data: {
        settings: payload.settings,
        categories: payload.categories,
        services: payload.services,
        vehicles: payload.vehicles,
      },
    };

    const fetchMock = vi.fn(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (url === '/api/admin/bootstrap' && method === 'GET') {
        return jsonResponse(payload);
      }
      if (url === '/api/admin/backup' && method === 'GET') {
        return jsonResponse(exportedSnapshot);
      }
      if (url === '/api/admin/restore' && method === 'POST') {
        const parsedBody = JSON.parse(opts.body);
        return jsonResponse({
          ok: true,
          mode: parsedBody.mode,
          restored: {
            vehicles: 1,
            categories: 1,
            services: 1,
            settingsUpdated: true,
          },
          restoredAt: '2026-11-25T12:05:00.000Z',
        });
      }
      return jsonResponse({ error: `Unexpected ${method} ${url}` }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const prevCreateObjUrl = URL.createObjectURL;
    const prevRevokeObjUrl = URL.revokeObjectURL;
    const createObjUrl = vi.fn().mockReturnValue('blob:colombo-backup');
    const revokeObjUrl = vi.fn();
    URL.createObjectURL = createObjUrl;
    URL.revokeObjectURL = revokeObjUrl;
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const originalPathname = window.location.pathname;
    window.history.pushState({}, '', '/admin');

    try {
      render(
        <ThemeProvider>
          <SiteProvider>
            <MemoryRouter initialEntries={['/admin']}>
              <Routes>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/login" element={<div>Login</div>} />
              </Routes>
            </MemoryRouter>
          </SiteProvider>
        </ThemeProvider>
      );

      await waitFor(() =>
        expect(screen.getByTestId('admin-tab-settings')).toBeInTheDocument()
      );
      await user.click(screen.getByTestId('admin-tab-settings'));

      // 1. 1-click download backup
      await user.click(screen.getByTestId('admin-backup-download-btn'));
      await waitFor(() =>
        expect(screen.getByTestId('admin-toast-stack')).toHaveTextContent(
          /Downloaded colombo-tours-backup-/i
        )
      );
      expect(createObjUrl).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();
      expect(revokeObjUrl).toHaveBeenCalled();

      // 2. Upload valid backup JSON -> preview appears -> choose replace -> confirm modal -> POST /api/admin/restore
      const validFile = new File(
        [JSON.stringify(exportedSnapshot)],
        'colombo-tours-backup-2026-11-25.json',
        { type: 'application/json' }
      );
      await user.upload(screen.getByTestId('admin-backup-file-input'), validFile);

      const preview = await screen.findByTestId('admin-backup-preview');
      expect(preview).toHaveTextContent('colombo-tours-backup-2026-11-25.json');
      expect(preview).toHaveTextContent('1 vehicles · 1 categories · 1 services');

      await user.click(screen.getByTestId('backup-mode-replace'));
      await user.click(screen.getByTestId('admin-backup-restore-btn'));

      const dialog = screen.getByTestId('admin-confirm-dialog');
      expect(within(dialog).getByTestId('confirm-dialog-title')).toHaveTextContent(
        'Full Restore (Replace All Data)?'
      );

      await user.click(within(dialog).getByTestId('confirm-dialog-confirm'));

      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(
            ([u, o]) => u === '/api/admin/restore' && o?.method === 'POST'
          )
        ).toBe(true)
      );
      expect(screen.getByTestId('admin-toast-stack')).toHaveTextContent(
        /Backup restored \(replace\)/i
      );
      expect(screen.queryByTestId('admin-backup-preview')).not.toBeInTheDocument();
    } finally {
      URL.createObjectURL = prevCreateObjUrl;
      URL.revokeObjectURL = prevRevokeObjUrl;
      window.history.pushState({}, '', originalPathname);
    }
  });
});
