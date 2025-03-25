import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey
  }
});

/**
 * 上传文件到S3
 */
export async function uploadToS3(
  filePath: string,
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key,
    ContentType: contentType,
    Body: require('fs').createReadStream(filePath)
  });

  await s3Client.send(command);
  return `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
}

/**
 * 从S3删除文件
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key
  });

  await s3Client.send(command);
}

/**
 * 获取S3文件的签名URL
 */
export async function getSignedUrlForUpload(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * 获取S3文件内容
 */
export async function getFileContent(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key
  });

  const response = await s3Client.send(command);
  const chunks: Uint8Array[] = [];

  if (!response.Body) {
    throw new Error('文件内容为空');
  }

  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
} 