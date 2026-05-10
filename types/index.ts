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
  | 'yamagata'
  | 'joban'
  | 'banetsu'
  | 'hokuriku'
  | 'higashikanto'
  | 'shuto';

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
  /** 路線端で接続するJCT先のIC（別路線）。prev/nextが無いときの矢印ナビ先 */
  junctionPrevIcId?: string;
  junctionNextIcId?: string;
  availableHours: string;
  notes?: string;
};

export type DestinationArea = {
  id: string;
  name: string;
  description: string;
  destinationIcIds: string[];
};

export type RouteSection = {
  roadName: string;
  fromIcName: string;
  toIcName: string;
  distanceKm: number;
  etcFareYen: number;
  durationMinutes: number;
};

export type SearchCondition = {
  origin: LatLng & { label?: string; address?: string };
  entranceIcId: string;
  exitIcId: string;
  vehicleType: VehicleType;
  useEtc: boolean;
  departureTime: 'weekday' | 'midnight' | 'holiday';
  clockTime?: string; // "HH:MM" 形式。未指定なら相対時間表示
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
  sections: RouteSection[];
  departureType: 'weekday' | 'midnight' | 'holiday';
  clockTime?: string;
};

export type RecommendResponse = {
  candidates: IcCandidateResult[];
};
