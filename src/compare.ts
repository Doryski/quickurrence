export const isAfter = (date: Date, dateToCompare: Date) =>
  date.getTime() > dateToCompare.getTime();

export const isBefore = (date: Date, dateToCompare: Date) =>
  date.getTime() < dateToCompare.getTime();

export const isEqual = (leftDate: Date, rightDate: Date) =>
  leftDate.getTime() === rightDate.getTime();
