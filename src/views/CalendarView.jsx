import { useState } from "react";
import { useWorkshop } from "../state/WorkshopProvider";
import { StaffCalendarModal } from "../components/staff/StaffCalendarModal";
import { TeamAvailabilityView } from "../components/staff/TeamAvailabilityView";

// Team Availability on its own route (moved off /staff on 20 Aug 2026). The grid was the
// middle of three stacked sections there and was the thing people actually opened the page
// for, so it now owns a tab — including one of the five mobile tab-bar slots (see nav.js).
//
// Deliberately has no heading of its own: the Topbar already renders PAGE_META["/calendar"]
// as the page <h1>, and TeamAvailabilityView carries its own legend and usage note. A second
// title here just repeated the one above it.
export function CalendarView() {
  const { calendar, holidays, setCalendarEntry } = useWorkshop();

  // The per-person month calendar, opened from the grid's "Open full calendar". The roster on
  // /staff opens the same modal from its own copy of this state — the two pages each own an
  // instance rather than sharing one, because neither renders the other.
  const [calendarMember, setCalendarMember] = useState(null);

  return (
    <div className="space-y-5">
      <TeamAvailabilityView onOpenFullCalendar={setCalendarMember} />

      <StaffCalendarModal
        member={calendarMember}
        open={Boolean(calendarMember)}
        calendar={calendar}
        holidays={holidays}
        onSetEntry={setCalendarEntry}
        onClose={() => setCalendarMember(null)}
      />
    </div>
  );
}
