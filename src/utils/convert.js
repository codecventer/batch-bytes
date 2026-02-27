/**
 * Converts string into specified type
 *
 * @param {string} value - String to convert
 * @param {string} type - Type to convert to, i.e "number", "boolean", "array", "object", "date"
 * @returns {*} - Converted value, or original string if type is not recognized
 * @throws {Error} If input value is not string
 * @throws {Error} If conversion to specified type fails
 * @throws {Error} If specified type is unsupported
 */
export function convertString(value, type) {
  if (typeof value !== "string") {
    throw new Error("Input value must be a string");
  }

  switch (type.toLowerCase()) {
    case "number": {
      const numberValue = Number(value);
      if (isNaN(numberValue)) {
        throw new Error(`Cannot convert "${value}" to a number`);
      }
      return numberValue;
    }
    case "boolean":
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      throw new Error(`Cannot convert "${value}" to a boolean`);

    case "array":
      try {
        const parsedArray = JSON.parse(value);
        if (!Array.isArray(parsedArray)) {
          throw new Error("Expected an array");
        }
        return parsedArray;
      } catch {
        throw new Error(`Cannot convert "${value}" to an array`);
      }

    case "object":
      try {
        const parsedObject = JSON.parse(value);
        if (typeof parsedObject !== "object" || Array.isArray(parsedObject)) {
          throw new Error("Expected an object");
        }
        return parsedObject;
      } catch {
        throw new Error(`Cannot convert "${value}" to an object`);
      }

    case "date": {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        throw new Error(`Cannot convert "${value}" to a date`);
      }
      return dateValue;
    }
    default:
      throw new Error(`Unsupported type "${type}"`);
  }
}

/**
 * Replaces `{}` in message body with parameter values
 *
 * @param {string} messageBody - Message body containing `{}`
 * @param {Array<string>} parameters - Ordered array of values to replace `{}`
 * @returns {string} - Message body with placeholders replaced by corresponding parameter values
 */
export function replacePlaceholders(messageBody, parameters) {
  let index = 0;
  return messageBody.replace(/{}/g, () => {
    const replacement = parameters[index];
    index++;
    return replacement !== undefined ? replacement : "{}";
  });
}
