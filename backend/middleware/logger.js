// Request logging middleware
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    // Log request details
    console.log(`📥 [${timestamp}] ${req.method} ${req.path}`);
    
    // Log request body for POST/PUT requests (but hide sensitive data)
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
        const sanitizedBody = { ...req.body };
        // Hide potential sensitive fields
        if (sanitizedBody.password) sanitizedBody.password = '[HIDDEN]';
        if (sanitizedBody.token) sanitizedBody.token = '[HIDDEN]';
        
        console.log(`📄 Request Body:`, JSON.stringify(sanitizedBody, null, 2));
    }

    // Log response when request finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusColor = res.statusCode >= 400 ? '🔴' : 
                           res.statusCode >= 300 ? '🟡' : '🟢';
        
        console.log(`📤 [${new Date().toISOString()}] ${statusColor} ${res.statusCode} ${req.method} ${req.path} - ${duration}ms`);
    });

    next();
};

// API usage statistics (simple counter)
const apiStats = {
    requests: 0,
    errors: 0,
    startTime: new Date()
};

const statsMiddleware = (req, res, next) => {
    apiStats.requests++;
    
    res.on('finish', () => {
        if (res.statusCode >= 400) {
            apiStats.errors++;
        }
    });

    next();
};

// Endpoint to get API statistics
const getApiStats = (req, res) => {
    const uptime = Date.now() - apiStats.startTime.getTime();
    
    res.json({
        statistics: {
            totalRequests: apiStats.requests,
            totalErrors: apiStats.errors,
            successRate: apiStats.requests > 0 ? 
                ((apiStats.requests - apiStats.errors) / apiStats.requests * 100).toFixed(2) + '%' : '100%',
            uptime: {
                milliseconds: uptime,
                seconds: Math.floor(uptime / 1000),
                minutes: Math.floor(uptime / 60000),
                hours: Math.floor(uptime / 3600000)
            },
            startTime: apiStats.startTime.toISOString()
        }
    });
};

module.exports = {
    requestLogger,
    statsMiddleware,
    getApiStats
};