export type VehicleType = 'kei' | 'standard' | 'middle' | 'large';

export type RoadId =
  | 'tohoku'
  | 'kanetsu'
  | 'gaikan'
  | 'chuo'
  | 'kenodo'
  | 'tomei'
  | 'shin_tomei'
  | 'odawara_atsugi'
  | 'yamagata';

export type LatLng = {
  lat: number;
  lng: number;
};

export type Interchange = {
  id: string;
  name: string;
  roadId: RoadId;
  roadName: string;
  lat: number;
  lng: number;
  isSmart: boolean;
  etcOnly: boolean;
  entranceAvailable: boolean;
  exitAvailable: boolean;
  area: string;
  directionGroup: string;
  prevIcId?: string;
  nextIcId?: string;
  availableHours: string;
  notes?: string;
};

export type DestinationArea = {
  id: string;
  name: string;
  description: string;
  destinationIcIds: string[];
};

export type SearchCondition = {
  origin: LatLng & { label?: string; address?: string };
  entranceIcId: string;
  exitIcId: string;
  vehicleType: VehicleType;
  useEtc: boolean;
  departureTime: 'weekday' | 'midnight' | 'holiday';
};

export type CandidateLabel =
  | 'recommended'
  | 'cheapest'
  | 'fastest'
  | 'smartIc'
  | 'localRoadLong'
  | 'detour';

export type IcCandidateResult = {
  entranceIcId: string;
  entranceIcName: string;
  entranceRoadName: string;
  destinationIcId: string;
  destinationIcName: string;
  destinationRoadName: string;
  localRoadDurationMinutes: number;
  localRoadDistanceKm: number;
  highwayDurationMinutes: number;
  highwayDistanceKm: number;
  highwayFareYen: number;
  totalDurationMinutes: number;
  score: number;
  labels: CandidateLabel[];
  reason: string;
  waypointIcNames: string[];
  roadChangeLine: string;
  highwaySteps?: { instruction: string; distanceKm: number }[];
};

export type RecommendResponse = {
  candidates: IcCandidateResult[];
};
