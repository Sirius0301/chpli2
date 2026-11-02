/** Trip identity type. PLAN and MEMORY are not mutually exclusive over time
 *  and are never switched automatically. */
export type TripType = 'PLAN' | 'MEMORY';

/** Hierarchy levels for travel routing. Routes may only connect same-level endpoints. */
export type RouteLevel = 'COUNTRY' | 'CITY' | 'LOCATION';

export type TransportMode =
  | 'FLIGHT'
  | 'TRAIN'
  | 'BUS'
  | 'FERRY'
  | 'SUBWAY'
  | 'CAR'
  | 'WALK'
  | 'OTHER';

export const TRANSPORT_MODES: readonly TransportMode[] = [
  'FLIGHT',
  'TRAIN',
  'BUS',
  'FERRY',
  'SUBWAY',
  'CAR',
  'WALK',
  'OTHER',
];

export const ROUTE_LEVELS: readonly RouteLevel[] = ['COUNTRY', 'CITY', 'LOCATION'];
