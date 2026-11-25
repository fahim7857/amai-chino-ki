import crypto from 'crypto';

const CLOUDINARY_CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const CLOUDINARY_API_KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const CLOUDINARY_API_SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

export function isCloudinaryConfigured() {
  return Boolean(
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET &&
    CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
    CLOUDINARY_API_KEY !== 'your_api_key' &&
    CLOUDINARY_API_SECRET !== 'your_api_secret'
  );
}

/**
 * Upload an image (base64 data URI or image URL) to Cloudinary.
 * Uses native Node.js crypto and fetch so no extra binary dependencies are needed.
 */
export async function uploadToCloudinary(fileDataUriOrUrl, folder = 'who-knows-me-better/avatars') {
  if (!fileDataUriOrUrl || typeof fileDataUriOrUrl !== 'string') {
    throw new Error('A valid image data string is required for upload.');
  }

  // If user has not replaced placeholder credentials yet, provide clean dev fallback
  if (!isCloudinaryConfigured()) {
    if (fileDataUriOrUrl.startsWith('data:image/')) {
      return {
        secure_url: fileDataUriOrUrl,
        public_id: `fallback_${Date.now()}`,
      };
    }
    throw new Error(
      'Cloudinary credentials are not configured. Please add your CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file.'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const payload = {
    file: fileDataUriOrUrl,
    api_key: CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  };

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    const errorMsg = data.error?.message || response.statusText || 'Upload failed';
    throw new Error(`Cloudinary upload failed: ${errorMsg}`);
  }

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
  };
}
