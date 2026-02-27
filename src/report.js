import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogStreamsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { getAllUsers } from "./auth0.js";
import { sendMonthlyReportMail } from "./email.js";
import ResponseHandler from "../src/utils/response.js";
import { logReportToFile } from "../src/utils/logs.js";
import "dotenv/config";

const config = {
  region: process.env.NEXT_PUBLIC_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
  },
};
const cloudWatchClient = new CloudWatchLogsClient(config);

/**
 * Processes and sends monthly email reports for all active users.
 * This function retrieves all users, filters them based on specific criteria,
 * generates a monthly report for eligible users, and sends the report via email.
 */
export async function processMonthlyReports() {
  const allUsers = await getAllUsers();
  if (allUsers.statusCode !== 200) {
    return ResponseHandler.error(
      undefined,
      "Failed to process monthly report",
      allUsers.details,
    );
  }

  for (const user of allUsers.data) {
    if (user.email_verified === false) {
      console.log("Email not verified for user: " + user.nickname);
      continue;
    }
    if (user.user_metadata.is_active === false) {
      console.log("User is not active: " + user.nickname);
      continue;
    }
    if (user.user_metadata.tokens === 0) {
      console.log("User has insufficient tokens: " + user.nickname);
      continue;
    }

    try {
      const emailEvents = await getEmailEventsBySender(user.email);
      const emailReport = buildMonthlyEmailReport(emailEvents);

      const smsEvents = await getSmsEventsBySender(user.email);
      const smsReport = await buildMonthlySmsReport(smsEvents);

      const logResponse = logReportToFile(user.email, emailReport, smsReport);

      const sendReportResponse = await sendMonthlyReportMail(
        logResponse,
        user.nickname,
        user.name,
        user.user_metadata.tokens,
      );

      if (sendReportResponse == undefined) {
        return ResponseHandler.error(
          undefined,
          "Failed to send monthly report",
          undefined,
        );
      }

      return ResponseHandler.success(
        `Successfully sent monthly report to ${user.email}`,
        undefined,
      );
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        `Failed to send monthly report to ${user.email}`,
        error.message,
      );
    }
  }
}

/**
 * Fetch email events sent by a specified email address within the last 30 days
 *
 * @param {string} senderEmailAddress - Sender email address
 * @returns {Promise<Object>|Promise<Array>} - List of email events (i.e, Send, Delivery, Bounce)
 */
async function getEmailEventsBySender(senderEmailAddress) {
  const logGroupName = process.env.NEXT_PUBLIC_AWS_EMAIL_LOG_GROUP_NAME;

  const config = {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
    },
  };
  const cloudWatchLogsClient = new CloudWatchLogsClient(config);

  try {
    const filterPattern = `"source" "ses" "${senderEmailAddress}"`;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const command = new FilterLogEventsCommand({
      logGroupName,
      filterPattern,
      startTime: thirtyDaysAgo,
    });
    const response = await cloudWatchLogsClient.send(command);
    return response.events.map((event) => JSON.parse(event.message));
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Error fetching email events",
      error,
    );
  }
}

async function getSmsEventsBySender(clientEmail) {
  try {
    const logStreamName = `Sender-${clientEmail}`;

    const { logStreams } = await cloudWatchClient.send(
      new DescribeLogStreamsCommand({
        logGroupName: process.env.NEXT_PUBLIC_AWS_SMS_LOG_STREAM_NAME,
      }),
    );

    if (!logStreams.find((stream) => stream.logStreamName === logStreamName)) {
      return [];
    }

    const logParams = {
      logGroupName: process.env.NEXT_PUBLIC_AWS_SMS_LOG_STREAM_NAME,
      logStreamNames: [logStreamName],
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
    };

    const logResponse = await cloudWatchClient.send(
      new FilterLogEventsCommand(logParams),
    );
    const logs =
      logResponse.events?.map((event) => JSON.parse(event.message)) || [];

    return logs;
  } catch (error) {
    return ResponseHandler.error(undefined, "Failed to fetch logs", error);
  }
}

