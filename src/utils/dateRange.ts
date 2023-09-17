export function isDateInRange(startDate: string, endDate: string): boolean {
  const currentDate = new Date();
  const startParts = startDate.split('/');
  const endParts = endDate.split('/');

  if (startParts.length !== 2 || endParts.length !== 2) {
    throw new Error('Invalid date format. Please use "dd/mm" format.');
  }

  const startDay = parseInt(startParts[0], 10);
  const startMonth = parseInt(startParts[1], 10) - 1;
  const endDay = parseInt(endParts[0], 10);
  const endMonth = parseInt(endParts[1], 10) - 1;

  const endDateIsNextYear = endMonth < startMonth;

  const startDateObj = new Date(
    currentDate.getFullYear(),
    startMonth,
    startDay
  );
  const endDateObj = new Date(
    currentDate.getFullYear() + (endDateIsNextYear ? 1 : 0),
    endMonth,
    endDay
  );
  return currentDate >= startDateObj && currentDate <= endDateObj;
}
