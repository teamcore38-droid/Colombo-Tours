import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteProvider } from '../context/SiteContext';
import { ThemeProvider } from '../context/ThemeContext';
import { HomePage } from '../pages/HomePage';

function createBootstrapPayload({ whatsappNumber = '' } = {}) {
  return {
    settings: {
      companyName: 'Colombo Tours',
      tagline: 'Built Trust in Excellence',
      whatsappNumber,
      whatsappDisplay: whatsappNumber ? `+${whatsappNumber}` : '',
      whatsappConfigured: Boolean(whatsappNumber),
      heroHeadline: 'EXPERIENCE SRI LANKA IN UNRIVALED LUXURY',
      heroSubheadline: 'Premier Sri Lankan chauffeur fleet.',
      supportGreeting: 'Hello Colombo Tours, I’d like to enquire.',
    },
    categories: [
      { _id: 'cat-lux', name: 'Luxury', slug: 'luxury', sortOrder: 1 },
      { _id: 'cat-suv', name: 'SUV', slug: 'suv', sortOrder: 2 },
      { _id: 'cat-wed', name: 'Wedding', slug: 'wedding', sortOrder: 3 },
      { _id: 'cat-chf', name: 'Chauffeur', slug: 'chauffeur', sortOrder: 4 },
    ],
    services: [
      {
        _id: 'srv-air',
        name: 'Airport Transfers (BIA / CMB)',
        slug: 'airport-transfers',
        badge: '24/7 Tracking',
        description: 'Direct BIA transfers.',
        icon: 'plane',
        whatsappLabel: 'Airport Transfer (BIA / CMB) service',
      },
    ],
    vehicles: [
      {
        _id: 'veh-1',
        name: '2024 Mercedes-Benz S-Class',
        model: 'S 500 AMG',
        slug: '2024-mercedes-benz-s-class',
        year: 2024,
        categories: [{ _id: 'cat-lux', name: 'Luxury', slug: 'luxury' }],
        description: 'Executive flagship luxury sedan.',
        specs: {
          seats: 5,
          transmission: 'Automatic',
          luggage: '3 Suitcases',
          chauffeur: 'Chauffeur Included',
          airConditioning: true,
        },
        highlights: ['Uniformed Chauffeur'],
        photos: [
          {
            url: '/vehicles/mercedes-s-class.webp',
            alt: 'Mercedes S-Class',
            isPrimary: true,
          },
        ],
        isPublished: true,
        isFeatured: true,
      },
      {
        _id: 'veh-2',
        name: 'Land Rover Defender 110',
        model: 'Defender HSE',
        slug: 'land-rover-defender-110',
        year: 2024,
        categories: [{ _id: 'cat-suv', name: 'SUV', slug: 'suv' }],
        description: 'All-terrain luxury SUV.',
        specs: {
          seats: 5,
          transmission: 'Automatic',
          luggage: '4 Suitcases',
          chauffeur: 'Chauffeur Available',
          airConditioning: true,
        },
        highlights: [],
        photos: [], // Intentionally missing photo to verify fallback
        isPublished: true,
        isFeatured: false,
      },
    ],
  };
}

function renderStorefront(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => payload,
    })
  );

  return render(
    <ThemeProvider>
      <SiteProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </SiteProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  vi.restoreAllMocks();
});

