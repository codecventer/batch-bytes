import XLSX from "xlsx";
import { resolve } from "path";
import {
  isValidEmail,
  isValidMobile,
  validateSmsSheetFields,
  validateEmailSheetFields,
  validateWhatsappSheetFields,
} from "./validate.js";
import "dotenv/config";

/**
 * Extracts email addresses and required fields from Excel spreadsheet and returns non-duplicate email address entries
 *
 * @returns {Object}
 * @throws {Error} - Email sheet file cannot be resolved or read
 * @throws {Error} - Required fields in email sheet are missing or invalid
 * @throws {Error} - Email validation fails
 */
export function extractEmail() {
  let invalidEmailAddresses = [];
  const uniqueEmailParameterMap = new Map();

  const filePath = resolve(process.env.NEXT_PUBLIC_EMAIL_SHEET_LOCATION);
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const emailColumnData = sheetData.slice(1).map((row) => row[3]);
  const paragraphColumnData = sheetData.slice(1).map((row) => row[2]);

  const clientName = sheetData[1][1];
  const clientEmail = sheetData[2][1];
  const companyName = sheetData[3][1];
  const companyAddress = sheetData[4][1];
  const emailSubject = sheetData[5][1];
  const emailParagraphs = paragraphColumnData
    .filter((row) => row !== null && row !== undefined && row.trim() !== "")
    .map((row) => row);

  const emailParameterMaps = emailColumnData
    .map((row, rowIndex) => {
      if (isValidEmail(row)) {
        const parameters = sheetData[rowIndex + 1]
          .slice(4)
          .filter((param) => param !== undefined);
        return { email: row, parameters: parameters };
      } else if (row !== null && row !== undefined && row.trim() !== "") {
        invalidEmailAddresses.push(row);
        return null;
      }
      return null;
    })
    .filter((item) => item !== null);

  try {
    validateEmailSheetFields(
      clientName,
      clientEmail,
      companyName,
      companyAddress,
      emailSubject,
      emailParagraphs,
      emailParameterMaps,
    );
  } catch (error) {
    throw new Error("Failed to validate email sheet: " + error.message);
  }

  emailParameterMaps.forEach((item) => {
    if (!uniqueEmailParameterMap.has(item.email)) {
      uniqueEmailParameterMap.set(item.email, item);
    }
  });

  const uniqueEmailParameterMaps = Array.from(uniqueEmailParameterMap.values());

  return {
    clientName: clientName,
    clientEmail: clientEmail,
    companyName: companyName,
    companyAddress: companyAddress,
    emailSubject: emailSubject,
    emailParagraphs: emailParagraphs,
    emailParameterMaps: uniqueEmailParameterMaps,
    invalidEmailAddresses: invalidEmailAddresses,
  };
}

/**
 * Extracts mobile numbers and required fields from Excel spreadsheet and returns non-duplicate mobile number entries
 *
 * @returns {Object}
 * @throws {Error} - SMS sheet file cannot be resolved or read
 * @throws {Error} - Required fields in SMS sheet are missing or invalid
 * @throws {Error} - Mobile number validation fails
 */
export function extractMobile() {
  let invalidMobileNumbers = [];
  const uniqueMobileParameterMap = new Map();

  const filePath = resolve(process.env.NEXT_PUBLIC_SMS_SHEET_LOCATION);
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const mobileColumnData = sheetData.slice(1).map((row) => row[2]);

  const clientName = sheetData[1][1];
  const clientEmail = sheetData[2][1];
  const clientMobile = sheetData[3][1];
  const smsBody = sheetData[4][1];

  const mobileParameterMaps = mobileColumnData
    .map((row, rowIndex) => {
      let formattedMobileNumber;
      if (row !== undefined) {
        formattedMobileNumber = formatMobileNumbers([row]);
      }
      if (
        formattedMobileNumber !== undefined &&
        isValidMobile(formattedMobileNumber[0])
      ) {
        const parameters = sheetData[rowIndex + 1]
          .slice(3)
          .filter((param) => param !== undefined);
        return { mobile: row, parameters: parameters };
      } else if (row !== null && row !== undefined && row.trim() !== "") {
        invalidMobileNumbers.push(row);
        return null;
      }
      return null;
    })
    .filter((item) => item !== null);

  try {
    validateSmsSheetFields(
      clientName,
      clientEmail,
      clientMobile,
      smsBody,
      mobileParameterMaps,
    );
  } catch (error) {
    throw new Error("Failed to validate SMS sheet: " + error.message);
  }

  mobileParameterMaps.forEach((item) => {
    if (!uniqueMobileParameterMap.has(item.mobile)) {
      uniqueMobileParameterMap.set(item.mobile, item);
    }
  });

  const formattedClientMobile = formatMobileNumbers([clientMobile]);
  const uniqueMobileParameterMaps = Array.from(
    uniqueMobileParameterMap.values(),
  );

  return {
    clientName: clientName,
    clientEmail: clientEmail,
    clientMobile: formattedClientMobile,
    smsBody: smsBody,
    mobileParameterMaps: uniqueMobileParameterMaps,
    invalidMobileNumbers: invalidMobileNumbers,
  };
}

