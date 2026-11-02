import { useEffect, useState } from 'react';
import TripList from './components/TripList';
import TripDetail from './components/TripDetail';

export interface TravelAppProps {
  /** When provided (e.g. navigating from the calendar), open this trip directly. */
  initialTripId?: string;
}

type View = { kind: 'list' } | { kind: 'detail'; tripId: string };

export default function TravelApp({ initialTripId }: TravelAppProps = {}) {
  const [view, setView] = useState<View>({ kind: 'list' });

  useEffect(() => {
    if (initialTripId) {
      setView({ kind: 'detail', tripId: initialTripId });
    }
  }, [initialTripId]);

  if (view.kind === 'detail') {
    return (
      <TripDetail tripId={view.tripId} onBack={() => setView({ kind: 'list' })} />
    );
  }
  return <TripList onOpen={(tripId) => setView({ kind: 'detail', tripId })} />;
}
