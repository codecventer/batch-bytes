import axios from "axios";
import { updateUserTokens } from "./auth0.js";
import { emailLogFileToClient } from "./email.js";
import ResponseHandler from "./utils/response.js";
import { extractWhatsapp } from "./utils/excel.js";
import { logWhatsappToFile } from "./utils/logs.js";
import { updateUserWhatsAppCredentials } from "../src/auth0.js";
import { validateBatchRequest, calculateBatchCost } from "./utils/validate.js";
import "dotenv/config";

/**
 * Send bulk WhatsApp messages using using WhatsApp Messages API
 *
 * @param {Object} messages - JSON object containing mobile numbers and message parameters
 * @param {string} accessToken
 * @param {string} apiUrl
 * @returns {string[]}
 * @throws {Error} - Sending message fails
 */
async function sendBatchWhatsappTemplateMessages(
  messages,
  accessToken,
  apiUrl,
) {
  let logs = [];

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const promises = messages.map(
    async ({ phoneNumber, templateName, messageParameters, languageCode }) => {
      const payload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [{ type: "body", parameters: messageParameters }],
        },
      };

      try {
        const response = await axios.post(apiUrl, payload, { headers });
        logs.push(
          `Successfully sent WhatsApp message to: ${phoneNumber}`,
          JSON.stringify(response.data),
        );
      } catch (error) {
        throw new Error(
          `Failed to send WhatsApp message to: ${phoneNumber}: ` +
            error?.response?.data?.error?.message,
        );
      }
    },
  );

  const results = await Promise.all(promises);
  results.forEach((result) => {
    if (result) {
      logs.push(`Template message to ${result.phoneNumber} sent successfully.`);
    }
  });

  return logs;
}

/**
 * @param {boolean} isDraft - If true, only send to client
 */
export async function processWhatsapp(isDraft) {
  let logResponse;
  let messages = [];
  let errorResponse;
  let extractResponse;
  let batchWhatsappResponse;
  let updatedUserTokens = 0;

  try {
    extractResponse = extractWhatsapp();
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to extract values from spreadsheet",
      error.message,
    );
  }

  const clientName = extractResponse.clientName;
  const clientEmail = extractResponse.clientEmail;
  const clientMobile = extractResponse.clientMobile;

  const accessToken = extractResponse.whatsappAccessToken;
  const phoneNumberId = extractResponse.whatsappPhoneNumberId;
  const templateName = extractResponse.whatsappTemplateName;

  const whatsappParameterMaps = extractResponse.whatsappParameterMaps;
  const invalidMobileNumbers = extractResponse.invalidMobileNumbers;
  const apiUrl = `${process.env.NEXT_PUBLIC_WA_API_URL}/${phoneNumberId}/messages`;

  if (!isDraft) {
    try {
      await validateBatchRequest(
        clientEmail,
        whatsappParameterMaps.length,
        "whatsapp",
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to validate batch request",
        error.message,
      );
    }
  }

  if (isDraft) {
    const message = {
      phoneNumber: clientMobile,
      templateName: templateName,
      languageCode: "en_US",
    };
    messages.push(message);
  } else {
    whatsappParameterMaps.forEach((mobileNumber) => {
      const message = {
        phoneNumber: mobileNumber.mobile,
        templateName: templateName,
        parameters: mobileNumber.parameters,
        languageCode: "en_US",
      };
      messages.push(message);
    });
  }

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_WHATSAPP === "true") {
    try {
      batchWhatsappResponse = await sendBatchWhatsappTemplateMessages(
        messages,
        accessToken,
        apiUrl,
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to send batch WhatsApp",
        error.message,
      );
    }
  } else {
    return ResponseHandler.error(
      undefined,
      "Send WhatsApp disabled",
      undefined,
    );
  }

  if (!isDraft) {
    const batchCost = calculateBatchCost(whatsappParameterMaps.length, "email");
    const updateUserTokensResponse = await updateUserTokens(
      clientEmail,
      batchCost,
      "-",
      true,
    );
    if (updateUserTokensResponse.statusCode !== 200) {
      return ResponseHandler.error(
        undefined,
        "Failed to update user tokens",
        updateUserTokensResponse.details,
      );
    }
    updatedUserTokens = updateUserTokensResponse.data;
  }

  try {
    await updateUserWhatsAppCredentials(
      clientEmail,
      accessToken,
      phoneNumberId,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to update user WhatsApp credentials",
      error.message,
    );
  }

  try {
    logResponse = await logWhatsappToFile(
      clientName,
      clientEmail,
      clientMobile,
      templateName,
      whatsappParameterMaps,
      invalidMobileNumbers,
      batchWhatsappResponse,
      errorResponse,
      updatedUserTokens,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to create log file",
      error.message,
    );
  }

  const logFileName = logResponse.fileName;
  const logFile = logResponse.file;

  try {
    await emailLogFileToClient(
      clientName,
      clientEmail,
      "WhatsApp",
      logFileName,
      logFile,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to email log file to client",
      error.message,
    );
  }

  return ResponseHandler.success(
    "Successfully sent WhatsApp batch!",
    `You have ${updatedUserTokens} tokens left`,
  );
}