/**
 * Extracts mobile numbers and required fields such as WhatsApp API credentials from Excel spreadsheet and returns non-duplicate mobile number entries
 *
 * @returns {Object}
 * @throws {Error} - WhatsApp sheet file cannot be resolved or read
 * @throws {Error} - Required fields in WhatsApp sheet are missing or invalid
 * @throws {Error} - Mobile number validation fails
 */
export function extractWhatsapp() {
  let invalidMobileNumbers = [];
  const uniqueWhatsappParameterMap = new Map();

  const filePath = resolve(process.env.NEXT_PUBLIC_WHATSAPP_SHEET_LOCATION);
  const workbook = XLSX.readFile(filePath);

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const whatsappColumnData = sheetData.slice(1).map((row) => row[2]);

  const clientName = sheetData[1][1];
  const clientEmail = sheetData[2][1];
  const clientMobile = sheetData[3][1];

  const whatsappAccessToken = sheetData[4][1];
  const whatsappPhoneNumberId = sheetData[5][1];
  const whatsappTemplateName = sheetData[6][1];

  const whatsappParameterMaps = whatsappColumnData
    .map((row, rowIndex) => {
      let formattedMobileNumber;
      if (row !== undefined) {
        formattedMobileNumber = formatMobileNumbers([row]);
      }
      if (
        formattedMobileNumber !== undefined &&
        isValidMobile(formattedMobileNumber[0])
      ) {
        const parameters = sheetData[rowIndex + 1]
          .slice(3)
          .filter((param) => param !== undefined);
        return { mobile: row, parameters: parameters };
      } else if (row !== null && row !== undefined && row.trim() !== "") {
        invalidMobileNumbers.push(row);
        return null;
      }
      return null;
    })
    .filter((item) => item !== null);

  try {
    validateWhatsappSheetFields(
      clientName,
      clientEmail,
      clientMobile,
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappTemplateName,
    );
  } catch (error) {
    throw new Error("Failed to validate WhatsApp sheet: " + error.message);
  }

  whatsappParameterMaps.forEach((item) => {
    if (!uniqueWhatsappParameterMap.has(item.mobile)) {
      uniqueWhatsappParameterMap.set(item.mobile, item);
    }
  });

  const formattedClientMobile = formatMobileNumbers([clientMobile]);
  const uniqueWhatsappParameterMaps = Array.from(
    uniqueWhatsappParameterMap.values(),
  );

  return {
    clientName: clientName,
    clientEmail: clientEmail,
    clientMobile: formattedClientMobile,
    whatsappAccessToken: whatsappAccessToken,
    whatsappPhoneNumberId: whatsappPhoneNumberId,
    whatsappTemplateName: whatsappTemplateName,
    whatsappParameterMaps: uniqueWhatsappParameterMaps,
    invalidMobileNumbers: invalidMobileNumbers,
  };
}

/**
 * Formats list of mobile numbers by removing all whitespace characters, also removes special characters, excluding leading + symbol
 *
 * @param {string[]} mobileNumbers - Array of mobile numbers
 * @returns {string[]}
 */
function formatMobileNumbers(mobileNumbers) {
  const formattedNumbers = mobileNumbers.map((number) =>
    number.replace(/\s+/g, "").replace(/(?!^\+)[^\d]/g, ""),
  );
  return formattedNumbers;
}