describe('Colombo Tours Storefront UI', () => {
  it('defaults to dark mode, toggles light mode, and persists preference', async () => {
    const user = userEvent.setup();
    renderStorefront(createBootstrapPayload());

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    await user.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('colombo-tours-theme')).toBe('light');
  });

  it('disables all WhatsApp enquiry buttons until a valid number is configured and omits prices/currency', async () => {
    renderStorefront(createBootstrapPayload({ whatsappNumber: '' }));

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    expect(screen.getByTestId('header-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('hero-whatsapp-btn')).toBeDisabled();
    expect(
      screen.getByTestId('vehicle-whatsapp-2024-mercedes-benz-s-class')
    ).toBeDisabled();
    expect(screen.getByTestId('quick-enquiry-whatsapp-btn')).toBeDisabled();
    expect(screen.getByTestId('service-whatsapp-airport-transfers')).toBeDisabled();

    // Ensure no mock pricing or currency toggles leak into DOM
    expect(document.body.textContent).not.toMatch(/Rs\.\s*45,000/i);
    expect(document.body.textContent).not.toMatch(/\bLKR\b/);
    expect(document.body.textContent).not.toMatch(/\bUSD\b/);
  });

  it('builds accurate WhatsApp URLs for vehicles, services, and Quick Enquiry with optional details', async () => {
    const user = userEvent.setup();
    renderStorefront(createBootstrapPayload({ whatsappNumber: '94771234567' }));

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    const mercBtn = screen.getByTestId(
      'vehicle-whatsapp-2024-mercedes-benz-s-class'
    );
    expect(mercBtn.tagName).toBe('A');
    expect(mercBtn.getAttribute('href')).toContain('https://wa.me/94771234567?text=');
    expect(decodeURIComponent(mercBtn.getAttribute('href'))).toContain(
      '2024 Mercedes-Benz S-Class'
    );

    const srvBtn = screen.getByTestId('service-whatsapp-airport-transfers');
    expect(srvBtn.getAttribute('href')).toContain('https://wa.me/94771234567?text=');
    expect(decodeURIComponent(srvBtn.getAttribute('href'))).toContain(
      'Airport Transfer (BIA / CMB) service'
    );

    // Quick enquiry with pickup location & valid dates
    await user.selectOptions(
      screen.getByTestId('quick-enquiry-target'),
      'vehicle:Land Rover Defender 110'
    );
    await user.type(
      screen.getByTestId('quick-enquiry-location'),
      'Colombo City'
    );
    await user.type(screen.getByTestId('quick-enquiry-pickup-date'), '2099-05-10');
    await user.type(screen.getByTestId('quick-enquiry-return-date'), '2099-05-14');

    const qeBtn = screen.getByTestId('quick-enquiry-whatsapp-btn');
    expect(qeBtn.tagName).toBe('A');
    const decodedQe = decodeURIComponent(qeBtn.getAttribute('href'));
    expect(decodedQe).toContain('Land Rover Defender 110');
    expect(decodedQe).toContain('Pickup location: Colombo City');
    expect(decodedQe).toContain('Pickup date: 2099-05-10');
    expect(decodedQe).toContain('Return date: 2099-05-14');

    // Invalid date range disables Quick Enquiry button and shows error
    await user.clear(screen.getByTestId('quick-enquiry-return-date'));
    await user.type(screen.getByTestId('quick-enquiry-return-date'), '2099-05-05');
    expect(screen.getByTestId('quick-enquiry-date-error')).toHaveTextContent(
      /earlier than the pickup date/i
    );
    expect(screen.getByTestId('quick-enquiry-whatsapp-btn')).toBeDisabled();
  });

  it('supports search, category filtering, empty state recovery, missing photo fallback, and specs modal', async () => {
    const user = userEvent.setup();
    renderStorefront(createBootstrapPayload({ whatsappNumber: '94771234567' }));

    await waitFor(() =>
      expect(screen.getByTestId('fleet-grid')).toBeInTheDocument()
    );

    // Missing photo fallback shown for Defender
    expect(screen.getByTestId('missing-photo-fallback')).toBeInTheDocument();

    // Open Vehicle Specs modal
    await user.click(
      screen.getByTestId('vehicle-specs-2024-mercedes-benz-s-class')
    );
    const modal = screen.getByTestId('vehicle-specs-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('3 Suitcases')).toBeInTheDocument();
    expect(within(modal).getByText('Uniformed Chauffeur')).toBeInTheDocument();
    await user.click(screen.getByTestId('close-specs-modal'));
    expect(screen.queryByTestId('vehicle-specs-modal')).not.toBeInTheDocument();

    // Category filter
    await user.click(screen.getByTestId('category-pill-suv'));
    expect(
      screen.queryByTestId('vehicle-card-2024-mercedes-benz-s-class')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('vehicle-card-land-rover-defender-110')
    ).toBeInTheDocument();

    // Empty search state + reset
    const searchInputs = screen.getAllByTestId('fleet-search-input');
    await user.type(searchInputs[0], 'Ferrari');
    expect(screen.getByTestId('empty-fleet-state')).toBeInTheDocument();

    await user.click(screen.getByTestId('reset-filters-btn'));
    expect(
      screen.getByTestId('vehicle-card-2024-mercedes-benz-s-class')
    ).toBeInTheDocument();
  });
});
