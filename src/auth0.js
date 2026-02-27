import axios from "axios";
import {
  emailUserCreated,
  emailAdminUserSignUp,
  emailUserActiveStatus,
  verifyEmailAddressSes,
  emailUserTokensUpdated,
} from "../src/email.js";
import { isValidEmail } from "./utils/validate.js";
import ResponseHandler from "../src/utils/response.js";
import "dotenv/config";

/**
 * Creates a new user with a given email address and password
 *
 * @param {string} emailAddress
 * @param {string} password
 * @returns {Promise<Object>}
 * @throws {Error} - Send emails or verifying email address fails
 */
export async function createUser(emailAddress, password) {
  if (!isValidEmail(emailAddress)) {
    return ResponseHandler.error(
      undefined,
      `Invalid email address: ${emailAddress}`,
      undefined,
    );
  }

  const paymentReference = createPaymentReference(emailAddress);
  let createUserResponse;

  const userData = {
    email: emailAddress,
    password: password,
    connection: process.env.NEXT_PUBLIC_AUTH0_CONNECTION_NAME,
    user_metadata: {
      product: "batch_bytes",
      wa_access_token: "",
      wa_phone_number_id: "",
      payment_reference: paymentReference,
      is_active: true,
      tokens: 10,
    },
  };

  const options = {
    method: "POST",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    data: userData,
  };

  try {
    createUserResponse = await axios.request(options);
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to create new user",
      error?.response?.data?.message,
    );
  }

  try {
    await Promise.all([
      (async () => {
        try {
          await emailUserCreated(
            createUserResponse.data.nickname,
            emailAddress,
          );
        } catch (error) {
          throw new Error(
            "Failed to send user creation email: " + error.message,
          );
        }
      })(),
      (async () => {
        let retries = 0;
        let verifyEmailResponse;

        while (retries < process.env.NEXT_PUBLIC_MAX_RETRIES) {
          verifyEmailResponse = await verifyEmailAddressSes(emailAddress);
          if (verifyEmailResponse.statusCode === 200) {
            break;
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (verifyEmailResponse.statusCode !== 200) {
          throw new Error(
            "Failed to send verify email address: " +
              verifyEmailResponse.details,
          );
        }
      })(),
      (async () => {
        try {
          await emailAdminUserSignUp(emailAddress, paymentReference);
        } catch (error) {
          throw new Error("Failed to send admin email: " + error.message);
        }
      })(),
    ]);

    const nickname = createUserResponse.data.nickname;
    const tokens = createUserResponse.data.user_metadata.tokens;

    return ResponseHandler.success("Successfully created new user", {
      emailAddress,
      nickname,
      paymentReference,
      tokens,
    });
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to send verification email(s)",
      error.message,
    );
  }
}

/**
 * Fetches all users
 *
 * @returns {Promise<Object>}
 */
export async function getAllUsers() {
  const options = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const getAllUsersResponse = await axios.request(options);
    return ResponseHandler.success(
      "Successfully fetched all users",
      getAllUsersResponse.data,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to fetch all users",
      error?.response?.data?.message,
    );
  }
}

/**
 * Fetches user by email address
 *
 * @param {string} emailAddress
 * @returns {Promise<Object>}
 */
export async function getUserByEmail(emailAddress) {
  const options = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const getUserByEmailResponse = await axios.request(options);
    if (getUserByEmailResponse.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    } else {
      return ResponseHandler.success(
        "Successfully fetched user by email",
        getUserByEmailResponse.data,
      );
    }
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to fetch user by email",
      error?.response?.data?.message,
    );
  }
}

/**
 * Sets the is_active user metadata of a given user
 *
 * @param {string} emailAddress
 * @param {boolean} isActive
 * @returns {Promise<Object>|string} - JSON response or string response
 */
