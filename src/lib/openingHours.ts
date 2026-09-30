// Opening hours parser and status evaluator for Chennai spots

export interface PlaceOpenStatus {
  isOpen: boolean;
  statusLabel: 'Open Now' | 'Closed' | 'Closing Soon';
  badgeClass: string;
  dotColorClass: string;
  textColorClass: string;
  timingDetail: string;
  displayNote: string;
}

/**
 * Returns India Standard Time (IST) Date or local time
 */
export function getChennaiLocalTime(): Date {
  // Chennai is UTC + 5:30
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

/**
 * Evaluates whether a spot with openHours is open at the given time
 */
export function evaluatePlaceOpenStatus(
  openHoursStr?: string,
  category?: string,
  referenceDate?: Date
): PlaceOpenStatus {
  const chennaiTime = referenceDate || getChennaiLocalTime();
  const currentMinutes = chennaiTime.getHours() * 60 + chennaiTime.getMinutes();

  // Default hours based on category if missing
  let hoursText = openHoursStr?.trim();
  if (!hoursText) {
    if (category?.toLowerCase().includes('beach') || category?.toLowerCase().includes('promenade')) {
      hoursText = 'Open 24 Hours';
    } else if (category?.toLowerCase().includes('food') || category?.toLowerCase().includes('mess') || category?.toLowerCase().includes('biryani')) {
      hoursText = '07:00 AM – 10:30 PM';
    } else if (category?.toLowerCase().includes('temple') || category?.toLowerCase().includes('heritage')) {
      hoursText = '06:00 AM – 08:30 PM';
    } else {
      hoursText = '09:00 AM – 06:00 PM';
    }
  }

  // Check 24 Hours
  if (hoursText.toLowerCase().includes('24 hour') || hoursText.toLowerCase().includes('always open')) {
    return {
      isOpen: true,
      statusLabel: 'Open Now',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
      dotColorClass: 'bg-emerald-400',
      textColorClass: 'text-emerald-400',
      timingDetail: 'Open 24 Hours',
      displayNote: 'Open all day & night',
    };
  }

  // Parse time intervals like "06:00 AM – 08:30 PM" or "6:00 AM - 9:00 PM"
  const match = hoursText.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)\s*[\u2013\u2014\-to]+\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);

  if (match) {
    let startHour = parseInt(match[1], 10);
    const startMin = match[2] ? parseInt(match[2], 10) : 0;
    const startPeriod = match[3].toUpperCase();

    let endHour = parseInt(match[4], 10);
    const endMin = match[5] ? parseInt(match[5], 10) : 0;
    const endPeriod = match[6].toUpperCase();

    if (startPeriod === 'PM' && startHour < 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;

    if (endPeriod === 'PM' && endHour < 12) endHour += 12;
    if (endPeriod === 'AM' && endHour === 12) endHour = 0;

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    const minutesUntilClose = endMinutes - currentMinutes;

    if (isOpen) {
      if (minutesUntilClose > 0 && minutesUntilClose <= 45) {
        return {
          isOpen: true,
          statusLabel: 'Closing Soon',
          badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          dotColorClass: 'bg-amber-400 animate-pulse',
          textColorClass: 'text-amber-400',
          timingDetail: hoursText,
          displayNote: `Closes in ${minutesUntilClose} mins`,
        };
      }
      return {
        isOpen: true,
        statusLabel: 'Open Now',
        badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
        dotColorClass: 'bg-emerald-400',
        textColorClass: 'text-emerald-400',
        timingDetail: hoursText,
        displayNote: `Closes at ${formatHour(endHour, endMin)}`,
      };
    } else {
      return {
        isOpen: false,
        statusLabel: 'Closed',
        badgeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
        dotColorClass: 'bg-rose-400',
        textColorClass: 'text-rose-400',
        timingDetail: hoursText,
        displayNote: `Opens at ${formatHour(startHour, startMin)}`,
      };
    }
  }

  // Fallback for general daylight hours (08:00 to 20:00)
  const isDefaultDaylight = currentMinutes >= 8 * 60 && currentMinutes < 20 * 60;
  return {
    isOpen: isDefaultDaylight,
    statusLabel: isDefaultDaylight ? 'Open Now' : 'Closed',
    badgeClass: isDefaultDaylight
      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
      : 'bg-rose-500/15 border-rose-500/40 text-rose-400',
    dotColorClass: isDefaultDaylight ? 'bg-emerald-400' : 'bg-rose-400',
    textColorClass: isDefaultDaylight ? 'text-emerald-400' : 'text-rose-400',
    timingDetail: hoursText || '08:00 AM – 08:00 PM',
    displayNote: isDefaultDaylight ? 'Closes at 8:00 PM' : 'Opens at 8:00 AM',
  };
}

function formatHour(hour: number, min: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMin = min < 10 ? `0${min}` : `${min}`;
  return min === 0 ? `${displayHour} ${period}` : `${displayHour}:${displayMin} ${period}`;
}
