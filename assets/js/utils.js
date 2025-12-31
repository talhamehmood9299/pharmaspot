let fs = require("fs");
const crypto = require("crypto");
let moment = require("moment");
const DATE_FORMAT = "DD-MMM-YYYY";
const PORT = process.env.PORT;
let path = require("path");
const moneyFormat = (amount, locale = "en-US") => {
  return new Intl.NumberFormat(locale).format(amount);
};

/** Date functions **/
const isExpired = (dueDate, dateFormat = DATE_FORMAT) => {
  const todayDate = moment();
  const parsed = moment(dueDate, dateFormat, true);
  const expiryDate = parsed.isValid() ? parsed : moment(dueDate);
  return todayDate.isSameOrAfter(expiryDate, "day");
};

const daysToExpire = (dueDate) => {
  const todayDate = moment();
  // Try strict parse with configured format; fallback to native parsing
  const parsed = moment(dueDate, DATE_FORMAT, true);
  const expiryDate = parsed.isValid() ? parsed : moment(dueDate);

  if (expiryDate.isSameOrBefore(todayDate, "day")) {
    return 0;
  }

  return expiryDate.diff(todayDate, "days");
};

/** Inventory **/
/**
 * Determines the stock status based on current stock and minimum stock levels.
 *
 * @param {number} currentStock - The current quantity of stock.
 * @param {number} minimumStock - The minimum required quantity of stock.
 * @returns {number} - Returns 0 if there is no stock, -1 if the stock is low, and 1 if the stock level is normal.
 */
const getStockStatus = (currentStock, minimumStock)=>{
  currentStock = Number(currentStock);
  minimumStock = Number(minimumStock);

   if (isNaN(currentStock) || isNaN(minimumStock)) {
    throw new Error("Invalid input: both currentStock and minimumStock should be numbers.");
  }

  if (currentStock <= 0) {
    return 0; // No stock
  }

  if (currentStock <= minimumStock) {
    return -1; // Low stock
  }
  return 1; // Normal stock
}


/** File **/
const checkFileExists = (filePath) => {
  try {
    const F_OK = fs.constants ? fs.constants.F_OK : undefined;
    fs.accessSync(filePath, F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

const checkFileType = (fileType, validFileTypes) => {
  return validFileTypes.includes(fileType);
};

const getFileHash = (filePath) => {
  const fileData = fs.readFileSync(filePath);
  const maybeFunction = crypto.createHash("sha256");
  if (typeof maybeFunction === "function") {
    const inner = maybeFunction();
    if (inner && typeof inner.update === "function") {
      try { maybeFunction.update = inner.update; } catch (_) {}
    }
    return inner.update(fileData).digest("hex");
  }
  return maybeFunction.update(fileData).digest("hex");
};


const filterFile = (req, file, callback, validFileTypes) => {
    try {
      const isValidFile = checkFileType(file.mimetype, validFileTypes);
      if (isValidFile) {
        return callback(null, true);
      } else {
        return callback(new Error(`Invalid file type. Only JPEG, PNG, GIF, and WEBP files are allowed.`), false);
      }
    } catch (err) {
      return callback(new Error(`An error occurred: ${err}`),false);
    }
  }

/*Security*/

const setContentSecurityPolicy = () => {
  let scriptHash = getFileHash(path.join(__dirname,"../dist","js","bundle.min.js"))
  let styleHash = getFileHash(path.join(__dirname,"../dist","css","bundle.min.css"));
  let content = `default-src 'self'; img-src 'self' data:;script-src 'self' 'unsafe-eval' 'unsafe-inline' sha256-${scriptHash}; style-src 'self' 'unsafe-inline' sha256-${styleHash};font-src 'self';base-uri 'self'; form-action 'self'; ;connect-src 'self' http://localhost:${PORT};`;
  let metaTag = document.createElement("meta");
  metaTag.setAttribute("http-equiv", "Content-Security-Policy");
  metaTag.setAttribute("content", content);
  document.head.appendChild(metaTag);
};

module.exports = {
  DATE_FORMAT,
  moneyFormat,
  isExpired,
  getStockStatus,
  getFileHash,
  daysToExpire,
  checkFileExists,
  checkFileType,
  setContentSecurityPolicy
};
