import axios from "axios";
import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
  VerifyEmailAddressCommand,
} from "@aws-sdk/client-ses";
import {
  isValidEmail,
  censorMessageBody,
  calculateBatchCost,
  validateBatchRequest,
} from "./utils/validate.js";
import { updateUserTokens } from "./auth0.js";
import { extractEmail } from "./utils/excel.js";
import { logEmailToFile } from "./utils/logs.js";
import ResponseHandler from "./utils/response.js";
import { replacePlaceholders } from "./utils/convert.js";
import { buildBatchRequestEmailBody } from "./utils/template.js";
import { clientLogFileEmailTemplate } from "../src/templates/clientLogFileEmailTemplate.js";
import { adminUserSignUpEmailTemplate } from "../src/templates/adminUserSignUpEmailTemplate.js";
import { clientUserCreatedEmailTemplate } from "../src/templates/clientUserCreatedEmailTemplate.js";
import { clientActiveStatusEmailTemplate } from "../src/templates/clientActiveStatusEmailTemplate.js";
import { clientTokensUpdatedEmailTemplate } from "../src/templates/clientTokensUpdatedEmailTemplate.js";
import { clientMonthlyReportEmailTemplate } from "./templates/clientMonthlyTokenReminderEmailTemplate.js";
import "dotenv/config";

const config = {
  region: process.env.NEXT_PUBLIC_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
  },
};
const sesClient = new SESClient(config);

/**
 * Send bulk emails using AWS SES
 *
 * @param {string} clientEmail
 * @param {string} emailSubject
 * @param {string} emailBody
 * @param {Array<{email: string, parameters: Array<string>}>} emailParameterMaps - Array of objects, each containing an email address and an array of parameters
 * @param {boolean} isDraft - If true, only send to client
 * @returns {string[]} - List of 'console logs'
 */
async function sendBatchEmails(
  clientEmail,
  emailSubject,
  emailBody,
  emailParameterMaps,
  isDraft,
) {
  let emailAddresses = [];
  let logs = [];

  if (isDraft) {
    emailAddresses.push(clientEmail);
  } else {
    emailParameterMaps.forEach((emailAddressMap) =>
      emailAddresses.push(emailAddressMap.email),
    );
  }

  const promises = emailParameterMaps.map((emailParameterMap) => {
    const parameters = emailParameterMap.parameters;
    const modifiedEmailBody = replacePlaceholders(emailBody, parameters);
    const censoredEmailBody = censorMessageBody(modifiedEmailBody);

    const input = {
      Source: clientEmail,
      Destination: {
        ToAddresses: [emailParameterMap.email],
      },
      Message: {
        Subject: { Data: emailSubject, Charset: "UTF-8" },
        Body: {
          Html: { Data: censoredEmailBody, Charset: "UTF-8" },
        },
      },
      ConfigurationSetName: "EmailEventTracking",
    };
    const command = new SendEmailCommand(input);

    try {
      return sesClient.send(command);
    } catch (error) {
      logs.push(`Failed to send email to ${emailParameterMap.email}: ` + error);
    }
  });

  await Promise.all(promises)
    .then((responses) => {
      responses.forEach((result, index) => {
        if (result) {
          logs.push(
            `Email sent to ${emailAddresses[index]}. MessageId: ${result.MessageId}`,
          );
        }
      });
    })
    .catch((error) => logs.push("Error sending email: " + error));

  return logs;
}

/**
 * @param {boolean} isDraft - If true, only send to client
 */
