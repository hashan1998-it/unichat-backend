const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = async (file, folder = 'social-media', options = {}) => {
  try {
    const defaultTransformations = [
      { width: options.width || 1000, height: options.height || 1000, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ];

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          transformation: options.transformations || defaultTransformations
        },
        (error, result) => {
          if (error) {
            return reject(new Error('Error uploading to Cloudinary: ' + error.message));
          }
          resolve(result.secure_url);
        }
      );

      stream.end(file.buffer);
    });
  } catch (error) {
    throw new Error('Error uploading to Cloudinary: ' + error.message);
  }
};

module.exports = { uploadToCloudinary };