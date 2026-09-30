import { ALL_MASTER_PLACES_1000, GEOGRAPHICAL_CLUSTERS } from './masterPlacesIndex';
import { CHENNAI_FOOD_GEMS_300, FoodGem } from './foodGems300';
import { CHENNAI_ARCHITECTURE_CORPUS } from './architectureCorpus';
import { MasterPlace, Discovery } from '../types';

export interface UnifiedMapSpot {
  id: string;
  type: 'heritage' | 'food' | 'architecture';
  number: number;
  name: string;
  category: string;
  categoryKey: 'heritage' | 'food' | 'architecture' | 'temple' | 'nature' | 'secret' | 'arts';
  cluster: string;
  neighborhood: string;
  lat: number;
  lng: number;
  xp: number;
  subtitle: string;
  lore: string;
  imageUrl: string;
  architecturalStyle?: string;
  specialty?: string;
  openHours?: string;
  audioGuideScript?: string;
  soundscapeType?: 'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'monsoon-rain' | 'belfry';
  masterPlaceRef?: MasterPlace;
  foodGemRef?: FoodGem;
}


// Convert Master Heritage Places (1000+) into UnifiedMapSpot
const heritageSpots: UnifiedMapSpot[] = ALL_MASTER_PLACES_1000.map((mp) => {
  let soundscape: 'temple-chimes' | 'filter-coffee' | 'marina-waves' | 'monsoon-rain' | 'belfry' = 'temple-chimes';
  if (mp.name.toLowerCase().includes('beach') || mp.name.toLowerCase().includes('marina') || mp.name.toLowerCase().includes('port') || mp.name.toLowerCase().includes('elliot')) {
    soundscape = 'marina-waves';
  } else if (mp.name.toLowerCase().includes('church') || mp.name.toLowerCase().includes('cathedral') || mp.name.toLowerCase().includes('basilica')) {
    soundscape = 'belfry';
  } else if (mp.categoryKey === 'food' || mp.name.toLowerCase().includes('mess') || mp.name.toLowerCase().includes('cafe')) {
    soundscape = 'filter-coffee';
  }

  return {
    id: `heritage-${mp.id}`,
    type: 'heritage',
    number: mp.number,
    name: mp.name,
    category: mp.category,
    categoryKey: mp.categoryKey,
    cluster: mp.cluster,
    neighborhood: mp.zone || mp.cluster,
    lat: mp.lat,
    lng: mp.lng,
    xp: mp.xp || 100,
    subtitle: mp.locator || mp.cluster,
    lore: mp.lore || mp.fullStory || 'Historical heritage landmark in Chennai.',
    imageUrl: mp.imageUrl || 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: mp.architecturalStyle,
    openHours: '06:00 AM – 08:30 PM',
    audioGuideScript: `Welcome to ${mp.name}. ${mp.lore} Observe the intricate craftsmanship and regional historical context.`,
    soundscapeType: soundscape,
    masterPlaceRef: mp,
  };
});

// Convert Food Gems (300) into UnifiedMapSpot
const foodSpots: UnifiedMapSpot[] = CHENNAI_FOOD_GEMS_300.map((fg) => {
  return {
    id: `food-${fg.id}`,
    type: 'food',
    number: fg.number,
    name: fg.name,
    category: fg.category,
    categoryKey: 'food',
    cluster: fg.cluster,
    neighborhood: fg.neighborhood,
    lat: fg.lat,
    lng: fg.lng,
    xp: fg.xp || 90,
    subtitle: fg.specialty,
    lore: fg.lore,
    specialty: fg.specialty,
    imageUrl: fg.category === 'Biryani & Non-Veg'
      ? 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80'
      : fg.category === 'Seafood & Coastal'
      ? 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80'
      : fg.category === 'Sweets & Chaat'
      ? 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    openHours: '07:00 AM – 10:30 PM',
    audioGuideScript: `You are approaching ${fg.name} in ${fg.neighborhood}. Famous for ${fg.specialty}. ${fg.lore}`,
    soundscapeType: 'filter-coffee',
    foodGemRef: fg,
  };
});

