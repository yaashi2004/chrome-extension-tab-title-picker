// Global error handling middleware
const errorHandler = (error, req, res, next) => {
    // Log error details
    console.error('🚨 ERROR DETAILS:');
    console.error('Time:', new Date().toISOString());
    console.error('Method:', req.method);
    console.error('URL:', req.originalUrl);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Determine error status code
    let statusCode = error.statusCode || error.status || 500;
    
    // Handle different types of errors
    let errorMessage = error.message || 'Internal Server Error';
    let errorType = 'ServerError';

    // Validation errors
    if (error.name === 'ValidationError') {
        statusCode = 400;
        errorType = 'ValidationError';
        errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
    }
    
    // Database errors
    if (error.name === 'SequelizeValidationError') {
        statusCode = 400;
        errorType = 'DatabaseValidationError';
        errorMessage = error.errors.map(e => e.message).join(', ');
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        errorType = 'DuplicateEntryError';
        errorMessage = 'Resource already exists';
    }

    // CORS errors
    if (error.message && error.message.includes('CORS')) {
        statusCode = 403;
        errorType = 'CORSError';
        errorMessage = 'Cross-origin request blocked';
    }

    // Create error response
    const errorResponse = {
        success: false,
        error: {
            type: errorType,
            message: errorMessage,
            statusCode: statusCode,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method
        }
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = error.stack;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
    const errorResponse = {
        success: false,
        error: {
            type: 'RouteNotFound',
            message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
            availableEndpoints: [
                'GET /api - API information',
                'GET /api/health - Server health check',
                'POST /api/profiles - Create profile (Phase 4)',
                'GET /api/profiles - Get all profiles (Phase 4)'
            ]
        }
    };

    res.status(404).json(errorResponse);
};

module.exports = {
    errorHandler,
    notFoundHandler
};