export async function setUserActiveStatus(emailAddress, isActive) {
  let setUserActiveStatusResponse;

  const optionsGet = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const getResponse = await axios.request(optionsGet);
    if (getResponse.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    }

    const userId = getResponse.data[0].user_id;
    const updatedMetadata = {
      user_metadata: {
        is_active: isActive,
      },
    };

    const optionsUpdate = {
      method: "PATCH",
      url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${userId}`,
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: updatedMetadata,
    };

    try {
      setUserActiveStatusResponse = await axios.request(optionsUpdate);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to set user active status",
        error,
      );
    }

    const clientName = setUserActiveStatusResponse.data.nickname;
    const clientActiveStatus =
      setUserActiveStatusResponse.data.user_metadata.is_active;

    try {
      await emailUserActiveStatus(clientName, emailAddress, clientActiveStatus);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to email user active status",
        error.message,
      );
    }

    if (clientActiveStatus) {
      try {
        await verifyEmailAddressSes(emailAddress);
      } catch (error) {
        return ResponseHandler.error(
          undefined,
          "Failed to send user verify email",
          error,
        );
      }
    }

    return ResponseHandler.success(
      "Successfully set user active status",
      setUserActiveStatusResponse.data,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to set user active status",
      error?.response?.data?.message,
    );
  }
}

/**
 * Sets the token value of a given user
 * WARNING: This overrides the current token value
 *
 * @param {string} emailAddress
 * @param {number} newTokenAmount
 * @returns {Promise<Object>|string} - JSON response or string response
 */
export async function setUserTokens(emailAddress, newTokenAmount) {
  let setUserTokensResponse;

  const optionsGet = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  if (isNaN(newTokenAmount)) {
    return ResponseHandler.badRequest("Invalid token amount", newTokenAmount);
  }

  try {
    const getResponse = await axios.request(optionsGet);
    if (getResponse.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    }

    const userId = getResponse.data[0].user_id;
    const updatedMetadata = {
      user_metadata: {
        tokens: newTokenAmount,
      },
    };

    const optionsUpdate = {
      method: "PATCH",
      url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${userId}`,
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: updatedMetadata,
    };

    try {
      setUserTokensResponse = await axios.request(optionsUpdate);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to set user tokens",
        error.message,
      );
    }

    const clientName = setUserTokensResponse.data.nickname;
    const clientTokens = setUserTokensResponse.data.user_metadata.tokens;

    try {
      await emailUserTokensUpdated(clientName, emailAddress, clientTokens);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to send user tokens updated email",
        error.message,
      );
    }

    return ResponseHandler.success(
      "Successfully set user tokens",
      setUserTokensResponse.data.user_metadata.tokens,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to set user tokens",
      error?.response?.data?.message,
    );
  }
}

/**
 * Updates the given user's token amount by either adding or deducting a given amount
 *
 * @param {string} emailAddress
 * @param {number} tokenAmount - Amount to add or subtract from user's current token amount
 * @param {string} mathOperator - Should either be "+" or "-"
 * @param {boolean} isBatch - If true, do not send client tokens updated email
 * @returns {Promise<Object>|string} - JSON response or string response
 */
export async function updateUserTokens(
  emailAddress,
  tokenAmount,
  mathOperator,
  isBatch,
) {
  let updatedTokenAmount;
  let updateUserTokensResponse;

  const optionsGet = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await axios.request(optionsGet);
    if (response.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    }

    const user = response.data[0];
    const userId = user.user_id;
    const currentTokens = Number(user.user_metadata?.tokens || 0);
    const tokenAmountNumber = Number(tokenAmount);
    if (isNaN(tokenAmountNumber)) {
      return ResponseHandler.badRequest("Invalid token amount", tokenAmount);
    }

    if (mathOperator === "+") {
      updatedTokenAmount = currentTokens + tokenAmountNumber;
    } else if (mathOperator === "-") {
      updatedTokenAmount = currentTokens - tokenAmountNumber;
    } else {
      return ResponseHandler.error(
        undefined,
        "A subtraction or addition mathematical operator is required",
        undefined,
      );
    }

    const updatedMetadata = {
      user_metadata: {
        tokens: updatedTokenAmount,
      },
    };

    const optionsUpdate = {
      method: "PATCH",
      url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${userId}`,
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: updatedMetadata,
    };

    try {
      updateUserTokensResponse = await axios.request(optionsUpdate);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to update user tokens",
        error.message,
      );
    }

    const clientName = updateUserTokensResponse.data.nickname;
    const clientTokens = updateUserTokensResponse.data.user_metadata.tokens;

    if (!isBatch) {
      try {
        await emailUserTokensUpdated(clientName, emailAddress, clientTokens);
      } catch (error) {
        return ResponseHandler.error(
          undefined,
          "Failed to send user tokens updated email",
          error,
        );
      }
    }

    return ResponseHandler.success(
      "Successfully updated user tokens",
      updateUserTokensResponse.data.user_metadata.tokens,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to update user tokens",
      error?.response?.data?.message,
    );
  }
}

/**
 * Deletes user by email address
 *
 * @param {string} emailAddress
 * @returns {Promise<Object>|string} - JSON response or string response
 */
export async function deleteUserByEmail(emailAddress) {
  let deleteUserResponse;

  const optionsGet = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const getResponse = await axios.request(optionsGet);
    if (getResponse.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    }

    const userId = getResponse.data[0].user_id;
    const optionsDelete = {
      method: "DELETE",
      url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${userId}`,
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
      },
    };

    try {
      deleteUserResponse = await axios.request(optionsDelete);
    } catch (error) {
      return ResponseHandler.error(
        undefined,
        "Failed to delete user",
        error.message,
      );
    }

    return ResponseHandler.success(
      "Successfully deleted user",
      deleteUserResponse.statusText,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to delete user",
      error?.response?.data?.message,
    );
  }
}