export async function processEmails(isDraft) {
  let logResponse;
  let errorResponse;
  let extractResponse;
  let batchEmailResponses;
  let updatedUserTokens = 0;

  try {
    extractResponse = extractEmail();
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to extract from email spreadsheet",
      error.message,
    );
  }

  const clientName = extractResponse.clientName;
  const clientEmail = extractResponse.clientEmail;
  const companyName = extractResponse.companyName;
  const companyAddress = extractResponse.companyAddress;
  const emailSubject = extractResponse.emailSubject;
  const emailParagraphs = extractResponse.emailParagraphs;
  const emailParameterMaps = extractResponse.emailParameterMaps;
  const invalidEmailAddresses = extractResponse.invalidEmailAddresses;

  if (!isDraft) {
    try {
      await validateBatchRequest(
        clientEmail,
        emailParameterMaps.length,
        "email",
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to validate batch request",
        error.message,
      );
    }
  }

  const emailBody = buildBatchRequestEmailBody(
    emailParagraphs,
    companyName,
    clientEmail,
    companyAddress,
  );

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_EMAIL === "true") {
    try {
      batchEmailResponses = await sendBatchEmails(
        clientEmail,
        emailSubject,
        emailBody,
        emailParameterMaps,
        isDraft,
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to send batch emails",
        error.message,
      );
    }
  } else {
    return ResponseHandler.error(undefined, "Send email disabled", undefined);
  }

  if (!isDraft) {
    const batchCost = calculateBatchCost(emailParameterMaps.length, "email");
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
    logResponse = await logEmailToFile(
      clientName,
      clientEmail,
      emailSubject,
      emailParagraphs,
      emailParameterMaps,
      invalidEmailAddresses,
      batchEmailResponses,
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
      "Email",
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
    "Successfully sent email batch!",
    `You have ${updatedUserTokens} tokens left`,
  );
}

/**
 * Sends email to client with log file attached. Also BCCs admin email address
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {string} batchType - Type of communication sent, i.e email, SMS or WhatsApp
 * @param {string} logFileName - File name containing logs
 * @param {*} logFile - File object containing logs
 * @throws {Error} - Sending email fails or email sending disabled
 */
export async function emailLogFileToClient(
  clientName,
  clientEmail,
  batchType,
  logFileName,
  logFile,
) {
  const template = clientLogFileEmailTemplate(clientName, batchType);
  const subject = template.subject;
  const body = template.body;
  const fileBase64 = Buffer.from(logFile).toString("base64");

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: clientEmail,
          to: clientEmail,
          bcc: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          subject: subject,
          body: body,
          attachment: {
            filename: logFileName,
            data: fileBase64,
          },
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_LOG_FILE_TO_CLIENT === "true") {
    try {
      await sesClient.send(command);
    } catch (error) {
      throw new Error("Failed to send batch log file to client: " + error);
    }
  } else {
    throw new Error("Email log file to client disabled");
  }
}

/**
 * Sends client verification email in order to use email address as sender email
 *
 * @param {string} emailAddress - Client email address
 */
export async function verifyEmailAddressSes(emailAddress) {
  let getUserByEmailResponse;

  if (!isValidEmail(emailAddress)) {
    return ResponseHandler.error(
      undefined,
      "Invalid email address",
      emailAddress,
    );
  }

  const options = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    getUserByEmailResponse = await axios.request(options);
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to verify email address",
      error?.response?.data?.message,
    );
  }
  if (getUserByEmailResponse.data.length === 0) {
    return ResponseHandler.notFound("User not found", emailAddress);
  }

  const command = new VerifyEmailAddressCommand({
    EmailAddress: emailAddress,
  });

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_VERIFICATION_EMAIL === "true") {
    try {
      await sesClient.send(command);
      return ResponseHandler.success(
        "Successfully sent verify SES email address",
        undefined,
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to verify email address",
        error,
      );
    }
  } else {
    return ResponseHandler.error(
      undefined,
      "Send verification email disabled",
      undefined,
    );
  }
}

/**
 * Send client email when user is created
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @throws {Error} - Sending email fails or email sending disabled
 */
export async function emailUserCreated(clientName, clientEmail) {
  const template = clientUserCreatedEmailTemplate(clientName);
  const subject = template.subject;
  const body = template.body;

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          to: clientEmail,
          subject: subject,
          body: body,
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_AUTH0_EMAIL === "true") {
    try {
      await sesClient.send(command);
    } catch (error) {
      throw new Error("Error sending user created email: " + error);
    }
  } else {
    throw new Error("Send Auth0 emails disabled");
  }
}