async function searchSnsLogForMessageId(messageId) {
  const logGroupName = process.env.NEXT_PUBLIC_AWS_SMS_LOG_GROUP_NAME;

  try {
    const logStreamsCommand = new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: "LastEventTime",
      descending: true,
    });

    const logStreamsResponse = await cloudWatchClient.send(logStreamsCommand);
    const logStreams = logStreamsResponse.logStreams;

    if (!logStreams || logStreams.length === 0) {
      return null;
    }

    for (const logStream of logStreams) {
      const logStreamName = logStream.logStreamName;

      const filterParams = {
        logGroupName,
        logStreamNames: [logStreamName],
        filterPattern: `"${messageId}"`,
        limit: 1,
      };

      const filterCommand = new FilterLogEventsCommand(filterParams);
      const filterResponse = await cloudWatchClient.send(filterCommand);

      if (filterResponse.events.length > 0) {
        return filterResponse.events[0];
      }
    }

    return null;
  } catch (error) {
    return ResponseHandler.error(undefined, "Error searching SNS logs", error);
  }
}

/**
 * Generates monthly report based on provided events.
 *
 * This function processes an array of events to count occurrences and collect recipients
 * for various event types (i.e, Bounce, Complaint, Delivery, Send, DeliveryDelay).
 * It returns a JSON object containing these counts and recipient lists, along with the clientTokens parameter.
 *
 * @param {Array<Object>} emailEvents - The list of events to process. Each event object should have the structure:
 *   {
 *     eventType: string, // The type of event (e.g., "Bounce", "Complaint", etc.)
 *     mail: {
 *       destination: Array<string> // List of recipient email addresses
 *     }
 *   }
 * @param {any} clientTokens - A value or object representing the client tokens to be included in the report.
 * @returns {Object}
 */
function buildMonthlyEmailReport(emailEvents) {
  let bounceCount = 0;
  let bounceRecipients = [];

  let complaintCount = 0;
  let complaintRecipients = [];

  let deliveredCount = 0;
  let deliveredRecipients = [];

  let sendCount = 0;
  let sendRecipients = [];

  let deliveryDelayCount = 0;
  let deliveryDelayRecipients = [];

  emailEvents.forEach((event) => {
    switch (event.eventType) {
      case "Bounce":
        bounceCount++;
        bounceRecipients.push(...event.mail.destination);
        break;
      case "Complaint":
        complaintCount++;
        complaintRecipients.push(...event.mail.destination);
        break;
      case "Delivery":
        deliveredCount++;
        deliveredRecipients.push(...event.mail.destination);
        break;
      case "Send":
        sendCount++;
        sendRecipients.push(...event.mail.destination);
        break;
      case "DeliveryDelay":
        deliveryDelayCount++;
        deliveryDelayRecipients.push(...event.mail.destination);
        break;
      default:
        break;
    }
  });

  return {
    bounceCount,
    bounceRecipients,
    complaintCount,
    complaintRecipients,
    deliveredCount,
    deliveredRecipients,
    sendCount,
    sendRecipients,
    deliveryDelayCount,
    deliveryDelayRecipients,
  };
}

/**
 * Builds monthly SMS report by retrieving and parsing SNS logs
 *
 * @param {Array<{ messageId: string }>} smsEvents - List of SMS event objects containing message IDs
 * @returns {Promise<Array<{ mobileNumber: string, phoneCarrier: string, providerResponse: string, status: string }>>} - Promise that resolves to array of SMS report entries
 */
async function buildMonthlySmsReport(smsEvents) {
  const reportEntries = await Promise.all(
    smsEvents.map(async (event) => {
      const logResponse = await searchSnsLogForMessageId(event.messageId);
      if (logResponse == null) {
        return null;
      }

      const parsedLog = JSON.parse(logResponse.message);

      return {
        mobileNumber: parsedLog.delivery.destination,
        phoneCarrier: parsedLog.delivery.phoneCarrier,
        providerResponse: parsedLog.delivery.providerResponse,
        status: parsedLog.status,
      };
    }),
  );

  return reportEntries.filter((entry) => entry !== null);
}
