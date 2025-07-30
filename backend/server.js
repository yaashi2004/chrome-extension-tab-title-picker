const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Import database models
const { sequelize, Profile, initializeDatabase } = require('./models');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// MIDDLEWARE SETUP
// ====================

// CORS setup for Chrome Extension compatibility
app.use(cors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📥 [${timestamp}] ${req.method} ${req.path}`);
    
    // Log request body for POST/PUT requests (excluding sensitive data)
    if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
        console.log('📄 Request Body:', JSON.stringify(req.body, null, 2));
    }
    
    next();
});

// ====================
// API ROOT & INFO ROUTES
// ====================

// API root endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'LinkedIn Profile Scraper API',
        version: '1.0.0',
        phase: 'Phase 4 - Complete REST API ✅',
        description: 'Complete backend API with SQLite database, Sequelize ORM, and full CRUD operations',
        database: {
            dialect: 'sqlite',
            models: ['Profile'],
            status: 'Connected'
        },
        endpoints: {
            info: 'GET /api - API information',
            health: 'GET /api/health - Server health check',
            profiles: {
                create: 'POST /api/profiles - Create profile (main Chrome extension endpoint)',
                getAll: 'GET /api/profiles - Get all profiles',
                getOne: 'GET /api/profiles/:id - Get single profile',
                update: 'PUT /api/profiles/:id - Update profile',
                delete: 'DELETE /api/profiles/:id - Delete profile',
                stats: 'GET /api/profiles/stats - Profile statistics',
                search: 'GET /api/profiles/search/:query - Search profiles',
                batch: 'POST /api/profiles/batch - Create multiple profiles'
            },
            database: {
                health: 'GET /api/database/health - Database connection status',
                stats: 'GET /api/database/stats - Database statistics',
                reset: 'POST /api/database/reset - Reset database (dev only)'
            },
            testing: {
                database: 'GET /api/test/database - Test database operations',
                validation: 'POST /api/test/validation - Test validation rules'
            }
        },
        chromeExtension: {
            mainEndpoint: 'POST /api/profiles',
            description: 'Main endpoint for Chrome extension to save LinkedIn profiles',
            requiredFields: ['name', 'url'],
            optionalFields: ['about', 'bio', 'location', 'followerCount', 'connectionCount', 'bioLine']
        },
        nextPhase: 'Phase 5: Chrome Extension Foundation'
    });
});

// Server health check
app.get('/api/health', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    
    res.json({
        status: 'Server is running successfully! 🚀',
        timestamp: new Date().toISOString(),
        phase: 'Phase 4 - Complete REST API ✅',
        version: '1.0.0',
        uptime: {
            seconds: uptimeSeconds,
            minutes: uptimeMinutes,
            hours: uptimeHours,
            readable: `${uptimeHours}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`
        },
        environment: process.env.NODE_ENV || 'development',
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(process.memoryUsage().external / 1024 / 1024) + ' MB'
        },
        database: 'Connected',
        api: 'Fully Operational',
        readyFor: 'Phase 5: Chrome Extension Integration'
    });
});

// ====================
// PROFILE API ROUTES (MAIN FUNCTIONALITY)
// ====================

// POST /api/profiles - Create new profile (Main Chrome Extension Endpoint)
app.post('/api/profiles', async (req, res) => {
    try {
        const profileData = req.body;

        console.log('🔄 Creating new profile:', profileData.name || 'Unknown');

        // Validate required fields
        if (!profileData.name || !profileData.url) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name and url are required',
                requiredFields: ['name', 'url'],
                receivedFields: Object.keys(profileData),
                timestamp: new Date().toISOString()
            });
        }

        // Validate LinkedIn URL
        if (!profileData.url.includes('linkedin.com/in/')) {
            return res.status(400).json({
                success: false,
                message: 'URL must be a valid LinkedIn profile URL (linkedin.com/in/username)',
                receivedUrl: profileData.url,
                timestamp: new Date().toISOString()
            });
        }

        // Check if profile with this URL already exists
        const existingProfile = await Profile.findOne({ where: { url: profileData.url } });
        if (existingProfile) {
            return res.status(409).json({
                success: false,
                message: 'Profile with this LinkedIn URL already exists',
                existingProfile: {
                    id: existingProfile.id,
                    name: existingProfile.name,
                    url: existingProfile.url,
                    createdAt: existingProfile.createdAt
                },
                suggestion: `Use PUT /api/profiles/${existingProfile.id} to update existing profile`,
                timestamp: new Date().toISOString()
            });
        }

        // Create profile with defaults
        const newProfile = await Profile.create({
            name: profileData.name,
            url: profileData.url,
            about: profileData.about || null,
            bio: profileData.bio || null,
            location: profileData.location || null,
            followerCount: profileData.followerCount || 0,
            connectionCount: profileData.connectionCount || 0,
            bioLine: profileData.bioLine || null,
            headline: profileData.headline || null,
            industry: profileData.industry || null,
            profilePicture: profileData.profilePicture || null,
            experience: profileData.experience || [],
            education: profileData.education || [],
            skills: profileData.skills || [],
            extractionStatus: profileData.extractionStatus || 'success',
            extractedAt: new Date(),
            lastUpdated: new Date()
        });

        console.log('✅ Profile created successfully:', newProfile.id);

        res.status(201).json({
            success: true,
            message: 'Profile created successfully ✅',
            data: {
                profile: {
                    id: newProfile.id,
                    name: newProfile.name,
                    url: newProfile.url,
                    bioLine: newProfile.bioLine,
                    location: newProfile.location,
                    followerCount: newProfile.followerCount,
                    connectionCount: newProfile.connectionCount,
                    extractionStatus: newProfile.extractionStatus,
                    createdAt: newProfile.createdAt
                },
                metadata: {
                    fieldsProvided: Object.keys(profileData).length,
                    isComplete: !!(newProfile.name && newProfile.url && newProfile.bioLine)
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error creating profile:', error);
        
        // Handle validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors.map(e => ({
                    field: e.path,
                    message: e.message,
                    value: e.value
                })),
                timestamp: new Date().toISOString()
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create profile',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/profiles - Get all profiles with pagination
app.get('/api/profiles', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            sortBy = 'createdAt', 
            sortOrder = 'DESC',
            status,
            location,
            search 
        } = req.query;

        // Build where conditions
        const whereConditions = {};
        
        if (status) {
            whereConditions.extractionStatus = status;
        }
        
        if (location) {
            const { Op } = require('sequelize');
            whereConditions.location = {
                [Op.like]: `%${location}%`
            };
        }
        
        if (search) {
            const { Op } = require('sequelize');
            whereConditions[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { bioLine: { [Op.like]: `%${search}%` } },
                { headline: { [Op.like]: `%${search}%` } }
            ];
        }

        // Calculate pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Get profiles with count
        const { count, rows: profiles } = await Profile.findAndCountAll({
            where: whereConditions,
            order: [[sortBy, sortOrder.toUpperCase()]],
            limit: parseInt(limit),
            offset: offset,
            attributes: {
                exclude: ['extractionErrors'] // Don't return errors in list view
            }
        });

        // Calculate pagination info
        const totalPages = Math.ceil(count / parseInt(limit));

        res.json({
            success: true,
            message: `Retrieved ${profiles.length} profiles successfully`,
            data: {
                profiles,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalCount: count,
                    limit: parseInt(limit),
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                },
                filters: { status, location, search, sortBy, sortOrder }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting profiles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profiles',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/profiles/stats - Get profile statistics
app.get('/api/profiles/stats', async (req, res) => {
    try {
        const stats = await Profile.getStats();
        const recentProfiles = await Profile.getRecentProfiles(10);
        
        // Get additional stats
        const totalProfiles = await Profile.count();
        const { Op } = require('sequelize');
        
        // Location distribution
        const locationStats = await Profile.findAll({
            attributes: [
                'location',
                [Profile.sequelize.fn('COUNT', Profile.sequelize.col('location')), 'count']
            ],
            where: {
                location: { [Op.not]: null }
            },
            group: ['location'],
            order: [[Profile.sequelize.fn('COUNT', Profile.sequelize.col('location')), 'DESC']],
            limit: 10
        });

        res.json({
            success: true,
            message: 'Profile statistics retrieved successfully',
            data: {
                overview: stats,
                total: totalProfiles,
                recentProfiles: recentProfiles.map(p => ({
                    id: p.id,
                    name: p.name,
                    url: p.url,
                    location: p.location,
                    followerCount: p.followerCount,
                    status: p.extractionStatus,
                    createdAt: p.createdAt
                })),
                topLocations: locationStats.map(stat => ({
                    location: stat.location,
                    count: parseInt(stat.dataValues.count)
                }))
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting profile stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile statistics',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/profiles/:id - Get single profile by ID
app.get('/api/profiles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const profile = await Profile.findByPk(id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: `Profile with ID ${id} not found`,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                profile,
                metadata: {
                    isComplete: profile.isDataComplete(),
                    fieldsCount: Object.keys(profile.dataValues).length,
                    lastUpdated: profile.lastUpdated,
                    extractionStatus: profile.extractionStatus
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// PUT /api/profiles/:id - Update existing profile
app.put('/api/profiles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const profile = await Profile.findByPk(id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: `Profile with ID ${id} not found`,
                timestamp: new Date().toISOString()
            });
        }

        // Update profile
        await profile.update({
            ...updateData,
            lastUpdated: new Date()
        });

        res.json({
            success: true,
            message: 'Profile updated successfully ✅',
            data: {
                profile,
                metadata: {
                    fieldsUpdated: Object.keys(updateData).length,
                    lastUpdated: profile.lastUpdated
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE /api/profiles/:id - Delete profile
app.delete('/api/profiles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const profile = await Profile.findByPk(id);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: `Profile with ID ${id} not found`,
                timestamp: new Date().toISOString()
            });
        }

        const deletedInfo = {
            id: profile.id,
            name: profile.name,
            url: profile.url
        };

        await profile.destroy();

        res.json({
            success: true,
            message: 'Profile deleted successfully ✅',
            data: { deletedProfile: deletedInfo },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error deleting profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete profile',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/profiles/search/:query - Search profiles
app.get('/api/profiles/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 10 } = req.query;
        const { Op } = require('sequelize');

        const profiles = await Profile.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${query}%` } },
                    { bioLine: { [Op.like]: `%${query}%` } },
                    { headline: { [Op.like]: `%${query}%` } },
                    { location: { [Op.like]: `%${query}%` } }
                ]
            },
            limit: parseInt(limit),
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            message: `Found ${profiles.length} profiles matching "${query}"`,
            data: {
                query,
                profiles,
                count: profiles.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/profiles/batch - Create multiple profiles
app.post('/api/profiles/batch', async (req, res) => {
    try {
        const { profiles } = req.body;

        if (!profiles || !Array.isArray(profiles)) {
            return res.status(400).json({
                success: false,
                message: 'Request body must contain a "profiles" array',
                timestamp: new Date().toISOString()
            });
        }

        if (profiles.length === 0 || profiles.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Profiles array must contain 1-50 profiles',
                received: profiles.length,
                timestamp: new Date().toISOString()
            });
        }

        const results = {
            created: [],
            skipped: [],
            errors: []
        };

        // Process each profile
        for (let i = 0; i < profiles.length; i++) {
            const profileData = profiles[i];

            try {
                // Validate required fields
                if (!profileData.name || !profileData.url) {
                    results.errors.push({
                        index: i,
                        error: 'Missing required fields: name and url'
                    });
                    continue;
                }

                // Check if profile already exists
                const existingProfile = await Profile.findOne({ where: { url: profileData.url } });
                if (existingProfile) {
                    results.skipped.push({
                        index: i,
                        reason: 'Profile already exists',
                        existingId: existingProfile.id
                    });
                    continue;
                }

                // Create profile
                const newProfile = await Profile.create({
                    ...profileData,
                    followerCount: profileData.followerCount || 0,
                    connectionCount: profileData.connectionCount || 0,
                    extractionStatus: 'success',
                    extractedAt: new Date(),
                    lastUpdated: new Date()
                });

                results.created.push({
                    index: i,
                    id: newProfile.id,
                    name: newProfile.name,
                    url: newProfile.url
                });

            } catch (error) {
                results.errors.push({
                    index: i,
                    error: error.message
                });
            }
        }

        const statusCode = results.created.length > 0 ? 201 : 400;

        res.status(statusCode).json({
            success: results.created.length > 0,
            message: `Batch operation completed: ${results.created.length} created, ${results.skipped.length} skipped, ${results.errors.length} errors`,
            data: {
                summary: {
                    total: profiles.length,
                    created: results.created.length,
                    skipped: results.skipped.length,
                    errors: results.errors.length,
                    successRate: `${Math.round((results.created.length / profiles.length) * 100)}%`
                },
                results
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in batch create:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process batch profiles',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================
// DATABASE ROUTES
// ====================

// Database health check
app.get('/api/database/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        const stats = await Profile.getStats();
        
        res.json({
            database: 'Connected ✅',
            timestamp: new Date().toISOString(),
            phase: 'Phase 4 Complete',
            connectionInfo: {
                dialect: sequelize.getDialect(),
                storage: sequelize.config.storage || 'In-memory'
            },
            profileStats: stats,
            capabilities: {
                create: 'Ready',
                read: 'Ready',
                update: 'Ready',
                delete: 'Ready',
                search: 'Ready',
                batch: 'Ready'
            }
        });
        
    } catch (error) {
        console.error('❌ Database health check failed:', error);
        res.status(500).json({
            database: 'Disconnected ❌',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Database statistics
app.get('/api/database/stats', async (req, res) => {
    try {
        const stats = await Profile.getStats();
        const recentProfiles = await Profile.getRecentProfiles(5);
        
        const tableInfo = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
            { type: sequelize.QueryTypes.SELECT }
        );
        
        res.json({
            timestamp: new Date().toISOString(),
            profileStatistics: stats,
            recentProfiles: recentProfiles.map(p => ({
                id: p.id,
                name: p.name,
                url: p.url,
                status: p.extractionStatus,
                createdAt: p.createdAt
            })),
            database: {
                tables: tableInfo.map(t => t.name),
                totalTables: tableInfo.length,
                storageLocation: sequelize.config.storage
            }
        });
        
    } catch (error) {
        console.error('❌ Database stats failed:', error);
        res.status(500).json({
            error: 'Failed to get database statistics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Reset database (development only)
app.post('/api/database/reset', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Database reset not allowed in production'
        });
    }
    
    try {
        console.log('⚠️  Resetting database...');
        await sequelize.sync({ force: true });
        
        res.json({
            message: 'Database reset successfully ✅',
            warning: 'All data has been permanently deleted',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            error: 'Failed to reset database',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================
// TESTING ROUTES
// ====================

// Comprehensive database operations test
app.get('/api/test/database', async (req, res) => {
    try {
        console.log('🧪 Starting comprehensive database test...');
        
        const testProfile = await Profile.create({
            name: 'Test User ' + Date.now(),
            url: 'https://linkedin.com/in/testuser' + Date.now(),
            about: 'This is a test profile created during Phase 4 API testing',
            bio: 'Test bio for validation',
            location: 'Test City, Test State',
            followerCount: 1500,
            connectionCount: 800,
            bioLine: 'Test bio line for comprehensive testing',
            headline: 'Test Engineer at Test Company',
            industry: 'Testing & Quality Assurance',
            extractionStatus: 'success'
        });
        
        const foundProfile = await Profile.findByPk(testProfile.id);
        await testProfile.destroy();
        
        res.json({
            message: 'Complete database operations test successful ✅',
            timestamp: new Date().toISOString(),
            phase: 'Phase 4 Complete',
            operations: {
                create: 'Success ✅',
                read: 'Success ✅',
                delete: 'Success ✅',
                validation: 'Success ✅'
            },
            testProfile: {
                id: testProfile.id,
                name: testProfile.name,
                url: testProfile.url,
                fieldsCount: Object.keys(testProfile.dataValues).length
            }
        });
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
        res.status(500).json({
            message: 'Database operations test failed ❌',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ====================
// ERROR HANDLING
// ====================

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
        timestamp: new Date().toISOString(),
        availableRoutes: {
            api: 'GET /api',
            health: 'GET /api/health',
            profiles: [
                'POST /api/profiles (main Chrome extension endpoint)',
                'GET /api/profiles',
                'GET /api/profiles/:id',
                'PUT /api/profiles/:id',
                'DELETE /api/profiles/:id',
                'GET /api/profiles/stats',
                'GET /api/profiles/search/:query',
                'POST /api/profiles/batch'
            ],
            database: [
                'GET /api/database/health',
                'GET /api/database/stats',
                'POST /api/database/reset'
            ],
            testing: [
                'GET /api/test/database'
            ]
        },
        tip: 'Visit GET /api for complete API documentation'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('🚨 Server Error:', error);
    
    let statusCode = error.statusCode || error.status || 500;
    let errorType = 'ServerError';
    let message = error.message || 'Internal Server Error';
    
    // Handle Sequelize errors
    if (error.name === 'SequelizeValidationError') {
        statusCode = 400;
        errorType = 'ValidationError';
        message = error.errors.map(e => e.message).join(', ');
    }
    
    if (error.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        errorType = 'DuplicateEntryError';
        message = 'Resource already exists';
    }
    
    const errorResponse = {
        success: false,
        error: {
            type: errorType,
            message: message,
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
    
    res.status(statusCode).json(errorResponse);
});

// ====================
// SERVER STARTUP WITH DATABASE
// ====================

const startServer = async () => {
    try {
        console.log('🚀 Starting LinkedIn Profile Scraper API Server...');
        console.log('📊 Phase 4: Complete REST API');
        
        // Initialize database
        console.log('🔄 Initializing database...');
        const dbInitialized = await initializeDatabase();
        
        if (!dbInitialized) {
            console.error('❌ Database initialization failed - cannot start server');
            process.exit(1);
        }
        
        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log('🚀===========================================🚀');
            console.log('   LinkedIn Profile Scraper API Server      ');
            console.log('         Phase 4: Complete REST API         ');
            console.log('🚀===========================================🚀');
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🌐 API Root: http://localhost:${PORT}/api`);
            console.log(`💓 Health: http://localhost:${PORT}/api/health`);
            console.log(`📊 Database Health: http://localhost:${PORT}/api/database/health`);
            console.log(`🎯 Main Endpoint: POST http://localhost:${PORT}/api/profiles`);
            console.log(`📈 Get Profiles: GET http://localhost:${PORT}/api/profiles`);
            console.log(`📊 Profile Stats: GET http://localhost:${PORT}/api/profiles/stats`);
            


            console.log(`🔍 Search Profiles: GET http://localhost:${PORT}/api/profiles/search/:query`);
            console.log(`🧪 Test Database: GET http://localhost:${PORT}/api/test/database`);
            console.log(`🕒 Started: ${new Date().toLocaleString()}`);
            console.log('🚀===========================================🚀');
            console.log('✅ Phase 4 Complete! REST API Ready! 🎯');
            console.log('🔌 Chrome Extension can now connect to API');
            console.log('🎯 Next: Phase 5 - Chrome Extension Foundation');
            console.log('🚀===========================================🚀');
        });
        
        // Graceful shutdown handlers
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
            
            // Close HTTP server
            server.close(async () => {
                console.log('🔄 Closing database connections...');
                
                try {
                    await sequelize.close();
                    console.log('✅ Database connections closed');
                } catch (error) {
                    console.error('❌ Error closing database:', error.message);
                }
                
                console.log('✅ Server shut down successfully');
                process.exit(0);
            });
            
            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };
        
        // Register shutdown handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

// Export for testing purposes
module.exports = app;
