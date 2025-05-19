/**
 * Populates user-related fields in a query
 * @param {Object} query - Mongoose query object
 * @param {string} fields - Fields to select (default: 'username profilePicture')
 * @returns {Object} Populated query
 */
exports.populateUserFields = (query, fields = 'username profilePicture') => {
    return query
      .populate('user', fields)
      .populate('sender', fields)
      .populate('likes', fields)
      .populate('comments.user', fields);
  };