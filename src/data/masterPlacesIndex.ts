import { MasterPlace } from '../types';
import { masterPlaces1to100 } from './masterPlaces1to100';
import { masterPlaces101to200 } from './masterPlaces101to200';
import { masterPlaces201to300 } from './masterPlaces201to300';
import { masterPlaces301to500 } from './masterPlaces301to500';
import { masterPlaces501to700 } from './masterPlaces501to700';
import { masterPlaces701to1000 } from './masterPlaces701to1000';

export const ALL_MASTER_PLACES_300: MasterPlace[] = [
  ...masterPlaces1to100,
  ...masterPlaces101to200,
  ...masterPlaces201to300,
];

export const ALL_MASTER_PLACES_1000: MasterPlace[] = [
  ...masterPlaces1to100,
  ...masterPlaces101to200,
  ...masterPlaces201to300,
  ...masterPlaces301to500,
  ...masterPlaces501to700,
  ...masterPlaces701to1000,
];

export interface GeographicalCluster {
  id: string;
  name: string;
  shortName: string;
  range: string;
  count: number;
  icon: string;
  tagline: string;
  color: string;
  centerLat: number;
  centerLng: number;
  featuredThemes: string[];
}

export const GEOGRAPHICAL_CLUSTERS: GeographicalCluster[] = [
  {
    id: 'fort-george-town',
    name: '1–40: Fort, George Town & North Beach',
    shortName: 'George Town & Fort',
    range: 'Places #1 – #40',
    count: 40,
    icon: 'fort',
    tagline: 'Colonial bastions, Armenian bells, and 17th-century mercantile spice streets',
    color: '#f97316',
    centerLat: 13.0878,
    centerLng: 80.2872,
    featuredThemes: ['Colonial Bastions', 'Armenian Heritage', 'Wholesale Spice Alleys', 'Victorian Gothic GPO'],
  },
  {
    id: 'central-egmore',
    name: '41–80: Park Town, Central, Egmore & Chintadripet',
    shortName: 'Central & Egmore',
    range: 'Places #41 – #80',
    count: 40,
    icon: 'account_balance',
    tagline: 'Chisholm clock towers, Chola bronze museum, and historic railway corridors',
    color: '#3b82f6',
    centerLat: 13.0781,
    centerLng: 80.2612,
    featuredThemes: ['Indo-Saracenic Towers', 'Chola Bronzes', 'Connemara Vaults', 'Weaver Settlements'],
  },
  {
    id: 'marina-triplicane',
    name: '81–120: Marina, Chepauk & Triplicane',
    shortName: 'Marina & Triplicane',
    range: 'Places #81 – #120',
    count: 40,
    icon: 'waves',
    tagline: 'World’s 2nd longest beach, 80:20 filter coffee roasters, and Arcot palaces',
    color: '#10b981',
    centerLat: 13.0544,
    centerLng: 80.2815,
    featuredThemes: ['Coromandel Coast', 'Senate House Rosettes', '1924 Coffee Roasters', 'Pallava Sanctum'],
  },
  {
    id: 'mylapore-santhome',
    name: '121–160: Mylapore & Santhome',
    shortName: 'Mylapore & Santhome',
    range: 'Places #121 – #160',
    count: 40,
    icon: 'temple_hindu',
    tagline: 'Kapaleeshwarar rainbow gopuram, ancient agraharams, and apostolic basilica crypt',
    color: '#eab308',
    centerLat: 13.0335,
    centerLng: 80.2715,
    xpBonus: 200,
    featuredThemes: ['Dravidian Gopurams', 'Apostolic Crypts', 'Carnatic Music Sabhas', 'Sacred Teppakulams'],
  } as any,
  {
    id: 'royapettah-nungambakkam',
    name: '161–200: Royapettah, Gopalapuram, Teynampet & Nungambakkam',
    shortName: 'Nungambakkam & T. Nagar',
    range: 'Places #161 – #200',
    count: 40,
    icon: 'apartment',
    tagline: 'Thousand Lights domes, Valluvar Kottam stone chariot, and silk avenues',
    color: '#ec4899',
    centerLat: 13.0455,
    centerLng: 80.2415,
    featuredThemes: ['Art Deco Towers', 'Silk & Gold Avenues', 'Music Academy', 'Stone Temple Chariots'],
  },
  {
    id: 'guindy-adyar',
    name: '201–235: Guindy, Saidapet & Adyar',
    shortName: 'Guindy & Adyar',
    range: 'Places #201 – #235',
    count: 35,
    icon: 'park',
    tagline: 'Urban national park blackbucks, 450-year-old banyan tree, and Elliot’s beach',
    color: '#14b8a6',
    centerLat: 13.0075,
    centerLng: 80.2525,
    featuredThemes: ['Wild Blackbuck Herds', 'Theosophical Banyan', 'Schmidt Memorial', 'St. Thomas Summit'],
  },
  {
    id: 'south-chennai',
    name: '236–260: Thiruvanmiyur, Velachery & South Chennai',
    shortName: 'South Chennai & Velachery',
    range: 'Places #236 – #260',
    count: 25,
    icon: 'wb_sunny',
    tagline: 'Kalakshetra classical dance gurukulam, Valmiki temples, and Pallikaranai marsh',
    color: '#8b5cf6',
    centerLat: 12.9845,
    centerLng: 80.2588,
    featuredThemes: ['Kalakshetra Dance', 'Medicinal Shiva Shrines', 'Broken Bridge Estuary', 'Ramsar Wetlands'],
  },
  {
    id: 'north-chennai',
    name: '261–280: North Chennai, Royapuram & Perambur',
    shortName: 'North Chennai & Royapuram',
    range: 'Places #261 – #280',
    count: 20,
    icon: 'train',
    tagline: 'India’s oldest 1856 railway station, 4 AM Kasimedu fish auction, and steam workshops',
    color: '#f43f5e',
    centerLat: 13.1075,
    lng: 80.2942,
    centerLng: 80.2942,
    featuredThemes: ['1856 First Railway Portico', 'Kasimedu Deep Sea Port', 'Historic Steam Sheds', 'Spicy Biryani Deghs'],
  } as any,
  {
    id: 'west-ecr',
    name: '281–300: West/Northwest Chennai & ECR',
    shortName: 'West Chennai & ECR Coastal',
    range: 'Places #281 – #300',
    count: 20,
    icon: 'palette',
    tagline: 'Asia’s 295-acre wholesale bazaar, Cholamandal artists’ village, and DakshinaChitra',
    color: '#06b6d4',
    centerLat: 12.8255,
    centerLng: 80.2415,
    featuredThemes: ['Artists Commune', 'DakshinaChitra Heritage', 'Midnight Flower Market', 'Kovalam Surfing Point'],
  },
];