// Convert Architecture Corpus into UnifiedMapSpot
const architectureSpots: UnifiedMapSpot[] = [
  {
    id: 'arch-1',
    type: 'architecture',
    number: 601,
    name: 'Chepauk Palace (Kalas Mahal)',
    category: 'Indo-Saracenic Masterpiece',
    categoryKey: 'architecture',
    cluster: 'Marina, Chepauk & Triplicane',
    neighborhood: 'Chepauk',
    lat: 13.0642,
    lng: 80.2811,
    xp: 150,
    subtitle: 'First Indo-Saracenic Palace in India (1768)',
    lore: 'Designed by Paul Benfield for the Nawab of Arcot. Marked the birth of Indo-Saracenic architecture in British India.',
    imageUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'Indo-Saracenic with Mughal Domes',
    openHours: '09:30 AM – 05:30 PM',
    soundscapeType: 'temple-chimes',
  },
  {
    id: 'arch-2',
    type: 'architecture',
    number: 602,
    name: 'Senate House (University of Madras)',
    category: 'Indo-Saracenic Masterpiece',
    categoryKey: 'architecture',
    cluster: 'Marina, Chepauk & Triplicane',
    neighborhood: 'Marina Promenade',
    lat: 13.0678,
    lng: 80.2838,
    xp: 160,
    subtitle: 'Robert Chisholm’s 1879 Magnum Opus',
    lore: 'Features Byzantine stone vaults, crimson stained glass rosettes, and minarets inspired by Mughal aesthetics.',
    imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bbaa?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'Byzantine-Indo-Saracenic',
    openHours: '10:00 AM – 05:00 PM',
    soundscapeType: 'marina-waves',
  },
  {
    id: 'arch-3',
    type: 'architecture',
    number: 603,
    name: 'Madras High Court & Small Causes Court',
    category: 'Indo-Saracenic Masterpiece',
    categoryKey: 'architecture',
    cluster: 'Fort, George Town & North Beach',
    neighborhood: 'High Court Road, George Town',
    lat: 13.0884,
    lng: 80.2877,
    xp: 175,
    subtitle: 'Henry Irwin & J.W. Brassington (1892)',
    lore: 'Second largest judicial complex in the world. Features ornamental red brick minarets and an active lighthouse tower.',
    imageUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'High Victorian Indo-Saracenic',
    openHours: '10:00 AM – 05:00 PM',
    soundscapeType: 'belfry',
  },
  {
    id: 'arch-4',
    type: 'architecture',
    number: 604,
    name: 'Victoria Public Hall (Town Hall)',
    category: 'Indo-Saracenic Masterpiece',
    categoryKey: 'architecture',
    cluster: 'Park Town, Central & Egmore',
    neighborhood: 'EVR Periyar Salai, Park Town',
    lat: 13.0825,
    lng: 80.2742,
    xp: 140,
    subtitle: 'Robert Chisholm (1888)',
    lore: 'Historic Victorian town hall where Swami Vivekananda delivered legendary lectures and early Tamil cinema was screened.',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'Romanesque-Saracenic with Trefoil Arches',
    openHours: '09:00 AM – 06:00 PM',
    soundscapeType: 'belfry',
  },
  {
    id: 'arch-5',
    type: 'architecture',
    number: 605,
    name: 'Ripon Building (Greater Chennai Corporation)',
    category: 'Neoclassical Landmark',
    categoryKey: 'architecture',
    cluster: 'Park Town, Central & Egmore',
    neighborhood: 'Raja Muthiah Road, Periamet',
    lat: 13.0829,
    lng: 80.2731,
    xp: 150,
    subtitle: 'G.S.T. Harris (1913)',
    lore: 'Immaculate all-white neoclassical palace housing the civic headquarters of Greater Chennai Corporation with Westminster clock chimes.',
    imageUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'Neoclassical Ionic & Corinthian',
    openHours: '09:00 AM – 06:00 PM',
    soundscapeType: 'belfry',
  },
  {
    id: 'arch-6',
    type: 'architecture',
    number: 606,
    name: 'Dare House',
    category: 'Art Deco Masterpiece',
    categoryKey: 'architecture',
    cluster: 'Fort, George Town & North Beach',
    neighborhood: 'Parry’s Corner, NSC Bose Road',
    lat: 13.0895,
    lng: 80.2894,
    xp: 145,
    subtitle: 'Streamline Moderne Headquarters (1940)',
    lore: 'Art Deco commercial landmark built for the EID Parry company with sharp vertical fluting and nautical aerodynamic curves.',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600&auto=format&fit=crop&q=80',
    architecturalStyle: 'Art Deco / Streamline Moderne',
    openHours: '08:30 AM – 07:00 PM',
    soundscapeType: 'marina-waves',
  },
];

// Complete combined master corpus of 600+ places
export const ALL_UNIFIED_MAP_SPOTS: UnifiedMapSpot[] = [
  ...heritageSpots,
  ...foodSpots,
  ...architectureSpots,
];

// Preset Curated Expeditions for quick 1-tap route planning
export interface CuratedExpeditionPreset {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  cluster: string;
  travelMode: 'WALKING' | 'TRANSIT' | 'DRIVING';
  spotIds: string[];
  estimatedDistance: string;
  estimatedDuration: string;
  xpReward: number;
  highlightCategory: string;
  bannerImage: string;
}

