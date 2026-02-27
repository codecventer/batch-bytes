import { uploadLogFileToS3 } from "./storage.js";
import { getFileNameDate, getFormattedDate } from "./date.js";

/**
 * Writes logs related to sending batch emails to text file and stores to S3
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} emailSubject
 * @param {string[]} emailParagraphs - Raw HTML email body
 * @param {Array<{email: string, parameters: Array<string>}>} emailParameterMaps - Array of objects, each containing an email address and an array of parameters
 * @param {string[]} invalidEmailAddresses - Array of invalid email addresses
 * @param {string[]} batchEmailResponses
 * @param {string[]} errorResponse
 * @param {number} updatedUserTokens - Amount of tokens after batch deduction
 * @returns {Object}
 * @throws {Error} - Log file fails to upload to S3
 */
export async function logEmailToFile(
  clientName,
  clientEmail,
  emailSubject,
  emailParagraphs,
  emailParameterMaps,
  invalidEmailAddresses,
  batchEmailResponses,
  errorResponse,
  updatedUserTokens,
) {
  const fileNameDate = getFileNameDate();
  const formattedDate = getFormattedDate();

  let client = clientEmail.split("@")[0];
  client = client.replace(/\./g, "");

  let subject = emailSubject;
  subject = subject.replace(/\s+/g, "_").toLowerCase();

  let emailAddresses = [];
  emailParameterMaps.forEach((emailAddressMap) =>
    emailAddresses.push(emailAddressMap.email),
  );

  const concatFileName = `${client}_${subject}_${fileNameDate}.txt`;

  let logContent = "";
  logContent += `Client name: ${clientName}\n`;
  logContent += `Client email: ${clientEmail}\n`;
  logContent += `Date: ${formattedDate}\n`;
  logContent += `Tokens remaining: ${updatedUserTokens}\n`;
  logContent += `Subject: ${emailSubject}\n`;
  logContent += `Paragraphs:\n\n`;
  logContent +=
    emailParagraphs.map((paragraph) => paragraph + "\n\n").join("") + "\n";
  logContent += `Sending to (${emailAddresses.length}):\n`;
  logContent += emailAddresses.join("\n") + "\n\n";
  logContent += `Invalid email addresses:\n`;
  logContent += invalidEmailAddresses.join("\n") + "\n\n";
  logContent += `Batch email responses:\n`;
  if (batchEmailResponses && batchEmailResponses.length > 0) {
    logContent +=
      batchEmailResponses
        .map((response) =>
          typeof response === "string" ? response : JSON.stringify(response),
        )
        .join("\n") + "\n\n";
  }
  if (errorResponse != null) {
    logContent += `Batch email error response:\n${JSON.stringify(errorResponse)}\n`;
  }

  console.log(logContent);

  try {
    await uploadLogFileToS3(concatFileName, logContent);
    return {
      fileName: concatFileName,
      file: logContent,
    };
  } catch (error) {
    throw new Error("Failed to upload log file to S3: " + error.message);
  }
}

/**
 * Writes console logs related to sending batch sms's to text file and stores to S3
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} clientMobile
 * @param {string} smsBody
 * @param {Array<{mobile: string, parameters: Array<string>}>} mobileParameterMaps - Array of objects, each containing a mobile number and an array of parameters
 * @param {string[]} invalidMobileNumbers - Array of invalid mobile numbers
 * @param {string[]} batchSmsResponses
 * @param {string} errorResponse
 * @param {number} updatedUserTokens - Amount of tokens after batch deduction
 * @returns {Object}
 * @throws {Error} - Log file fails to upload to S3
 */
export async function logSmsToFile(
  clientName,
  clientEmail,
  clientMobile,
  smsBody,
  mobileParameterMaps,
  invalidMobileNumbers,
  batchSmsResponses,
  errorResponse,
  updatedUserTokens,
) {
  const fileNameDate = getFileNameDate();
  const formattedDate = getFormattedDate();

  let client = clientEmail.split("@")[0];
  client = client.replace(/\./g, "");

  let mobileNumbers = [];
  mobileParameterMaps.forEach((mobileParameterMap) =>
    mobileNumbers.push(mobileParameterMap.mobile),
  );

  const concatFileName = `${client}_sms_${fileNameDate}.txt`;

  let logContent = "";
  logContent += `Client name: ${clientName}\n`;
  logContent += `Client email: ${clientEmail}\n`;
  logContent += `Client mobile: ${clientMobile}\n`;
  logContent += `Tokens remaining: ${updatedUserTokens}\n`;
  logContent += `Date: ${formattedDate}\n`;
  logContent += `Body:\n${smsBody}\n\n`;
  logContent += `Sending to (${mobileParameterMaps.length}):\n`;
  logContent += mobileNumbers.join("\n") + "\n\n";
  logContent += `Invalid mobile numbers:\n`;
  logContent += invalidMobileNumbers.join("\n") + "\n\n";
  logContent += `Batch SMS responses:\n`;
  if (batchSmsResponses && batchSmsResponses.length > 0) {
    logContent +=
      batchSmsResponses
        .map((response) =>
          typeof response === "string" ? response : JSON.stringify(response),
        )
        .join("\n") + "\n\n";
  }
  if (errorResponse != null) {
    logContent += `Batch SMS error response:\n${JSON.stringify(errorResponse)}\n`;
  }

  console.log(logContent);

  try {
    await uploadLogFileToS3(concatFileName, logContent);
    return {
      fileName: concatFileName,
      file: logContent,
    };
  } catch (error) {
    throw new Error("Failed to upload log file to S3: " + error.message);
  }
}

