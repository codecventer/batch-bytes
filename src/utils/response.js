/**
 * Utility class for generating standardized API response objects
 */
export default class ResponseHandler {
  /**
   * Generates success response object
   *
   * @param {string} [message="Success"] - Success message
   * @param {any} [data=null] - Optional data to include in response
   * @returns {{ statusCode: number, message: string, data: any }}
   */
  static success(message = "Success", data = null) {
    return {
      statusCode: 200,
      message,
      data,
    };
  }

  /**
   * Generates error response object
   *
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [message="An error occurred"] - Error message
   * @param {any} [details=null] - Optional error details
   * @returns {{ statusCode: number, message: string, details: any }}
   */
  static error(
    statusCode = 500,
    message = "An error occurred",
    details = null,
  ) {
    return {
      statusCode,
      message,
      details,
    };
  }

  /**
   * Generates 400 Bad Request response
   *
   * @param {string} [message="Bad Request"] - Error message
   * @param {any} [details=null] - Additional error details
   * @returns {{ statusCode: number, message: string, details: any }}
   */
  static badRequest(message = "Bad Request", details = null) {
    return this.error(400, message, details);
  }

  /**
   * Generates 404 Not Found response
   *
   * @param {string} [message="Not Found"] - Error message
   * @param {any} [details=null] - Additional error details
   * @returns {{ statusCode: number, message: string, details: any }}
   */
  static notFound(message = "Not Found", details = null) {
    return this.error(404, message, details);
  }

  /**
   * Generates 401 Unauthorized response
   *
   * @param {string} [message="Unauthorized"] - Error message
   * @param {any} [details=null] - Additional error details
   * @returns {{ statusCode: number, message: string, details: any }}
   */
  static unauthorized(message = "Unauthorized", details = null) {
    return this.error(401, message, details);
  }
}
