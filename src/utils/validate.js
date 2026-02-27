import {
  TextCensor,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { getUserByEmail } from "../auth0.js";

/**
 * Validates if given email matches standard email format
 *
 * @param {string} emailAddress
 * @returns {boolean}
 */
export function isValidEmail(emailAddress) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailAddress);
}

/**
 * Validates if given mobile number matches international phone number format
 * Note: AWS SNS requires country code
 *
 * @param {string} mobileNumber
 * @returns {boolean}
 */
export function isValidMobile(mobileNumber) {
  const mobileRegex = /^\+\d{1,3}(\s?\d){4,14}$/;
  return mobileRegex.test(mobileNumber.trim());
}

/**
 * Validates batch by checking if user exists, is active and has sufficient tokens
 *
 * @param {string} emailAddress - Client email address
 * @param {number} batchSize - i.e The amount of email addresses to process
 * @param {string} batchType - i.e "email"
 * @returns {Promise<Object>|undefined} - Response object if validation error occurs, else undefined
 * @throws {Error} - User retrieval fails
 * @throws {Error} - User is not active
 * @throws {Error} - User email not verified
 * @throws {Error} - User has insufficient tokens
 */
export async function validateBatchRequest(emailAddress, batchSize, batchType) {
  const userByEmailResponse = await getUserByEmail(emailAddress);
  if (userByEmailResponse.statusCode !== 200) {
    throw new Error(
      "Failed to validate batch request: " + userByEmailResponse.details,
    );
  }

  const userActiveStatus = userByEmailResponse.data[0].user_metadata.is_active;
  const userEmailVerified = userByEmailResponse.data[0].email_verified;
  const userTokens = userByEmailResponse.data[0].user_metadata.tokens;

  if (!userActiveStatus) {
    throw new Error("User is not active!");
  }

  if (!userEmailVerified) {
    throw new Error("User email not verified!");
  }

  const batchCost = calculateBatchCost(batchSize, batchType);
  if (batchCost > userTokens) {
    throw new Error("User has insufficient tokens!");
  }
}

/**
 * Calculates total cost of batch in tokens based on amount and type
 *
 * @param {number} batchSize - i.e The amount of email addresses to process
 * @param {string} batchType - i.e "whatsapp"
 * @returns {number} - Total cost of batch in tokens
 */
export function calculateBatchCost(batchSize, batchType) {
  let costPerItem;

  switch (batchType) {
    case "email":
      costPerItem = process.env.NEXT_PUBLIC_TOKENS_PER_EMAIL;
      break;
    case "sms":
      costPerItem = process.env.NEXT_PUBLIC_TOKENS_PER_SMS;
      break;
    case "whatsapp":
      costPerItem = process.env.NEXT_PUBLIC_TOKENS_PER_WHATSAPP;
      break;
  }

  const totalBatchCost = batchSize * costPerItem;
  return totalBatchCost;
}

/**
 * Validates if all required spreadsheet fields are populated and features atleast one paragraph
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} companyName
 * @param {string} companyAddress
 * @param {string} emailSubject
 * @param {string[]} emailParagraphs
 * @param {Object} emailParameterMaps - JSON object containing email addresses and relative parameters
 * @returns {Promise<Object>|undefined} - Response object if validation error occurs, else undefined
 * @throws {Error} - Client name is missing
 * @throws {Error} - Client email address is missing
 * @throws {Error} - Company name is missing
 * @throws {Error} - Company address is missing
 * @throws {Error} - Email subject is missing
 * @throws {Error} - At least one paragraph is not provided
 * @throws {Error} - No email address is provided
 * @throws {Error} - Message placeholder validation fails
 */
export function validateEmailSheetFields(
  clientName,
  clientEmail,
  companyName,
  companyAddress,
  emailSubject,
  emailParagraphs,
  emailParameterMaps,
) {
  if (clientName == null) {
    throw new Error("Client name missing in speadsheet!");
  }

  if (clientEmail == null) {
    throw new Error("Client email address missing in speadsheet!");
  }

  if (companyName == null) {
    throw new Error("Company name missing in speadsheet!");
  }

  if (companyAddress == null) {
    throw new Error("Company address missing in speadsheet!");
  }

  if (emailSubject == null) {
    throw new Error("Email subject missing in speadsheet!");
  }

  const allParagraphsNull = emailParagraphs.every(
    (row) => row === null || row === undefined || row.trim() === "",
  );

  if (allParagraphsNull) {
    throw new Error("Atleast one paragraph required in spreadsheet!");
  }

  if (
    !Array.isArray(emailParameterMaps) ||
    !emailParameterMaps.some((item) => item.email)
  ) {
    throw new Error("At least one email address required to send to!");
  }

  try {
    validateMessagePlaceholders(emailParagraphs, emailParameterMaps);
  } catch (error) {
    throw new Error(
      "Failed to validate message placeholders: " + error.message,
    );
  }
}

