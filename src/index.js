import {
  createUser,
  getAllUsers,
  getUserTokens,
  getUserByEmail,
  updateUserTokens,
  setUserActiveStatus,
  setUserTokens,
  deleteUserByEmail,
  loginUser,
  triggerPasswordReset,
} from "./auth0.js";
import {
  selectOperation,
  selectBatchType,
  selectAdminOption,
  enterEmailAddress,
  enterPassword,
  enterTokenAmount,
  enterAppliedTokenAmount,
  selectMathOperator,
  selectActiveStatus,
} from "./utils/prompts.js";
import { processSms } from "./sms.js";
import { processWhatsapp } from "./whatsapp.js";
import { processMonthlyReports } from "./report.js";
import { processEmails, verifyEmailAddressSes } from "./email.js";
import "dotenv/config";

async function startMenu() {
  featureFlagStatus();
  const option = await selectOperation();
  if (option == "send") {
    batchType();
  } else if (option == "admin") {
    adminOption();
  }
}

async function batchType() {
  const response = await selectBatchType();
  if (response == "sms") {
    console.log(await processSms(false));
  } else if (response == "email") {
    console.log(await processEmails(false));
  } else if (response == "whatsapp") {
    console.log(await processWhatsapp(false));
  } else if (response == "draft_sms") {
    console.log(await processSms(true));
  } else if (response == "draft_email") {
    console.log(await processEmails(true));
  } else if (response == "draft_whatsapp") {
    console.log(await processWhatsapp(true));
  } else if (response == "monthly_report") {
    console.log(await processMonthlyReports());
  } else if (response == "back") {
    startMenu();
  } else {
    console.log("Eish...");
    return null;
  }
}

async function adminOption() {
  const response = await selectAdminOption();

  if (response == "create_user") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      const password = await enterPassword();
      if (password != null) {
        console.log(await createUser(emailAddress, password));
      }
    }
  } else if (response == "all_users") {
    console.log(await getAllUsers());
  } else if (response == "token_balance") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      console.log(await getUserTokens(emailAddress));
    }
  } else if (response == "user_by_email") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      console.log(await getUserByEmail(emailAddress));
    }
  } else if (response == "update_user_tokens") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      const appliedTokens = await enterAppliedTokenAmount();
      if (appliedTokens != null) {
        const operator = await selectMathOperator();
        if (operator != null) {
          console.log(
            await updateUserTokens(
              emailAddress,
              appliedTokens,
              operator,
              false,
            ),
          );
        }
      }
    }
  } else if (response == "user_status") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      const status = await selectActiveStatus();
      if (status != null) {
        console.log(await setUserActiveStatus(emailAddress, status));
      }
    }
  } else if (response == "set_user_tokens") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      const tokens = await enterTokenAmount();
      if (tokens != null) {
        console.log(await setUserTokens(emailAddress, tokens));
      }
    }
  } else if (response == "delete_user") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      console.log(await deleteUserByEmail(emailAddress));
    }
  } else if (response == "login") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      const password = await enterPassword();
      if (password != null) {
        console.log(await loginUser(emailAddress, password));
      }
    }
  } else if (response == "verify") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      console.log(await verifyEmailAddressSes(emailAddress));
    }
  } else if (response == "reset_password") {
    const emailAddress = await enterEmailAddress();
    if (emailAddress != null) {
      console.log(await triggerPasswordReset(emailAddress));
    }
  } else if (response == "back") {
    startMenu();
  }
}

/**
 * Returns the current boolean value of all feature flags
 */
function featureFlagStatus() {
  console.log("WARNING! Feature Flag Status:\n");
  console.log("Send SMS: " + process.env.NEXT_PUBLIC_ENABLE_SEND_SMS);
  console.log("Send email: " + process.env.NEXT_PUBLIC_ENABLE_SEND_EMAIL);
  console.log("Send WhatsApp: " + process.env.NEXT_PUBLIC_ENABLE_SEND_WHATSAPP);
  console.log(
    "Send Auth0 email: " + process.env.NEXT_PUBLIC_ENABLE_SEND_AUTH0_EMAIL,
  );
  console.log(
    "Send monthly report: " +
      process.env.NEXT_PUBLIC_ENABLE_SEND_MONTHLY_REPORT,
  );
  console.log(
    "Send client log file: " +
      process.env.NEXT_PUBLIC_ENABLE_SEND_LOG_FILE_TO_CLIENT,
  );
  console.log(
    "Send verification email: " +
      process.env.NEXT_PUBLIC_ENABLE_SEND_VERIFICATION_EMAIL,
  );
  console.log(
    "Upload log file to S3: " +
      process.env.NEXT_PUBLIC_ENABLE_UPLOAD_LOG_FILE_TO_S3,
  );
  console.log("\n");
}

startMenu();
