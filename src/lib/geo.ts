// Country -> currency/timezone/phone code defaults, plus a curated set of
// regions and cities for African countries. For any country (or region/city)
// not in the list, the UI offers a manual "Other — enter manually" option.

export type CountryInfo = {
  code: string;
  name: string;
  nameFr: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  phoneCode: string;
  regions?: { name: string; cities: string[] }[];
};

const AFRICA: CountryInfo[] = [
  {
    code: 'CM', name: 'Cameroon', nameFr: 'Cameroun', currency: 'XAF', currencySymbol: 'FCFA',
    timezone: 'Africa/Douala', phoneCode: '+237',
    regions: [
      { name: 'Littoral', cities: ['Douala', 'Edea', 'Nkongsamba', 'Loum'] },
      { name: 'Centre', cities: ['Yaoundé', 'Mbalmayo', 'Bafia', 'Obala'] },
      { name: 'Ouest', cities: ['Bafoussam', 'Dschang', 'Foumban', 'Mbouda'] },
      { name: 'Sud-Ouest', cities: ['Buea', 'Kumba', 'Limbe', 'Tiko'] },
      { name: 'Nord-Ouest', cities: ['Bamenda', 'Kumbo', 'Ndop'] },
      { name: 'Sud', cities: ['Ebolowa', 'Kribi', 'Sangmelima'] },
      { name: 'Adamaoua', cities: ['Ngaoundéré', 'Meiganga', 'Tibati'] },
      { name: 'Est', cities: ['Bertoua', 'Abong-Mbang', 'Batouri'] },
      { name: 'Nord', cities: ['Garoua', 'Guider', 'Pitoa'] },
      { name: 'Extrême-Nord', cities: ['Maroua', 'Kousseri', 'Mokolo', 'Yagoua'] },
    ],
  },
  {
    code: 'SN', name: 'Senegal', nameFr: 'Sénégal', currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Dakar', phoneCode: '+221',
    regions: [
      { name: 'Dakar', cities: ['Dakar', 'Pikine', 'Guédiawaye', 'Rufisque'] },
      { name: 'Thiès', cities: ['Thiès', 'Mbour', 'Tivaouane'] },
      { name: 'Diourbel', cities: ['Diourbel', 'Mbacké', 'Touba'] },
      { name: 'Saint-Louis', cities: ['Saint-Louis', 'Dagana', 'Podor'] },
    ],
  },
  {
    code: 'CI', name: "Côte d'Ivoire", nameFr: "Côte d'Ivoire", currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Abidjan', phoneCode: '+225',
    regions: [
      { name: 'Abidjan', cities: ['Abidjan', 'Cocody', 'Yopougon', 'Plateau'] },
      { name: 'Bas-Sassandra', cities: ['San-Pédro', 'Divo', 'Soubré'] },
      { name: 'Lagunes', cities: ['Dabou', 'Tiassalé'] },
    ],
  },
  {
    code: 'NG', name: 'Nigeria', nameFr: 'Nigeria', currency: 'NGN', currencySymbol: '₦',
    timezone: 'Africa/Lagos', phoneCode: '+234',
    regions: [
      { name: 'Lagos', cities: ['Lagos', 'Ikeja', 'Lekki'] },
      { name: 'FCT', cities: ['Abuja', 'Gwagwalada'] },
      { name: 'Rivers', cities: ['Port Harcourt', 'Bonny'] },
      { name: 'Kano', cities: ['Kano', 'Wudil'] },
    ],
  },
  {
    code: 'KE', name: 'Kenya', nameFr: 'Kenya', currency: 'KES', currencySymbol: 'KSh',
    timezone: 'Africa/Nairobi', phoneCode: '+254',
    regions: [
      { name: 'Nairobi', cities: ['Nairobi', 'Westlands', 'Embakasi'] },
      { name: 'Mombasa', cities: ['Mombasa', 'Malindi', 'Diani'] },
      { name: 'Kisumu', cities: ['Kisumu', 'Ahero'] },
    ],
  },
  {
    code: 'ZA', name: 'South Africa', nameFr: 'Afrique du Sud', currency: 'ZAR', currencySymbol: 'R',
    timezone: 'Africa/Johannesburg', phoneCode: '+27',
    regions: [
      { name: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Sandton'] },
      { name: 'Western Cape', cities: ['Cape Town', 'Stellenbosch'] },
      { name: 'KwaZulu-Natal', cities: ['Durban', 'Pietermaritzburg'] },
    ],
  },
  {
    code: 'GH', name: 'Ghana', nameFr: 'Ghana', currency: 'GHS', currencySymbol: '₵',
    timezone: 'Africa/Accra', phoneCode: '+233',
    regions: [
      { name: 'Greater Accra', cities: ['Accra', 'Tema', 'Madina'] },
      { name: 'Ashanti', cities: ['Kumasi', 'Obuasi'] },
    ],
  },
  {
    code: 'ET', name: 'Ethiopia', nameFr: 'Éthiopie', currency: 'ETB', currencySymbol: 'Br',
    timezone: 'Africa/Addis_Ababa', phoneCode: '+251',
    regions: [{ name: 'Addis Ababa', cities: ['Addis Ababa', 'Bole', 'Kazanchis'] }],
  },
  {
    code: 'RW', name: 'Rwanda', nameFr: 'Rwanda', currency: 'RWF', currencySymbol: 'RF',
    timezone: 'Africa/Kigali', phoneCode: '+250',
    regions: [{ name: 'Kigali', cities: ['Kigali', 'Nyarugenge', 'Gasabo'] }],
  },
  {
    code: 'TZ', name: 'Tanzania', nameFr: 'Tanzanie', currency: 'TZS', currencySymbol: 'TSh',
    timezone: 'Africa/Dar_es_Salaam', phoneCode: '+255',
    regions: [{ name: 'Dar es Salaam', cities: ['Dar es Salaam', 'Kigamboni'] }],
  },
  {
    code: 'UG', name: 'Uganda', nameFr: 'Ouganda', currency: 'UGX', currencySymbol: 'USh',
    timezone: 'Africa/Kampala', phoneCode: '+256',
    regions: [{ name: 'Kampala', cities: ['Kampala', 'Entebbe', 'Mukono'] }],
  },
  {
    code: 'ML', name: 'Mali', nameFr: 'Mali', currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Bamako', phoneCode: '+223',
    regions: [{ name: 'Bamako', cities: ['Bamako', 'Kati'] }],
  },
  {
    code: 'BF', name: 'Burkina Faso', nameFr: 'Burkina Faso', currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Ouagadougou', phoneCode: '+226',
    regions: [{ name: 'Centre', cities: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou'] }],
  },
  {
    code: 'BJ', name: 'Benin', nameFr: 'Bénin', currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Porto-Novo', phoneCode: '+229',
    regions: [{ name: 'Littoral', cities: ['Cotonou', 'Porto-Novo', 'Abomey-Calavi'] }],
  },
  {
    code: 'TG', name: 'Togo', nameFr: 'Togo', currency: 'XOF', currencySymbol: 'FCFA',
    timezone: 'Africa/Lome', phoneCode: '+228',
    regions: [{ name: 'Maritime', cities: ['Lomé', 'Tsévié', 'Aného'] }],
  },
  {
    code: 'CG', name: 'Congo', nameFr: 'Congo', currency: 'XAF', currencySymbol: 'FCFA',
    timezone: 'Africa/Brazzaville', phoneCode: '+242',
    regions: [{ name: 'Brazzaville', cities: ['Brazzaville', 'Pointe-Noire'] }],
  },
  {
    code: 'CD', name: 'DR Congo', nameFr: 'RD Congo', currency: 'CDF', currencySymbol: 'FC',
    timezone: 'Africa/Kinshasa', phoneCode: '+243',
    regions: [{ name: 'Kinshasa', cities: ['Kinshasa', 'Lubumbashi', 'Goma'] }],
  },
  {
    code: 'GA', name: 'Gabon', nameFr: 'Gabon', currency: 'XAF', currencySymbol: 'FCFA',
    timezone: 'Africa/Libreville', phoneCode: '+241',
    regions: [{ name: 'Estuaire', cities: ['Libreville', 'Port-Gentil'] }],
  },
  {
    code: 'MA', name: 'Morocco', nameFr: 'Maroc', currency: 'MAD', currencySymbol: 'DH',
    timezone: 'Africa/Casablanca', phoneCode: '+212',
    regions: [{ name: 'Casablanca-Settat', cities: ['Casablanca', 'Mohammedia', 'Settat'] }],
  },
  {
    code: 'EG', name: 'Egypt', nameFr: 'Égypte', currency: 'EGP', currencySymbol: 'E£',
    timezone: 'Africa/Cairo', phoneCode: '+20',
    regions: [{ name: 'Cairo', cities: ['Cairo', 'Giza', 'Helwan'] }],
  },
];

const INTERNATIONAL: CountryInfo[] = [
  { code: 'US', name: 'United States', nameFr: 'États-Unis', currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', phoneCode: '+1' },
  { code: 'FR', name: 'France', nameFr: 'France', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Paris', phoneCode: '+33' },
  { code: 'GB', name: 'United Kingdom', nameFr: 'Royaume-Uni', currency: 'GBP', currencySymbol: '£', timezone: 'Europe/London', phoneCode: '+44' },
  { code: 'AE', name: 'United Arab Emirates', nameFr: 'Émirats Arabes Unis', currency: 'AED', currencySymbol: 'AED', timezone: 'Asia/Dubai', phoneCode: '+971' },
];

export const COUNTRIES: CountryInfo[] = [...AFRICA, ...INTERNATIONAL].sort((a, b) =>
  a.nameFr.localeCompare(b.nameFr),
);

export function getCountry(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export const PAYMENT_METHODS = [
  { id: 'bank', labelFr: 'Virement bancaire', labelEn: 'Bank transfer' },
  { id: 'wave', labelFr: 'Wave', labelEn: 'Wave' },
  { id: 'orange', labelFr: 'Orange Money', labelEn: 'Orange Money' },
  { id: 'mtn', labelFr: 'MTN Mobile Money', labelEn: 'MTN Mobile Money' },
  { id: 'moov', labelFr: 'Moov Money', labelEn: 'Moov Money' },
  { id: 'mpesa', labelFr: 'M-Pesa', labelEn: 'M-Pesa' },
];
