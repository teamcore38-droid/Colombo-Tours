import { env } from '../config/env.js';
import { AdminUser } from '../models/AdminUser.js';
import { Category } from '../models/Category.js';
import { Service } from '../models/Service.js';
import { SiteSettings } from '../models/SiteSettings.js';
import { Vehicle } from '../models/Vehicle.js';
import {
  isValidTelegramHandle,
  isValidWeChatId,
  isValidWhatsAppNumber,
  normalizeTelegramHandle,
  normalizeWeChatId,
  normalizeWhatsAppNumber,
} from './channels.js';
import { hashPassword, validateNewPassword } from './password.js';

const STARTER_CATEGORIES = [
  {
    name: 'Luxury',
    slug: 'luxury',
    description: 'Executive flagship sedans and VVIP luxury vehicles.',
    sortOrder: 1,
  },
  {
    name: 'SUV',
    slug: 'suv',
    description: 'Commanding 4x4 SUVs ideal for Colombo, coastal highways, and hill country.',
    sortOrder: 2,
  },
  {
    name: 'Wedding',
    slug: 'wedding',
    description: 'Bridal and ceremony vehicles with uniformed chauffeurs and ribbon-ready presentation.',
    sortOrder: 3,
  },
  {
    name: 'Chauffeur',
    slug: 'chauffeur',
    description: 'Stress-free travel with experienced, English-speaking Sri Lankan chauffeurs.',
    sortOrder: 4,
  },
  {
    name: 'Airport Transfer',
    slug: 'airport-transfer',
    description: 'Punctual meet-and-greet transfers from Bandaranaike International Airport (CMB).',
    sortOrder: 5,
  },
  {
    name: 'Van & Group',
    slug: 'van-group',
    description: 'Executive MPVs and luxury passenger vans for families and delegations.',
    sortOrder: 6,
  },
];

const STARTER_SERVICES = [
  {
    name: 'Airport Transfers (BIA / CMB)',
    slug: 'airport-transfers',
    badge: '24/7 Flight Tracking',
    description:
      'Seamless meet-and-greet pickups from Bandaranaike International Airport to Colombo, Negombo, Galle, Kandy, and island-wide resorts.',
    icon: 'plane',
    whatsappLabel: 'Airport Transfer (BIA / CMB) service',
    sortOrder: 1,
  },
  {
    name: 'Luxury Wedding Car Hire',
    slug: 'wedding-car-hire',
    badge: 'Uniformed Chauffeur',
    description:
      'Immaculately presented luxury bridal sedans and flagship SUVs with early arrival, ribbon-ready styling, and courteous wedding chauffeurs.',
    icon: 'heart',
    whatsappLabel: 'Luxury Wedding Car Hire service',
    sortOrder: 2,
  },
  {
    name: 'Chauffeur-Driven Island Tours',
    slug: 'chauffeur-island-tours',
    badge: 'Island-Wide Coverage',
    description:
      'Tailored multi-day tours across the Cultural Triangle, Ella, Kandy, Yala, and the Southern Coast with vetted English-speaking chauffeurs.',
    icon: 'compass',
    whatsappLabel: 'Chauffeur-Driven Island Tour service',
    sortOrder: 3,
  },
  {
    name: 'Corporate & VIP Concierge',
    slug: 'corporate-vip-concierge',
    badge: 'Executive Fleet',
    description:
      'Discreet, reliable point-to-point and full-day executive transport for business leaders, embassies, and international delegations in Colombo.',
    icon: 'briefcase',
    whatsappLabel: 'Corporate & VIP Concierge service',
    sortOrder: 4,
  },
];

