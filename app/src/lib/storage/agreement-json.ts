import { uploadFileToS3, generateS3Key } from './aws';

export interface TestJsonContent {
	text: string;
}

/**
 * Create a JSON file and upload it to S3 in the /test folder
 * @param content - The JSON content to upload (defaults to { text: "Hello World" })
 * @returns The URL and key of the uploaded file
 */
export async function createAndUploadTestJson(
	content: TestJsonContent = { text: 'Hello World' }
): Promise<{ url: string; key: string }> {
	// Convert JSON content to a File object (browser-compatible)
	const jsonString = JSON.stringify(content, null, 2);
	const jsonFile = new File([jsonString], 'test.json', { type: 'application/json' });

	// Generate a unique key in the /test folder
	const key = generateS3Key('test.json', 'test');

	// Upload to S3
	return await uploadFileToS3(jsonFile, key);
}