/**
 * Mock user login
 *
 * @param {string} emailAddress
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginUser(emailAddress, password) {
  const options = {
    method: "POST",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/oauth/token`,
    headers: { "Content-Type": "application/json" },
    data: {
      grant_type: "password",
      username: emailAddress,
      password: password,
      client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
      client_secret: process.env.NEXT_PUBLIC_AUTH0_CLIENT_SECRET,
      realm: "Username-Password-Authentication",
    },
  };

  try {
    const loginResponse = await axios.request(options);
    return ResponseHandler.success(
      "Successfully logged in user",
      loginResponse.data.scope,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to login user",
      error?.response?.data?.error_description,
    );
  }
}

/**
 * Triggers password reset email to specified user's email address
 *
 * @param {string} emailAddress - Email address of user to reset password
 * @returns {Promise<Object>}
 */
export async function triggerPasswordReset(emailAddress) {
  let getUserByEmailResponse;

  const getUserOptions = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    getUserByEmailResponse = await axios.request(getUserOptions);
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to trigger password reset",
      error?.response?.data?.message,
    );
  }

  if (getUserByEmailResponse.data.length === 0) {
    return ResponseHandler.notFound("User not found", emailAddress);
  }

  const changePasswordOptions = {
    method: "POST",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/dbconnections/change_password`,
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
      email: emailAddress,
      connection: "Username-Password-Authentication",
    },
  };

  try {
    const resetPasswordResponse = await axios.request(changePasswordOptions);
    return ResponseHandler.success(
      "Successfully triggered password reset",
      resetPasswordResponse.data,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to trigger password reset",
      error.message,
    );
  }
}

/**
 * Retrieves token balance of user by email address
 *
 * @param {string} emailAddress
 * @returns {Promise<Object>}
 */
export async function getUserTokens(emailAddress) {
  const user = await getUserByEmail(emailAddress);
  if (user.statusCode !== 200) {
    return ResponseHandler.error(
      undefined,
      "Failed to fetch user tokens",
      user.details,
    );
  }
  return ResponseHandler.success(
    "Successfully fetched user tokens",
    user.data[0].user_metadata.tokens,
  );
}

/**
 * Updates user's WhatsApp credentials
 *
 * @param {string} emailAddress
 * @param {string} accessToken
 * @param {string} phoneNumberId
 * @returns {Promise<Object>}
 */
export async function updateUserWhatsAppCredentials(
  emailAddress,
  accessToken,
  phoneNumberId,
) {
  const optionsGet = {
    method: "GET",
    url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users`,
    params: { q: `email:${emailAddress}`, search_engine: "v3" },
    headers: {
      authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
    },
  };

  try {
    const response = await axios.request(optionsGet);
    if (response.data.length === 0) {
      return ResponseHandler.notFound("User not found", emailAddress);
    }

    const user = response.data[0];
    const userId = user.user_id;
    const updatedMetadata = {
      user_metadata: {
        wa_access_token: accessToken,
        wa_phone_number_id: phoneNumberId,
      },
    };

    const optionsUpdate = {
      method: "PATCH",
      url: `${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/api/v2/users/${userId}`,
      headers: {
        authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH0_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: updatedMetadata,
    };
    const updateUserTokensResponse = await axios.request(optionsUpdate);

    return ResponseHandler.success(
      "Successfully updated user WhatsApp credentials",
      updateUserTokensResponse.data,
    );
  } catch (error) {
    return ResponseHandler.error(
      undefined,
      "Failed to update user WhatsApp credentials",
      error.message,
    );
  }
}

/**
 * Generates unique payment reference using email address
 * Reference format, "PAY-XXX-NAMEPART":
 * - XXX, random 3-digit number
 * - NAMEPART, uppercase portion of email before "@" symbol
 *
 * @param {string} emailAddress - Email address to generate payment reference from
 * @returns {string} - The generated payment reference.
 */
function createPaymentReference(emailAddress) {
  const namePart = emailAddress.split("@")[0].toUpperCase();
  const randomNumber = Math.floor(100 + Math.random() * 900);

  return `PAY-${randomNumber}-${namePart}`;
}
