import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { lookup } from 'mime-types';

// Initialize S3 client with environment variables
const s3Client = new S3Client({
	region: process.env.AWS_REGION || 'ap-southeast-1',
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
	},
});

const bucketName = process.env.AWS_S3_BUCKET || '';

/**
 * Upload a file to S3
 * @param file - The file to upload (File, Blob, or Buffer)
 * @param key - The S3 key (path) where the file will be stored
 * @returns The URL of the uploaded file
 */
export async function uploadFileToS3(
	file: File | Buffer,
	key: string
): Promise<{ url: string; key: string }> {
	// Get file content and mime type
	let body: Buffer;
	let contentType: string;

	if (file instanceof File) {
		// Browser File object
		const arrayBuffer = await file.arrayBuffer();
		body = Buffer.from(arrayBuffer);
		contentType = file.type || lookup(key) || 'application/octet-stream';
	} else {
		// Node.js Buffer
		body = file;
		contentType = lookup(key) || 'application/octet-stream';
	}

	const params: PutObjectCommandInput = {
		Bucket: bucketName,
		Key: key,
		Body: body,
		ContentType: contentType,
	};

	try {
		await s3Client.send(new PutObjectCommand(params));

		// Return the S3 object URL
		const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${key}`;
		return { url, key };
	} catch (error) {
		console.error('Error uploading to S3:', error);
		throw new Error('Failed to upload file to S3');
	}
}

/**
 * Delete a file from S3
 * @param key - The S3 key of the file to delete
 */
export async function deleteFileFromS3(key: string): Promise<void> {
	const params = {
		Bucket: bucketName,
		Key: key,
	};

	try {
		await s3Client.send(new DeleteObjectCommand(params));
	} catch (error) {
		console.error('Error deleting from S3:', error);
		throw new Error('Failed to delete file from S3');
	}
}

/**
 * Get a file from S3
 * @param key - The S3 key of the file to fetch
 * @returns The file buffer, content type, and metadata
 */
export async function getFileFromS3(key: string): Promise<{
	body: Buffer;
	contentType: string;
	contentLength: number;
	fileName: string;
}> {
	const params = {
		Bucket: bucketName,
		Key: key,
	};

	try {
		const command = new GetObjectCommand(params);
		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new Error('No file body received from S3');
		}

		// Convert the body to a Buffer
		const bodyBytes = await response.Body.transformToByteArray();
		const buffer = Buffer.from(bodyBytes);

		// Extract filename from key
		const fileName = key.split('/').pop() || 'file';

		return {
			body: buffer,
			contentType: response.ContentType || 'application/octet-stream',
			contentLength: response.ContentLength || buffer.length,
			fileName,
		};
	} catch (error) {
		console.error('Error getting file from S3:', error);
		throw new Error('Failed to get file from S3');
	}
}

/**
 * Generate a unique S3 key for a file
 * @param fileName - The original file name
 * @param folder - The folder path (optional, defaults to 'uploads')
 * @returns A unique S3 key
 */
export function generateS3Key(fileName: string, folder: string = 'uploads'): string {
	const timestamp = Date.now();
	const randomString = Math.random().toString(36).substring(2, 15);
	const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
	return `${folder}/${timestamp}-${randomString}-${sanitizedName}`;
}

/**
 * Get a viewable URL for an S3 file through your domain
 * @param key - The S3 key of the file
 * @returns A URL that can be used to view/download the file
 * @example
 * const url = getFileUrl('uploads/1234-abc-file.pdf')
 * // Returns: '/api/file/uploads/1234-abc-file.pdf'
 */
export function getFileUrl(key: string): string {
	return `/api/file/${key}`;
}

/**
 * Extract the S3 key from a file URL
 * @param url - The file URL (can be S3 URL or domain URL)
 * @returns The S3 key
 * @example
 * extractKeyFromUrl('https://bucket.s3.amazonaws.com/uploads/file.pdf')
 * // Returns: 'uploads/file.pdf'
 * 
 * extractKeyFromUrl('/api/file/uploads/file.pdf')
 * // Returns: 'uploads/file.pdf'
 */
export function extractKeyFromUrl(url: string): string {
	// Handle domain URLs like /api/file/uploads/file.pdf
	if (url.startsWith('/api/file/')) {
		return url.replace('/api/file/', '');
	}
	
	// Handle full S3 URLs like https://bucket.s3.region.amazonaws.com/uploads/file.pdf
	const match = url.match(/\.amazonaws\.com\/(.+)$/);
	if (match) {
		return match[1];
	}
	
	// If it's already a key, return as is
	return url;
}

export { s3Client, bucketName };