/**
 * Validates if all required spreadsheet fields are populated
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} clientMobile
 * @param {string} smsBody
 * @param {Object} mobileParameterMaps - JSON object containing mobile numbers and relative parameters
 * @returns {Promise<Object>|undefined} - Response object if validation error occurs, else undefined
 * @throws {Error} - Client name is missing
 * @throws {Error} - Client email address is missing
 * @throws {Error} - Client mobile number is missing
 * @throws {Error} - SMS body is missing
 * @throws {Error} - No mobile number is provided
 * @throws {Error} - Message placeholder validation fails
 */
export function validateSmsSheetFields(
  clientName,
  clientEmail,
  clientMobile,
  smsBody,
  mobileParameterMaps,
) {
  if (clientName == null) {
    throw new Error("Client name missing in speadsheet!");
  }

  if (clientEmail == null) {
    throw new Error("Client email address missing in speadsheet!");
  }

  if (clientMobile == null) {
    throw new Error("Client mobile number missing in speadsheet!");
  }

  if (smsBody == null) {
    throw new Error("SMS body missing in speadsheet!");
  }

  if (
    !Array.isArray(mobileParameterMaps) ||
    !mobileParameterMaps.some((item) => item.mobile)
  ) {
    throw new Error("At least one mobile number required to send to!");
  }

  try {
    validateMessagePlaceholders([smsBody], mobileParameterMaps);
  } catch (error) {
    throw new Error(
      "Failed to validate message placeholders: " + error.message,
    );
  }
}

/**
 * Validates if all required spreadsheet fields are populated
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} clientMobile
 * @param {string} whatsappAccessToken
 * @param {string} whatsappPhoneNumberId
 * @param {string} whatsappTemplateName
 * @returns {Promise<Object>|undefined} - Response object if validation error occurs, else undefined
 * @throws {Error} - Client name is missing
 * @throws {Error} - Client email address is missing
 * @throws {Error} - Client mobile number is missing
 * @throws {Error} - WhatsApp access token is missing
 * @throws {Error} - WhatsApp phone number ID is missing
 * @throws {Error} - WhatsApp template name is missing
 */
export function validateWhatsappSheetFields(
  clientName,
  clientEmail,
  clientMobile,
  whatsappAccessToken,
  whatsappPhoneNumberId,
  whatsappTemplateName,
) {
  if (clientName == null) {
    throw new Error("Client name missing in speadsheet!");
  }

  if (clientEmail == null) {
    throw new Error("Client email address missing in speadsheet!");
  }

  if (clientMobile == null) {
    throw new Error("Client mobile number missing in speadsheet!");
  }

  if (whatsappAccessToken == null) {
    throw new Error("Client WhatsApp Access Token missing in speadsheet!");
  }

  if (whatsappPhoneNumberId == null) {
    throw new Error("Client WhatsApp Phone Number ID missing in speadsheet!");
  }

  if (whatsappTemplateName == null) {
    throw new Error("Client WhatsApp Template Name missing in speadsheet!");
  }
}

/**
 * Validates and replaces if message contains profanities
 *
 * @param {string} message - Message to be sent, i.e email or SMS
 * @returns {string} - Censored message
 */
export function censorMessageBody(message) {
  const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
  });
  const censor = new TextCensor();

  const matches = matcher.getAllMatches(message);
  const censoredMessage = censor.applyTo(message, matches);

  return censoredMessage;
}

/**
 * Validates placeholder count in message paragraphs against parameter count in each map
 *
 * @param {string[]} messageParagraphs - List of paragraphs containing '{}' placeholders
 * @param {Array<{ parameters: string[] }>} parameterMaps - List of objects, each with `parameters` array
 * @returns {Promise<Object>|undefined} - Response object if validation error occurs, else undefined
 * @throws {Error} - Number of placeholders in message paragraph does not match number of parameters in map
 */
function validateMessagePlaceholders(messageParagraphs, parameterMaps) {
  const placeholderCount = messageParagraphs.reduce((count, paragraph) => {
    const matches = paragraph.match(/\{\}/g);
    return count + (matches ? matches.length : 0);
  }, 0);

  parameterMaps.forEach((emailParameterMap, index) => {
    const parameterCount = emailParameterMap.parameters.length;
    if (placeholderCount !== parameterCount) {
      throw new Error(
        `Parameter mismatch detected in row[${index + 1}]: Found ${placeholderCount} '{}' placeholders but ${parameterCount} parameter values!`,
      );
    }
  });
}