/**
 * Writes console logs related to sending batch WhatsApp messages to text file and stores to S3
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} clientMobile
 * @param {string} templateName
 * @param {Array<{mobile: string, parameters: Array<string>}>} whatsappParameterMaps - Array of objects, each containing a mobile number and an array of parameters
 * @param {string[]} invalidMobileNumbers - Array of invalid mobile numbers
 * @param {string[]} batchWhatsappResponse
 * @param {string} errorResponse
 * @param {number} updatedUserTokens - Amount of tokens after batch deduction
 * @returns {Object}
 * @throws {Error} - Log file fails to upload to S3
 */
export async function logWhatsappToFile(
  clientName,
  clientEmail,
  clientMobile,
  templateName,
  whatsappParameterMaps,
  invalidMobileNumbers,
  batchWhatsappResponse,
  errorResponse,
  updatedUserTokens,
) {
  const fileNameDate = getFileNameDate();
  const formattedDate = getFormattedDate();

  let client = clientEmail.split("@")[0];
  client = client.replace(/\./g, "");

  let mobileNumbers = [];
  whatsappParameterMaps.forEach((whatsappParameterMap) =>
    mobileNumbers.push(whatsappParameterMap.mobile),
  );

  const concatFileName = `${client}_whatsapp_${fileNameDate}.txt`;

  let logContent = "";
  logContent += `Client name: ${clientName}\n`;
  logContent += `Client email: ${clientEmail}\n`;
  logContent += `Client mobile: ${clientMobile}\n`;
  logContent += `Tokens remaining: ${updatedUserTokens}\n`;
  logContent += `Date: ${formattedDate}\n\n`;
  logContent += `WhatsApp template name: ${templateName}\n\n`;
  logContent += `Sending to (${whatsappParameterMaps.length}):\n`;
  logContent += mobileNumbers.join("\n") + "\n\n";
  logContent += `Invalid mobile numbers:\n`;
  logContent += invalidMobileNumbers.join("\n") + "\n\n";
  logContent += `Batch WhatsApp responses:\n`;
  logContent +=
    batchWhatsappResponse
      .map((response) => JSON.stringify(response))
      .join("\n") + "\n\n";
  if (errorResponse != null) {
    logContent += `Error response:\n${JSON.stringify(errorResponse)}\n`;
  }

  console.log(logContent);

  try {
    await uploadLogFileToS3(concatFileName, logContent);
    return {
      fileName: concatFileName,
      file: logContent,
    };
  } catch (error) {
    throw new Error("Failed to upload log file to S3: " + error.message);
  }
}

/**
 * Generates log report file containing email and SMS delivery details for a given client
 *
 * @param {string} clientEmail
 * @param {Object} emailReport
 * @param {Array<Object>} smsReport
 * @returns {{fileName: string, file: string}} - Object containing file name and log content
 */
export function logReportToFile(clientEmail, emailReport, smsReport) {
  const fileNameDate = getFileNameDate();
  const client = clientEmail.split("@")[0].replace(/\./g, "");
  const concatFileName = `${client}_report_${fileNameDate}.txt`;

  let logContent = "";

  // Email
  logContent += `Email:\n\n`;
  logContent += `Send recipients (${emailReport.sendCount}):\n`;
  if (emailReport.sendRecipients.length > 0) {
    emailReport.sendRecipients.forEach((recipient) => {
      logContent += `${recipient}\n`;
    });
    logContent += "\n";
  } else {
    logContent += "\n";
  }

  logContent += `Delivered recipients (${emailReport.deliveredCount}):\n`;
  if (emailReport.deliveredRecipients.length > 0) {
    emailReport.deliveredRecipients.forEach((recipient) => {
      logContent += `${recipient}\n`;
    });
    logContent += "\n";
  } else {
    logContent += "\n";
  }

  logContent += `Bounced recipients (${emailReport.bounceCount}):\n`;
  if (emailReport.bounceRecipients.length > 0) {
    emailReport.bounceRecipients.forEach((recipient) => {
      logContent += `${recipient}\n`;
    });
    logContent += "\n";
  } else {
    logContent += "\n";
  }

  logContent += `Complaint recipients (${emailReport.complaintCount}):\n`;
  if (emailReport.complaintRecipients.length > 0) {
    emailReport.complaintRecipients.forEach((recipient) => {
      logContent += `${recipient}\n`;
    });
    logContent += "\n";
  } else {
    logContent += "\n";
  }

  logContent += `Delivery delay recipients (${emailReport.deliveryDelayCount}):\n`;
  if (emailReport.deliveryDelayRecipients.length > 0) {
    emailReport.deliveryDelayRecipients.forEach((recipient) => {
      logContent += `${recipient}\n`;
    });
    logContent += "\n";
  } else {
    logContent += "\n";
  }

  // SMS
  logContent += `SMS:\n\n`;
  logContent += `SMS Events (${smsReport.length}):\n`;
  logContent += smsReport
    .map(
      ({ mobileNumber, phoneCarrier, providerResponse, status }) =>
        `Mobile: ${mobileNumber} | Carrier: ${phoneCarrier} | Response: ${providerResponse} | Status: ${status}`,
    )
    .join("\n");

  console.log(logContent);

  return {
    fileName: concatFileName,
    file: logContent,
  };
}