/**
 * Send admin email when user signed-up
 *
 * @param {string} clientEmail
 * @param {string} paymentReference
 * @throws {Error} - Sending email fails or email sending disabled
 */
export async function emailAdminUserSignUp(clientEmail, paymentReference) {
  const template = adminUserSignUpEmailTemplate(clientEmail, paymentReference);
  const subject = template.subject;
  const body = template.body;

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          to: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          subject: subject,
          body: body,
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_AUTH0_EMAIL === "true") {
    try {
      await sesClient.send(command);
    } catch (error) {
      throw new Error("Error sending admin user sign-up email: " + error);
    }
  } else {
    throw new Error("Send Auth0 emails disabled");
  }
}

/**
 * Send client email when active status is updated
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {boolean} isActive - User active status
 * @throws {Error} - Sending email fails or email sending disabled
 */
export async function emailUserActiveStatus(clientName, clientEmail, isActive) {
  const template = clientActiveStatusEmailTemplate(clientName, isActive);
  const subject = template.subject;
  const body = template.body;

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          to: clientEmail,
          subject: subject,
          body: body,
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_AUTH0_EMAIL === "true") {
    try {
      await sesClient.send(command);
    } catch (error) {
      throw new Error("Error sending user active status email: " + error);
    }
  } else {
    throw new Error("Send Auth0 emails disabled");
  }
}

/**
 * Send client email when tokens updated
 *
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {number} clientTokens
 * @throws {Error} - Sending email fails or email sending disabled
 */
export async function emailUserTokensUpdated(
  clientName,
  clientEmail,
  clientTokens,
) {
  const template = clientTokensUpdatedEmailTemplate(clientName, clientTokens);
  const subject = template.subject;
  const body = template.body;

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          to: clientEmail,
          subject: subject,
          body: body,
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_AUTH0_EMAIL === "true") {
    try {
      await sesClient.send(command);
    } catch (error) {
      throw new Error("Error sending user tokens updated email: " + error);
    }
  } else {
    throw new Error("Send Auth0 emails disabled");
  }
}

/**
 * Builds email template with the given email events and recipients before sending monthly report to client
 *
 * @param {Object} emailReport - JSON object that includes event counts and recipients of each email event
 * @param {Object[]} smsReport - List of JSON objects that includes SMS events
 * @param {string} clientName
 * @param {string} clientEmail
 * @param {number} clientTokens
 * @returns {Promise<Object>}
 * @throws {Error} - If sending the email is disabled via environment variables.
 */
export async function sendMonthlyReportMail(
  logResponse,
  clientName,
  clientEmail,
  clientTokens,
) {
  const template = clientMonthlyReportEmailTemplate(clientName, clientTokens);
  const fileBase64 = Buffer.from(logResponse.file).toString("base64");

  const input = {
    RawMessage: {
      Data: Buffer.from(
        buildRawMessage({
          from: clientEmail,
          to: clientEmail,
          bcc: process.env.NEXT_PUBLIC_ADMIN_EMAIL_ADDRESS,
          subject: template.subject,
          body: template.body,
          attachment: {
            filename: logResponse.fileName,
            data: fileBase64,
          },
        }),
      ),
    },
    ConfigurationSetName: "EmailEventTracking",
  };
  const command = new SendRawEmailCommand(input);

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_MONTHLY_REPORT === "true") {
    return sesClient.send(command);
  } else {
    throw new Error("Send monthly reports disabled");
  }
}

/**
 * Helper function for constructing raw message with log file attachment
 *
 * @param {*} param0 - JSON object containing to and from email address, subject, body and attachment
 * @returns {string[]}
 */
function buildRawMessage({ from, to, subject, body, attachment }) {
  const boundary = "----=_Part_0_" + new Date().getTime();
  let rawMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    body,
    ``,
  ];
  if (attachment) {
    rawMessage = rawMessage.concat([
      `--${boundary}`,
      `Content-Type: application/octet-stream; name="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      ``,
      attachment.data,
      ``,
    ]);
  }
  rawMessage.push(`--${boundary}--`);
  return rawMessage.join("\r\n");
}