export const CURATED_EXPEDITION_PRESETS: CuratedExpeditionPreset[] = [
  {
    id: 'exp-george-town-bastions',
    title: 'George Town Bastion & Spice Alley Trail',
    subtitle: 'Fort St. George to High Court & Sowcarpet Tiffin',
    tagline: 'Colonial 1639 bastions, Armenian bells, and sizzling ghee podi uthappams',
    cluster: 'Fort, George Town & North Beach',
    travelMode: 'WALKING',
    spotIds: ['heritage-mp-1', 'heritage-mp-12', 'food-fg-41', 'arch-arch-3', 'food-fg-42'],
    estimatedDistance: '2.8 km',
    estimatedDuration: '45 mins walking',
    xpReward: 380,
    highlightCategory: 'Heritage & Food',
    bannerImage: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'exp-mylapore-sacred-tiffin',
    title: 'Mylapore Sacred Gopuram & Tiffin Circuit',
    subtitle: 'Kapaleeshwarar to Karpagambal Mess & Santhome Crypt',
    tagline: '7th-century Dravidian granite sanctums and 80:20 filter coffee aromas',
    cluster: 'Mylapore & Santhome',
    travelMode: 'WALKING',
    spotIds: ['heritage-mp-121', 'food-fg-1', 'food-fg-3', 'heritage-mp-123', 'heritage-mp-130'],
    estimatedDistance: '3.2 km',
    estimatedDuration: '50 mins walking',
    xpReward: 420,
    highlightCategory: 'Sacred & Culinary',
    bannerImage: 'https://images.unsplash.com/photo-1548013146-72479768bbaa?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'exp-marina-triplicane-biryani',
    title: 'Marina Beach & Triplicane Dum Biryani Walk',
    subtitle: 'Senate House to Ratna Cafe & Buhari Mount Road',
    tagline: 'Coromandel coastal sea breezes, Arcot palace gates, and unlimited sambar mugs',
    cluster: 'Marina, Chepauk & Triplicane',
    travelMode: 'WALKING',
    spotIds: ['arch-arch-2', 'food-fg-21', 'food-fg-23', 'heritage-mp-82', 'food-fg-26'],
    estimatedDistance: '3.6 km',
    estimatedDuration: '55 mins walking',
    xpReward: 450,
    highlightCategory: 'Coastal & Biryani',
    bannerImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'exp-indo-saracenic-architecture',
    title: 'Indo-Saracenic Architecture Corridor',
    subtitle: 'Victoria Public Hall to Madras High Court & Senate House',
    tagline: 'The revolutionary Victorian-Islamic-Dravidian architectural movement born in Madras',
    cluster: 'Park Town, Central & Egmore',
    travelMode: 'TRANSIT',
    spotIds: ['arch-arch-4', 'arch-arch-5', 'arch-arch-3', 'arch-arch-2', 'arch-arch-1'],
    estimatedDistance: '5.4 km',
    estimatedDuration: '30 mins transit',
    xpReward: 500,
    highlightCategory: 'Architecture Masterpieces',
    bannerImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'exp-sowcarpet-food-crawl',
    title: 'Sowcarpet Street Food & Chaat Crawl',
    subtitle: 'Kakada Ramprasad to Murukku Sandwiches & Kesar Lassi',
    tagline: 'A whirlwind journey through the narrow bazaar alleys tasting 10 classic dishes',
    cluster: 'Fort, George Town & North Beach',
    travelMode: 'WALKING',
    spotIds: ['food-fg-42', 'food-fg-48', 'food-fg-45', 'food-fg-46', 'food-fg-51'],
    estimatedDistance: '1.9 km',
    estimatedDuration: '35 mins walking',
    xpReward: 350,
    highlightCategory: 'Street Food & Sweets',
    bannerImage: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
  },
];

// Helper to convert UnifiedMapSpot to Discovery for Dossier / Quest modals
export function mapSpotToDiscovery(spot: UnifiedMapSpot): Discovery {
  return {
    id: spot.id,
    title: spot.name,
    category: spot.category,
    categoryKey: spot.type === 'food' ? 'food' : spot.type === 'architecture' ? 'architecture' : 'heritage',
    zone: spot.neighborhood || spot.cluster,
    distance: `${(Math.random() * 2 + 0.3).toFixed(1)} km away`,
    duration: spot.type === 'food' ? '20 mins' : '45 mins',
    provenance: spot.type === 'heritage' ? 'ASI Registered Historic Site' : spot.type === 'architecture' ? 'Heritage Architecture Registry' : 'Chennai Street Food Heritage',
    imageUrl: spot.imageUrl,
    description: spot.lore,
    fullStory: spot.lore,
    openHours: spot.openHours || '07:00 AM – 09:00 PM',
    xp: spot.xp,
    curator: 'Chennai Heritage & Food Guild',
    coordinates: { lat: spot.lat, lng: spot.lng },
    architecturalStyle: spot.architecturalStyle,
    audioGuideScript: spot.audioGuideScript,
    soundscapeType: spot.soundscapeType || 'temple-chimes',
  };
}
