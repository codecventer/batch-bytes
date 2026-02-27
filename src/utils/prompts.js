import prompts from "prompts";

/**
 * Prompts user to select menu option
 *
 * @returns {string}
 */
export async function selectOperation() {
  const response = await prompts({
    type: "select",
    name: "option",
    message: "Please select option",
    choices: [
      { title: "Send", value: "send" },
      { title: "Admin", value: "admin" },
    ],
  });

  if (!response.option) {
    console.log("No option was selected or prompt was canceled...");
    return null;
  }

  return response.option;
}

/**
 * Prompts user to select batch operation
 *
 * @returns {string}
 */
export async function selectBatchType() {
  const response = await prompts({
    type: "select",
    name: "option",
    message: "Please select option",
    choices: [
      { title: "SMS", value: "sms" },
      { title: "Email", value: "email" },
      { title: "WhatsApp", value: "whatsapp" },
      { title: "Draft SMS", value: "draft_sms" },
      { title: "Draft Email", value: "draft_email" },
      { title: "Draft WhatsApp", value: "draft_whatsapp" },
      { title: "Monthly Reports", value: "monthly_report" },
      { title: "<-Back", value: "back" },
    ],
  });

  if (!response.option) {
    console.log("No option was selected or prompt was canceled...");
    return null;
  }

  return response.option;
}

/**
 * Prompts user to select admin operation
 *
 * @returns {string}
 */
export async function selectAdminOption() {
  const response = await prompts({
    type: "select",
    name: "option",
    message: "Please select option",
    choices: [
      { title: "Create User", value: "create_user" },
      { title: "Get All Users", value: "all_users" },
      { title: "Get User Tokens", value: "token_balance" },
      { title: "Get User By Email", value: "user_by_email" },
      { title: "Update User Tokens", value: "update_user_tokens" },
      { title: "Set User Active Status", value: "user_status" },
      { title: "Set User Tokens", value: "set_user_tokens" },
      { title: "Delete User", value: "delete_user" },
      { title: "Test User Login", value: "login" },
      { title: "Verify Client SES Email", value: "verify" },
      { title: "Reset User Password", value: "reset_password" },
      { title: "<-Back", value: "back" },
    ],
  });

  if (!response.option) {
    console.log("No option was selected or prompt was canceled...");
    return null;
  }

  return response.option;
}

/**
 * Prompts user to enter email address
 *
 * @returns {string}
 */
export async function enterEmailAddress() {
  const response = await prompts({
    type: "text",
    name: "email",
    message: "Please enter email address:",
  });

  if (!response.email) {
    console.log("No email address was entered or prompt was canceled...");
    return null;
  }

  return response.email;
}

/**
 * Prompts user to enter password
 *
 * @returns {string}
 */
export async function enterPassword() {
  const response = await prompts({
    type: "text",
    name: "password",
    message: "Please enter password:",
  });

  if (!response.password) {
    console.log("No password was entered or prompt was canceled...");
    return null;
  }

  return response.password;
}

/**
 * Prompts user to enter token amount
 * WARNING: This overrides the current token value
 *
 * @returns {string}
 */
export async function enterTokenAmount() {
  const response = await prompts({
    type: "text",
    name: "tokens",
    message: "Please enter new token amount:",
  });

  if (!response.tokens) {
    console.log("No token amount was entered or prompt was canceled...");
    return null;
  }

  return response.tokens;
}

/**
 * Prompts user to enter token amount to add or subtract
 *
 * @returns {string}
 */
export async function enterAppliedTokenAmount() {
  const response = await prompts({
    type: "text",
    name: "tokens",
    message: "Please enter token amount to add or subtract:",
  });

  if (!response.tokens) {
    console.log("No token amount was entered or prompt was canceled...");
    return null;
  }

  return response.tokens;
}

/**
 * Prompts user to select mathematical operator for adding or subtracting tokens
 *
 * @returns {string}
 */
export async function selectMathOperator() {
  const response = await prompts({
    type: "select",
    name: "option",
    message: "Please select option",
    choices: [
      { title: "Add", value: "+" },
      { title: "Subtract", value: "-" },
    ],
  });

  if (!response.option) {
    console.log("No option was selected or prompt was canceled...");
    return null;
  }

  return response.option;
}

/**
 * Prompts user to select user status, true or false
 *
 * @returns {string}
 */
export async function selectActiveStatus() {
  const response = await prompts({
    type: "select",
    name: "option",
    message: "Please select option",
    choices: [
      { title: "Active", value: true },
      { title: "Inactive", value: false },
    ],
  });

  if (response.option === undefined) {
    console.log("No option was selected or prompt was canceled...");
    return null;
  }

  return response.option;
}
