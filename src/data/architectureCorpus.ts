export interface ArchitectureMovement {
  id: string;
  name: string;
  era: string;
  icon: string;
  color: string;
  description: string;
  keyElements: string[];
  keySites: string[];
}

export const CHENNAI_ARCHITECTURE_CORPUS: ArchitectureMovement[] = [
  {
    id: 'ancient-dravidian',
    name: 'Ancient & Traditional Dravidian Architecture',
    era: '7th – 16th Century (Pallava, Chola, Vijayanagara)',
    icon: 'temple_hindu',
    color: '#eab308',
    description: 'Pyramidal stone gopurams, thousand-pillared mandapams, carved granite yali pillars, and expansive sacred stepped tanks (Teppakulams).',
    keyElements: ['Granite Sanctums', 'Soaring Gopuram Stucco', 'Water Teppakulam Engineering', 'Agraharam Streetscapes'],
    keySites: [
      'Kapaleeshwarar Temple (Mylapore)',
      'Parthasarathy Temple (Triplicane)',
      'Marundeeswarar Temple (Thiruvanmiyur)',
      'Dhandeeswaram Temple (Velachery)',
      'Kandaswamy Temple (George Town)',
      'Chitrakulam Stepped Tank (Mylapore)',
      'Tiruvottiyur Thyagarajaswamy Temple',
    ],
  },
  {
    id: 'indo-saracenic',
    name: 'Colonial & Indo-Saracenic Masterpieces',
    era: '1768 – 1920 (Robert Chisholm, Henry Irwin, Paul Benfield)',
    icon: 'domain',
    color: '#ef4444',
    description: 'The architectural style born in Madras, fusing Byzantine stone vaults and Islamic arches with Mughal domes and Victorian brickwork.',
    keyElements: ['Crimson Rose Stained Glass', 'Red Oxide Brickwork', 'Byzantine Vaulting', 'Canted Overhanging Chhajjas'],
    keySites: [
      'Chepauk Palace (First Indo-Saracenic in India, 1768)',
      'Senate House (Robert Chisholm Masterwork, 1879)',
      'Madras High Court (Henry Irwin, 1892)',
      'Victoria Public Hall & Ripon Building',
      'General Post Office (Robert Chisholm Twin Towers)',
      'Southern Railway Headquarters & Central Station',
      'National Art Gallery (Fatehpur Sikri Sandstone)',
    ],
  },
  {
    id: 'art-deco',
    name: 'Art Deco & Early Modern Chennai',
    era: '1930s – 1950s',
    icon: 'apartment',
    color: '#ec4899',
    description: 'Streamline Moderne residential villas and commercial monolithic clock towers featuring geometric bands, porthole windows, and curved verandas.',
    keyElements: ['Streamline Moderne Curves', 'Porthole Balconies', 'Geometric Fascias', 'Red Oxide & Terrazzo Floors'],
    keySites: [
      'Dare House (Parry’s Corner, 1940)',
      'Royapettah Freestanding Clock Tower (1930s)',
      'Mylapore & Gopalapuram Art Deco Villas',
      'The Hindu Historic Building (Mount Road)',
      'Music Academy Madras (TTK Road)',
      'T. Nagar Panagal Park Commercial Facades',
    ],
  },
  {
    id: 'mercantile-courtyard',
    name: 'George Town Mercantile & Traditional Agraharam Houses',
    era: '17th – 19th Century',
    icon: 'storefront',
    color: '#f97316',
    description: 'Black Town trader row-houses, high-ceiling godowns, timber thinnai verandas, inner central muttram courtyards, and Chettinad timber columns.',
    keyElements: ['Open Sky Muttram Courtyards', 'Carved Teak Pillars', 'Athangudi Tiled Floors', 'Street-Facing Thinnai Benches'],
    keySites: [
      'Mylapore & Triplicane Traditional Agraharams',
      'Sowcarpet Haveli-Style Residences & Jain Temples',
      'Armenian Street Commercial Godowns',
      'Big Street Triplicane Timber Mansions',
      'Chettinad Palace (R.A. Puram)',
    ],
  },
  {
    id: 'modernist-cultural',
    name: 'Modernist, Institutional & Cultural Architecture',
    era: '1960s – Present',
    icon: 'palette',
    color: '#06b6d4',
    description: 'Visionary open-air communes, cultural institutions, modernist spiral towers, and living heritage architecture.',
    keyElements: ['Cantilevered Spirals', 'Exposed Concrete & Granite', 'Vernacular Transplanted Dwellings', 'Landscape-Integrated Campuses'],
    keySites: [
      'Cholamandal Artists’ Village (Open-air Commune, 1966)',
      'DakshinaChitra Living Heritage Museum',
      'Anna Nagar 135-ft Cantilevered Spiral Tower (1968)',
      'Valluvar Kottam 128-ft Granite Chariot',
      'Kalakshetra Traditional Kerala Koothambalam',
      'IIT Madras & Anna University Forest Campuses',
    ],
  },
];
