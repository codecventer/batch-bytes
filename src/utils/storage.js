import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";

/**
 * Uploads log file to AWS S3
 *
 * @param {string} filePath - Key (file name) for uploaded file in S3
 * @param {string} logFile - Text file content to upload
 * @returns {Object}
 * @throws {Error} - FilePath or logFile is missing
 * @throws {Error} - Upload to S3 fails
 * @throws {Error} - Uploads disabled via environment variable
 */
export async function uploadLogFileToS3(filePath, logFile) {
  if (!filePath || !logFile) {
    throw new Error("Both file batch and log file required");
  }

  const config = {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY,
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_KEY,
    },
  };
  const s3Client = new S3Client(config);
  const bucketName = process.env.NEXT_PUBLIC_AWS_BUCKET_NAME;
  const params = {
    Bucket: bucketName,
    Key: filePath,
    Body: logFile,
    ContentType: "text/plain",
  };
  const command = new PutObjectCommand(params);

  if (process.env.NEXT_PUBLIC_ENABLE_UPLOAD_LOG_FILE_TO_S3 === "true") {
    try {
      await s3Client.send(command);
    } catch (error) {
      throw new Error("Error uploading log file to S3: " + error);
    }
  } else {
    throw new Error("Upload to S3 disabled");
  }
}
