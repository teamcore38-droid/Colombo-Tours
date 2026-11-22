import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '../lib/api';

const DEFAULT_SETTINGS = {
  companyName: 'Colombo Tours',
  tagline: 'Built Trust in Excellence',
  whatsappNumber: '',
  whatsappDisplay: '',
  whatsappConfigured: false,
  heroHeadline: 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
  heroSubheadline:
    'Chauffeur-driven flagship sedans, luxury SUVs, and bespoke transfers across Sri Lanka.',
  supportGreeting:
    'Hello Colombo Tours, I’d like to enquire about renting a vehicle. Could you assist me?',
};

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshSiteData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/bootstrap');
      setSettings(data.settings || DEFAULT_SETTINGS);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setServices(Array.isArray(data.services) ? data.services : []);
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
    } catch (err) {
      setError(err.message || 'Unable to load fleet details right now.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSiteData();
  }, [refreshSiteData]);

  // Keep open tabs synchronized if admin updates WhatsApp number or fleet in another tab
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'colombo-tours-data-version') {
        refreshSiteData({ silent: true });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshSiteData]);

  const notifyDataUpdated = useCallback(() => {
    try {
      window.localStorage.setItem(
        'colombo-tours-data-version',
        String(Date.now())
      );
    } catch {
      // ignore
    }
    return refreshSiteData({ silent: true });
  }, [refreshSiteData]);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      categories,
      services,
      vehicles,
      loading,
      error,
      refreshSiteData,
      notifyDataUpdated,
    }),
    [
      settings,
      categories,
      services,
      vehicles,
      loading,
      error,
      refreshSiteData,
      notifyDataUpdated,
    ]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useSite must be used inside SiteProvider');
  }
  return ctx;
}
