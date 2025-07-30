const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profileController');

// Import validation middleware (we'll create this)
const { validateProfile, validateBatchProfiles } = require('../middleware/validation');

// ====================
// PROFILE CRUD ROUTES
// ====================

// GET /api/profiles - Get all profiles with filtering and pagination
router.get('/', ProfileController.getAllProfiles);

// GET /api/profiles/stats - Get profile statistics (must be before /:id route)
router.get('/stats', ProfileController.getProfileStats);

// GET /api/profiles/:id - Get single profile by ID
router.get('/:id', ProfileController.getProfileById);

// POST /api/profiles - Create new profile (main endpoint for Chrome extension)
router.post('/', validateProfile, ProfileController.createProfile);

// POST /api/profiles/batch - Create multiple profiles
router.post('/batch', validateBatchProfiles, ProfileController.createBatchProfiles);

// PUT /api/profiles/:id - Update existing profile
router.put('/:id', validateProfile, ProfileController.updateProfile);

// DELETE /api/profiles/:id - Delete profile
router.delete('/:id', ProfileController.deleteProfile);

// ====================
// UTILITY ROUTES
// ====================

// GET /api/profiles/search/:query - Search profiles by name or bio
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 10 } = req.query;

        const { Profile } = require('../models');
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

// GET /api/profiles/by-url/:encodedUrl - Find profile by LinkedIn URL
router.get('/by-url/:encodedUrl', async (req, res) => {
    try {
        const { encodedUrl } = req.params;
        const url = decodeURIComponent(encodedUrl);

        const { Profile } = require('../models');
        const profile = await Profile.findByUrl(url);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found with this URL',
                url,
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: 'Profile found',
            data: { profile },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to find profile by URL',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;