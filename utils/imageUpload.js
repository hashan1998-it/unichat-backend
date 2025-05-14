const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = async (file, folder = 'social-media') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: 'auto',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }, // Limit maximum dimensions
        { quality: 'auto' }, // Automatic quality optimization
        { fetch_format: 'auto' } // Automatic format optimization
      ]
    });
    return result.secure_url;
  } catch (error) {
    throw new Error('Error uploading to Cloudinary: ' + error.message);
  }
};

module.exports = { uploadToCloudinary }; 