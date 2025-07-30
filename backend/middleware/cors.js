const cors = require('cors');

// CORS configuration for Chrome Extension
const corsOptions = {
    origin: function (origin, callback) {
        // Allow Chrome extensions (they have chrome-extension:// protocol)
        if (!origin || origin.startsWith('chrome-extension://')) {
            callback(null, true);
        }
        // Allow localhost for development
        else if (origin && origin.includes('localhost')) {
            callback(null, true);
        }
        // Allow specific domains in production
        else if (origin && ['https://yourdomain.com'].includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
};

module.exports = cors(corsOptions);