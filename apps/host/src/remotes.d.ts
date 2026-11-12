declare module 'travel/App' {
  import type { ComponentType } from 'react';

  export interface TravelAppProps {
    initialTripId?: string;
  }

  const TravelApp: ComponentType<TravelAppProps>;
  export default TravelApp;
}

declare module 'calendar/App' {
  import type { ComponentType } from 'react';

  const CalendarApp: ComponentType;
  export default CalendarApp;
}

declare module 'notes/App' {
  import type { ComponentType } from 'react';

  const NotesApp: ComponentType;
  export default NotesApp;
}
