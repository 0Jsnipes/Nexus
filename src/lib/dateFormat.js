import { format as timeago } from "timeago.js";

export const format = (date) => timeago(date);

export const isToday = (date) => {
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

export const isYesterday = (date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};
