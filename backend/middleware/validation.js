const { body, validationResult } = require('express-validator');

// Validation middleware for profile creation/update
const validateProfile = [
  // Name validation
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters')
    .trim()
    .escape(),

  // URL validation
  body('url')
    .notEmpty()
    .withMessage('LinkedIn URL is required')
    .isURL()
    .withMessage('Must be a valid URL')
    .custom((value) => {
      if (!value.includes('linkedin.com/in/')) {
        throw new Error('Must be a LinkedIn profile URL (linkedin.com/in/username)');
      }
      return true;
    }),

  // Optional field validations
  body('about')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('About section cannot exceed 5000 characters')
    .trim(),

  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters')
    .trim(),

  body('location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Location cannot exceed 255 characters')
    .trim(),

  body('bioLine')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio line cannot exceed 500 characters')
    .trim(),

  body('headline')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Headline cannot exceed 500 characters')
    .trim(),

  body('industry')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Industry cannot exceed 255 characters')
    .trim(),

  // Numeric field validations
  body('followerCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Follower count must be a non-negative integer')
    .toInt(),

  body('connectionCount')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Connection count must be a non-negative integer')
    .toInt(),

  // Profile picture URL validation
  body('profilePicture')
    .optional()
    .isURL()
    .withMessage('Profile picture must be a valid URL'),

  // JSON array validations
  body('experience')
    .optional()
    .isArray()
    .withMessage('Experience must be an array'),

  body('education')
    .optional()
    .isArray()
    .withMessage('Education must be an array'),

  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),

  // Extraction status validation
  body('extractionStatus')
    .optional()
    .isIn(['pending', 'success', 'failed', 'partial'])
    .withMessage('Extraction status must be: pending, success, failed, or partial'),

  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        })),
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  }
];

// Validation for batch profile creation
const validateBatchProfiles = [
  body('profiles')
    .isArray({ min: 1, max: 50 })
    .withMessage('Profiles must be an array with 1-50 items'),

  body('profiles.*.name')
    .notEmpty()
    .withMessage('Each profile must have a name')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('profiles.*.url')
    .notEmpty()
    .withMessage('Each profile must have a LinkedIn URL')
    .isURL()
    .withMessage('Must be a valid URL')
    .custom((value) => {
      if (!value.includes('linkedin.com/in/')) {
        throw new Error('Must be a LinkedIn profile URL');
      }
      return true;
    }),

  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Batch validation failed',
        errors: errors.array().map(error => ({
          field: error.path,
          message: error.msg,
          value: error.value
        })),
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  }
];

// Rate limiting middleware (simple implementation)
const createRateLimit = (windowMs, max) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    for (const [key, timestamp] of requests.entries()) {
      if (timestamp < windowStart) {
        requests.delete(key);
      }
    }
    
    // Count current requests
    const userRequests = Array.from(requests.entries())
      .filter(([key]) => key.startsWith(ip))
      .length;
    
    if (userRequests >= max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    // Add current request
    requests.set(`${ip}-${now}`, now);
    next();
  };
};

// Export validation middleware
module.exports = {
  validateProfile,
  validateBatchProfiles,
  createRateLimit
};