export const getPlacesByCluster = (clusterKey: string): MasterPlace[] => {
  if (!clusterKey || clusterKey === 'all') return ALL_MASTER_PLACES_1000;
  return ALL_MASTER_PLACES_1000.filter((p) => p.clusterKey === clusterKey);
};

export const getPlaceByNumber = (num: number): MasterPlace | undefined => {
  return ALL_MASTER_PLACES_1000.find((p) => p.number === num);
};

export const searchMasterPlaces = (searchTerm: string): MasterPlace[] => {
  if (!searchTerm.trim()) return ALL_MASTER_PLACES_1000;
  const q = searchTerm.toLowerCase().trim();

  // Check if searching by number like "#121" or "121"
  const numberMatch = q.match(/^#?(\d+)$/);
  if (numberMatch) {
    const targetNum = parseInt(numberMatch[1], 10);
    const found = ALL_MASTER_PLACES_1000.find((p) => p.number === targetNum);
    if (found) return [found];
  }

  return ALL_MASTER_PLACES_1000.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.locator.toLowerCase().includes(q) ||
      p.zone.toLowerCase().includes(q) ||
      p.cluster.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.architecturalStyle && p.architecturalStyle.toLowerCase().includes(q)) ||
      p.lore.toLowerCase().includes(q)
    );
  });
};
