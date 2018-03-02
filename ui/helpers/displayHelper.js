export const toDateStr = function toDateStr(timestamp) {
  const dateFormat = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  };
  return new Date(timestamp * 1000).toLocaleString("en-US", dateFormat);
};

export default toDateStr;
