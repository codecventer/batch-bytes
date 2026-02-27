import {
  PutLogEventsCommand,
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { replacePlaceholders } from "./utils/convert.js";
import { emailLogFileToClient } from "./email.js";
import ResponseHandler from "./utils/response.js";
import { extractMobile } from "./utils/excel.js";
import { logSmsToFile } from "./utils/logs.js";
import { updateUserTokens } from "./auth0.js";
import {
  validateBatchRequest,
  calculateBatchCost,
  censorMessageBody,
} from "../src/utils/validate.js";
import "dotenv/config";

const config = {
  region: process.env.NEXT_PUBLIC_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
  },
};
const snsClient = new SNSClient(config);
const cloudWatchClient = new CloudWatchLogsClient(config);

/**
 * Send bulk SMS messages using AWS SNS
 *
 * @param {string} smsBody
 * @param {Array<{mobile: string, parameters: Array<string>}>} mobileParameterMaps - Array of objects, each containing a mobile number and an array of parameters
 * @param {string} clientMobile - Client mobile number
 * @param {boolean} isDraft - If true, only send to client
 * @returns {string[]} - List of "console logs"
 */
async function sendBatchSMS(
  smsBody,
  mobileParameterMaps,
  clientMobile,
  clientEmail,
  isDraft,
) {
  let mobileNumbers = [];
  let logs = [];

  if (isDraft) {
    mobileNumbers.push(clientMobile);
  } else {
    mobileParameterMaps.forEach((mobileNumberMap) =>
      mobileNumbers.push(mobileNumberMap.mobile),
    );
  }

  const promises = mobileParameterMaps.map(async (mobileNumberMap) => {
    try {
      const parameters = mobileNumberMap.parameters;
      const modifiedSmsBody = replacePlaceholders(smsBody, parameters);
      const censoredSmsBody = censorMessageBody(modifiedSmsBody);

      const response = await snsClient.send(
        new PublishCommand({
          Message: censoredSmsBody,
          PhoneNumber: mobileNumberMap.mobile,
        }),
      );

      try {
        await logSmsEvent(
          clientEmail,
          mobileNumberMap.mobile,
          response.MessageId,
          censoredSmsBody,
        );
      } catch (error) {
        logs.push(
          `Failed to log SMS event for ${mobileNumberMap.mobile}: ${error}`,
        );
      }

      return { mobile: mobileNumberMap.mobile, messageId: response.MessageId };
    } catch (error) {
      logs.push(`Failed to send SMS to ${mobileNumberMap.mobile}: ${error}`);
    }
  });

  const results = await Promise.all(promises);
  results.forEach((result) => {
    if (result) {
      logs.push(`SMS sent to ${result.mobile}. MessageId: ${result.messageId}`);
    }
  });

  return logs;
}

/**
 * @param {boolean} isDraft - If true, only send to client
 */
export async function processSms(isDraft) {
  let logResponse;
  let errorResponse;
  let extractResponse;
  let batchSmsResponses;
  let updatedUserTokens = 0;

  try {
    extractResponse = extractMobile();
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
  const smsBody = extractResponse.smsBody;
  const mobileParameterMaps = extractResponse.mobileParameterMaps;
  const invalidMobileNumbers = extractResponse.invalidMobileNumbers;

  if (!isDraft) {
    try {
      await validateBatchRequest(
        clientEmail,
        mobileParameterMaps.length,
        "sms",
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to validate batch request",
        error.message,
      );
    }
  }

  if (process.env.NEXT_PUBLIC_ENABLE_SEND_SMS === "true") {
    try {
      batchSmsResponses = await sendBatchSMS(
        smsBody,
        mobileParameterMaps,
        clientMobile,
        clientEmail,
        isDraft,
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to send batch SMS",
        error.message,
      );
    }
  } else {
    return ResponseHandler.error(undefined, "Send SMS disabled", undefined);
  }

  if (!isDraft) {
    const batchCost = calculateBatchCost(mobileParameterMaps.length, "sms");
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
    logResponse = await logSmsToFile(
      clientName,
      clientEmail,
      clientMobile,
      smsBody,
      mobileParameterMaps,
      invalidMobileNumbers,
      batchSmsResponses,
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
      "SMS",
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
    "Successfully sent SMS batch!",
    `You have ${updatedUserTokens} tokens left`,
  );
}

/**
 * Logs SMS event to AWS CloudWatch and ensures log stream exists before sending log event
 *
 * @param {string} clientEmail - Email address of sender
 * @param {string} mobileNumber - Recipient's mobile number
 * @param {string} messageId - Unique identifier of SMS message
 * @param {string} message
 * @returns {Promise<Object>}
 */
async function logSmsEvent(clientEmail, mobileNumber, messageId, message) {
  const logStreamName = `Sender-${clientEmail}`;

  try {
    await ensureLogStreamExist(logStreamName);
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to ensure log stream exist",
      error,
    );
  }

  const logEntry = {
    clientEmail,
    mobileNumber,
    messageId,
    message,
    timestamp: new Date().toISOString(),
  };

  const params = {
    logGroupName: process.env.NEXT_PUBLIC_AWS_SMS_LOG_STREAM_NAME,
    logStreamName,
    logEvents: [{ message: JSON.stringify(logEntry), timestamp: Date.now() }],
  };

  try {
    await cloudWatchClient.send(new PutLogEventsCommand(params));
  } catch (error) {
    return ResponseHandler.error(undefined, "Failed to log SMS event", error);
  }
}

/**
 * Ensures a log stream exists in AWS CloudWatch Logs. Creates the log stream if it does not exist.
 *
 * @param {string} logStreamName - Name of log stream to check or create
 * @returns {Promise<Object|undefined>} - Success response if new log stream created, else undefined
 * @throws {Error} - If CloudWatch request fails
 */
async function ensureLogStreamExist(logStreamName) {
  try {
    const { logStreams } = await cloudWatchClient.send(
      new DescribeLogStreamsCommand({
        logGroupName: process.env.NEXT_PUBLIC_AWS_SMS_LOG_STREAM_NAME,
      }),
    );

    if (!logStreams.find((stream) => stream.logStreamName === logStreamName)) {
      await cloudWatchClient.send(
        new CreateLogStreamCommand({
          logGroupName: process.env.NEXT_PUBLIC_AWS_SMS_LOG_STREAM_NAME,
          logStreamName,
        }),
      );
    }
  } catch (error) {
    throw new Error("Failed to ensure log stream: " + error);
  }
}
