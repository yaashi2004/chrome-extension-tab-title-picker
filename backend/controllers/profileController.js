const { Profile } = require('../models');
const { Op } = require('sequelize');

// Profile Controller - Business Logic for Profile API
class ProfileController {
  
  // GET /api/profiles - Get all profiles with filtering and pagination
  static async getAllProfiles(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        status,
        location,
        search,
        minFollowers,
        maxFollowers
      } = req.query;

      // Build where conditions
      const whereConditions = {};
      
      if (status) {
        whereConditions.extractionStatus = status;
      }
      
      if (location) {
        whereConditions.location = {
          [Op.like]: `%${location}%`
        };
      }
      
      if (search) {
        whereConditions[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { bioLine: { [Op.like]: `%${search}%` } },
          { headline: { [Op.like]: `%${search}%` } }
        ];
      }
      
      if (minFollowers || maxFollowers) {
        whereConditions.followerCount = {};
        if (minFollowers) whereConditions.followerCount[Op.gte] = parseInt(minFollowers);
        if (maxFollowers) whereConditions.followerCount[Op.lte] = parseInt(maxFollowers);
      }

      // Calculate pagination
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Query profiles
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
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

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
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? parseInt(page) + 1 : null,
            prevPage: hasPrevPage ? parseInt(page) - 1 : null
          },
          filters: {
            status,
            location,
            search,
            minFollowers,
            maxFollowers,
            sortBy,
            sortOrder
          }
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
  }

  // GET /api/profiles/:id - Get single profile by ID
  static async getProfileById(req, res) {
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

      // Get additional info
      const fullInfo = profile.getFullInfo();
      const isComplete = profile.isDataComplete();

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          profile,
          metadata: {
            isComplete,
            fullInfo,
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
  }

  // POST /api/profiles - Create new profile (Main endpoint for Chrome extension)
  static async createProfile(req, res) {
    try {
      const profileData = req.body;

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

      // Check if profile with this URL already exists
      const existingProfile = await Profile.findByUrl(profileData.url);
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

      // Set default values
      const profileDataWithDefaults = {
        ...profileData,
        followerCount: profileData.followerCount || 0,
        connectionCount: profileData.connectionCount || 0,
        extractionStatus: profileData.extractionStatus || 'success',
        extractedAt: new Date(),
        lastUpdated: new Date()
      };

      // Create profile
      const newProfile = await Profile.create(profileDataWithDefaults);

      // Get full info for response
      const fullInfo = newProfile.getFullInfo();
      const isComplete = newProfile.isDataComplete();

      res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        data: {
          profile: newProfile,
          metadata: {
            isComplete,
            fullInfo,
            fieldsProvided: Object.keys(profileData).length,
            extractionStatus: newProfile.extractionStatus
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
  }

  // PUT /api/profiles/:id - Update existing profile
  static async updateProfile(req, res) {
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

      // Store original data for comparison
      const originalData = { ...profile.dataValues };

      // Update profile
      await profile.update({
        ...updateData,
        lastUpdated: new Date()
      });

      // Get updated info
      const fullInfo = profile.getFullInfo();
      const isComplete = profile.isDataComplete();

      // Determine what changed
      const changedFields = Object.keys(updateData).filter(key => 
        originalData[key] !== profile[key]
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile,
          metadata: {
            isComplete,
            fullInfo,
            changedFields,
            fieldsUpdated: changedFields.length,
            extractionStatus: profile.extractionStatus
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error updating profile:', error);
      
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
        message: 'Failed to update profile',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // DELETE /api/profiles/:id - Delete profile
  static async deleteProfile(req, res) {
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

      // Store profile info before deletion
      const deletedProfileInfo = {
        id: profile.id,
        name: profile.name,
        url: profile.url,
        createdAt: profile.createdAt
      };

      // Delete profile
      await profile.destroy();

      res.json({
        success: true,
        message: 'Profile deleted successfully',
        data: {
          deletedProfile: deletedProfileInfo
        },
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
  }

  // GET /api/profiles/stats - Get profile statistics
  static async getProfileStats(req, res) {
    try {
      const stats = await Profile.getStats();
      const recentProfiles = await Profile.getRecentProfiles(5);
      
      // Additional statistics
      const totalProfiles = await Profile.count();
      const profilesByStatus = await Promise.all([
        Profile.count({ where: { extractionStatus: 'success' } }),
        Profile.count({ where: { extractionStatus: 'failed' } }),
        Profile.count({ where: { extractionStatus: 'pending' } }),
        Profile.count({ where: { extractionStatus: 'partial' } })
      ]);

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
          detailed: {
            total: totalProfiles,
            byStatus: {
              success: profilesByStatus[0],
              failed: profilesByStatus[1],
              pending: profilesByStatus[2],
              partial: profilesByStatus[3]
            }
          },
          recentProfiles: recentProfiles.map(p => ({
            id: p.id,
            name: p.name,
            url: p.url,
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
  }

  // POST /api/profiles/batch - Create multiple profiles (for bulk operations)
  static async createBatchProfiles(req, res) {
    try {
      const { profiles } = req.body;

      if (!profiles || !Array.isArray(profiles)) {
        return res.status(400).json({
          success: false,
          message: 'Request body must contain a "profiles" array',
          timestamp: new Date().toISOString()
        });
      }

      if (profiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Profiles array cannot be empty',
          timestamp: new Date().toISOString()
        });
      }

      if (profiles.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 50 profiles allowed per batch request',
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
          // Check if required fields exist
          if (!profileData.name || !profileData.url) {
            results.errors.push({
              index: i,
              profileData,
              error: 'Missing required fields: name and url'
            });
            continue;
          }

          // Check if profile already exists
          const existingProfile = await Profile.findByUrl(profileData.url);
          if (existingProfile) {
            results.skipped.push({
              index: i,
              reason: 'Profile with this URL already exists',
              existingId: existingProfile.id,
              url: profileData.url
            });
            continue;
          }

          // Create profile
          const newProfile = await Profile.create({
            ...profileData,
            followerCount: profileData.followerCount || 0,
            connectionCount: profileData.connectionCount || 0,
            extractionStatus: profileData.extractionStatus || 'success',
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
            profileData,
            error: error.message
          });
        }
      }

      const statusCode = results.errors.length === profiles.length ? 400 : 
                        results.created.length === 0 ? 409 : 201;

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
  }
}

module.exports = ProfileController;