function buildStarterVehicles(catMap) {
  const refs = (...slugs) => slugs.map((s) => catMap[s]).filter(Boolean);

  return [
    {
      name: '2024 BMW i7 xDrive60',
      model: 'BMW i7 Luxury Flagship Sedan',
      slug: '2024-bmw-i7-xdrive60',
      year: 2024,
      categories: refs('luxury', 'chauffeur', 'airport-transfer', 'wedding'),
      summary:
        'Whisper-quiet all-electric flagship luxury crafted for diplomatic arrivals and executive Colombo journeys.',
      description:
        'Experience Sri Lanka in hushed comfort aboard our flagship 2024 BMW i7. Equipped with executive rear lounge seating, ambient sky-lounge lighting, and a dedicated English-speaking chauffeur for airport transfers, corporate movements, and prestige weddings.',
      specs: {
        seats: 4,
        transmission: 'Automatic',
        luggage: '3 Suitcases',
        chauffeur: 'Chauffeur Included',
        fuelType: 'Electric',
        airConditioning: true,
      },
      highlights: [
        'Executive Rear Lounge Seating',
        'English-Speaking Uniformed Chauffeur',
        'Complimentary Bottled Water & Wi-Fi',
        'Flight-Tracked Airport Meet & Greet',
      ],
      photos: [
        {
          url: '/vehicles/bmw-i7-card.webp',
          alt: '2024 BMW i7 xDrive60 luxury sedan in obsidian black studio',
          storageProvider: 'static',
          isPrimary: true,
        },
        {
          url: '/vehicles/bmw-i7-hero.webp',
          alt: '2024 BMW i7 xDrive60 wide studio showcase',
          storageProvider: 'static',
          isPrimary: false,
        },
      ],
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      name: '2024 Mercedes-Benz S-Class',
      model: 'Mercedes-Benz S 500 AMG Line',
      slug: '2024-mercedes-benz-s-class',
      year: 2024,
      categories: refs('luxury', 'wedding', 'chauffeur', 'airport-transfer'),
      summary:
        'The unmistakable benchmark for executive chauffeur travel, red-carpet weddings, and VIP airport arrivals.',
      description:
        'Our jet-black 2024 Mercedes-Benz S-Class pairs signature German refinement with effortless air-suspension comfort across Colombo and coastal expressways. Ideal for wedding entrances, C-suite itineraries, and luxury hotel transfers.',
      specs: {
        seats: 5,
        transmission: 'Automatic',
        luggage: '3 Suitcases',
        chauffeur: 'Chauffeur Included',
        fuelType: 'Mild Hybrid',
        airConditioning: true,
      },
      highlights: [
        'Burmester Surround Sound & Ambient Cabin',
        'Nappa Leather Executive Interior',
        'Uniformed English-Speaking Chauffeur',
        'Ribbon-Ready for Luxury Weddings',
      ],
      photos: [
        {
          url: '/vehicles/mercedes-s-class.webp',
          alt: '2024 Mercedes-Benz S-Class in jet black',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      name: 'Land Rover Defender 110',
      model: 'Land Rover Defender 110 HSE',
      slug: 'land-rover-defender-110',
      year: 2024,
      categories: refs('suv', 'luxury', 'chauffeur', 'wedding'),
      summary:
        'Iconic all-terrain presence combining British craftsmanship with commanding comfort for island-wide adventures.',
      description:
        'From Colombo city engagements to tea-estate retreats in Nuwara Eliya and safari lodges near Yala, the Land Rover Defender 110 delivers unmistakable style, elevated visibility, and effortless poise on every Sri Lankan road.',
      specs: {
        seats: 5,
        transmission: 'Automatic',
        luggage: '4 Suitcases',
        chauffeur: 'Chauffeur Available',
        fuelType: 'Diesel / Hybrid',
        airConditioning: true,
      },
      highlights: [
        'Full 4WD Hill-Country Capability',
        'Panoramic Roof & Elevated Seating',
        'Available Chauffeur-Driven or Approved Self-Drive',
        'Generous Luggage Bay for Round Tours',
      ],
      photos: [
        {
          url: '/vehicles/land-rover-defender.webp',
          alt: 'Land Rover Defender 110 in dark Carpathian grey',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: false,
      sortOrder: 3,
    },
    {
      name: 'Range Rover Autobiography',
      model: 'Range Rover Autobiography LWB',
      slug: 'range-rover-autobiography',
      year: 2024,
      categories: refs('suv', 'luxury', 'wedding', 'chauffeur'),
      summary:
        'Sovereign luxury SUV prestige with first-class cabin serenity for VIP guests, weddings, and scenic tours.',
      description:
        'Finished in metallic champagne-pewter, the Range Rover Autobiography offers effortless authority and serene air-ride refinement whether arriving at a grand Colombo reception or cruising down the Southern Expressway to Galle.',
      specs: {
        seats: 5,
        transmission: 'Automatic',
        luggage: '4 Suitcases',
        chauffeur: 'Chauffeur Included',
        fuelType: 'Hybrid',
        airConditioning: true,
      },
      highlights: [
        'Executive Reclining Rear Seats',
        'Multi-Zone Climate Control',
        'Dedicated VIP Chauffeur Service',
        'Ideal for Luxury Weddings & Private Resorts',
      ],
      photos: [
        {
          url: '/vehicles/range-rover-autobiography.webp',
          alt: 'Range Rover Autobiography in metallic champagne silver',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: true,
      sortOrder: 4,
    },
    {
      name: 'Toyota Land Cruiser Prado',
      model: 'Toyota Land Cruiser Prado 250 VX',
      slug: 'toyota-land-cruiser-prado',
      year: 2024,
      categories: refs('suv', 'chauffeur', 'airport-transfer'),
      summary:
        'Sri Lanka’s trusted executive 4x4 SUV for multi-day hill-country tours, family holidays, and VIP convoys.',
      description:
        'Renowned across Sri Lanka for rock-solid reliability and plush long-distance ride quality, our 2024 Land Cruiser Prado accommodates up to 7 passengers comfortably for Kandy, Sigiriya, Ella, and Yala itineraries.',
      specs: {
        seats: 7,
        transmission: 'Automatic',
        luggage: '4 Suitcases',
        chauffeur: 'Chauffeur Available',
        fuelType: 'Diesel',
        airConditioning: true,
      },
      highlights: [
        '7-Seater Dual A/C Cabin',
        'Proven Hill-Country & Highway Comfort',
        'Chauffeur-Driven or Qualified Self-Drive',
        'Child Seat Available on Request',
      ],
      photos: [
        {
          url: '/vehicles/toyota-prado.webp',
          alt: '2024 Toyota Land Cruiser Prado in obsidian black',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: false,
      sortOrder: 5,
    },
    {
      name: 'Mercedes-Benz E-Class Bridal',
      model: 'Mercedes-Benz E 300 Wedding Edition',
      slug: 'mercedes-benz-e-class-bridal',
      year: 2024,
      categories: refs('wedding', 'luxury', 'chauffeur'),
      summary:
        'Pearl diamond white bridal sedan meticulously prepared for Sri Lankan weddings, homecomings, and gala arrivals.',
      description:
        'Presented in luminous pearl white with a poised uniformed chauffeur, our Mercedes-Benz E-Class Bridal Edition arrives early, spotless, and ready to coordinate with your wedding florist for timeless ceremony photography.',
      specs: {
        seats: 4,
        transmission: 'Automatic',
        luggage: '2 Suitcases',
        chauffeur: 'Chauffeur Included',
        fuelType: 'Mild Hybrid',
        airConditioning: true,
      },
      highlights: [
        'Pearl Diamond White Bridal Finish',
        'Florist & Ribbon Coordination Friendly',
        'Attire-Compliant Uniformed Chauffeur',
        'Guaranteed Early Arrival for Photography',
      ],
      photos: [
        {
          url: '/vehicles/mercedes-e-class-wedding.webp',
          alt: 'Pearl white Mercedes-Benz E-Class Bridal Wedding Edition',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: false,
      sortOrder: 6,
    },
    {
      name: 'Toyota Alphard Executive Lounge',
      model: 'Toyota Alphard VIP MPV',
      slug: 'toyota-alphard-executive-lounge',
      year: 2024,
      categories: refs('van-group', 'airport-transfer', 'chauffeur', 'luxury'),
      summary:
        'First-class private jet comfort on wheels with captain seats for VIP airport transfers and family tours.',
      description:
        'Designed for discerning families, bridal entourages, and corporate groups, the Toyota Alphard Executive Lounge features plush reclining Ottoman captain chairs, twin power sliding doors, and generous suitcase capacity.',
      specs: {
        seats: 6,
        transmission: 'Automatic',
        luggage: '5 Suitcases',
        chauffeur: 'Chauffeur Included',
        fuelType: 'Hybrid',
        airConditioning: true,
      },
      highlights: [
        'Reclining Ottoman Captain Chairs',
        'Twin Electric Sliding Doors',
        'Ample Luggage Room for Airport Arrivals',
        'Dedicated English-Speaking Chauffeur',
      ],
      photos: [
        {
          url: '/vehicles/toyota-alphard-vip.webp',
          alt: 'Obsidian black Toyota Alphard Executive Lounge VIP MPV',
          storageProvider: 'static',
          isPrimary: true,
        },
      ],
      isPublished: true,
      isFeatured: false,
      sortOrder: 7,
    },
  ];
}

let bootstrapPromise = null;

export async function ensureBaseSetup({ forceSeedFleet = false } = {}) {
  // 1. Ensure initial admin user exists
  const adminCount = await AdminUser.countDocuments();
  if (adminCount === 0) {
    if (env.isProduction) {
      const check = validateNewPassword(env.adminPassword, {
        email: env.adminEmail,
      });
      if (!check.valid) {
        throw new Error(
          `Cannot bootstrap initial production admin account: ${check.error} Set a strong ADMIN_PASSWORD environment variable (never ChangeMe123!).`
        );
      }
    }
    const passwordHash = await hashPassword(env.adminPassword);
    await AdminUser.create({
      email: env.adminEmail,
      passwordHash,
      name: env.adminName,
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
    });
  }

  // 2. Ensure singleton site settings exists (booking channels empty unless configured via env)
  let settings = await SiteSettings.findOne({ key: 'global' });
  if (!settings) {
    const initialWhatsApp = isValidWhatsAppNumber(env.defaultWhatsappNumber)
      ? normalizeWhatsAppNumber(env.defaultWhatsappNumber)
      : '';
    const initialTelegram = isValidTelegramHandle(env.defaultTelegramHandle)
      ? normalizeTelegramHandle(env.defaultTelegramHandle)
      : '';
    const initialWeChat = isValidWeChatId(env.defaultWeChatId)
      ? normalizeWeChatId(env.defaultWeChatId)
      : '';
    settings = await SiteSettings.create({
      key: 'global',
      whatsappNumber: initialWhatsApp,
      telegramHandle: initialTelegram,
      wechatId: initialWeChat,
    });
  }

  // 3. Seed starter Sri Lankan fleet/categories/services only if database is empty
  if (forceSeedFleet || env.seedOnEmpty) {
    const [catCount, vehicleCount, serviceCount] = await Promise.all([
      Category.countDocuments(),
      Vehicle.countDocuments(),
      Service.countDocuments(),
    ]);

    if (catCount === 0 && vehicleCount === 0) {
      const insertedCats = await Category.insertMany(STARTER_CATEGORIES);
      const catMap = Object.fromEntries(
        insertedCats.map((c) => [c.slug, c._id])
      );
      await Vehicle.insertMany(buildStarterVehicles(catMap));
    }

    if (serviceCount === 0) {
      await Service.insertMany(STARTER_SERVICES);
    }
  }

  return settings;
}

/**
 * Idempotent once-per-process bootstrap for serverless cold starts & local startup.
 */
export function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureBaseSetup().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}

export function resetBootstrapCache() {
  bootstrapPromise = null;
}
