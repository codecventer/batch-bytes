/**
 * Returns current date in following format, i.e "01_01_2000_13_01_59"
 *
 * @returns {string}
 */
export function getFileNameDate() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;
}

/**
 * Returns current date in following format, i.e "01-01-2000 13:01:59"
 *
 * @returns {string}
 */
export function getFormattedDate() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Returns current month name
 *
 * @returns {string} - i.e "August"
 */
export function getCurrentMonth() {
  const currentDate = new Date();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return monthNames[currentDate.getMonth()];
}

/**
 * Returns current year... #rocketscience
 *
 * @returns {string}
 */
export function getCurrentYear() {
  const currentDate = new Date();
  return currentDate.getFullYear();
}
