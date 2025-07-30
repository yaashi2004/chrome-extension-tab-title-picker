module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define('Profile', {
    // Primary Key
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    
    // Required Fields (from task requirements)
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Name cannot be empty'
        },
        len: {
          args: [1, 255],
          msg: 'Name must be between 1 and 255 characters'
        }
      }
    },
    
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: {
        msg: 'This LinkedIn profile URL already exists'
      },
      validate: {
        notEmpty: {
          msg: 'URL cannot be empty'
        },
        isLinkedInUrl(value) {
          if (!value || !value.includes('linkedin.com/in/')) {
            throw new Error('Must be a LinkedIn profile URL (linkedin.com/in/username)');
          }
        }
      }
    },
    
    // Optional Fields
    about: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 5000],
          msg: 'About section cannot exceed 5000 characters'
        }
      }
    },
    
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Bio cannot exceed 1000 characters'
        }
      }
    },
    
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: 'Location cannot exceed 255 characters'
        }
      }
    },
    
    followerCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Follower count cannot be negative'
        },
        isInt: {
          msg: 'Follower count must be an integer'
        }
      }
    },
    
    connectionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Connection count cannot be negative'
        },
        isInt: {
          msg: 'Connection count must be an integer'
        }
      }
    },
    
    bioLine: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Bio line cannot exceed 500 characters'
        }
      }
    },
    
    // Additional useful fields for LinkedIn profiles
    headline: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Headline cannot exceed 500 characters'
        }
      }
    },
    
    industry: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: 'Industry cannot exceed 255 characters'
        }
      }
    },
    
    profilePicture: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Profile picture must be a valid URL'
        }
      }
    },
    
    // JSON fields for complex data
    experience: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Experience must be a valid JSON array');
          }
        }
      }
    },
    
    education: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Education must be a valid JSON array');
          }
        }
      }
    },
    
    skills: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidJSON(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Skills must be a valid JSON array');
          }
        }
      }
    },
    
    // Metadata fields
    extractedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    
    extractionStatus: {
      type: DataTypes.ENUM('pending', 'success', 'failed', 'partial'),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: {
          args: [['pending', 'success', 'failed', 'partial']],
          msg: 'Extraction status must be: pending, success, failed, or partial'
        }
      }
    },
    
    extractionErrors: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    // Model options
    tableName: 'profiles',
    timestamps: true, // Adds createdAt and updatedAt
    
    // Database indexes for performance
    indexes: [
      {
        unique: true,
        fields: ['url']
      },
      {
        fields: ['name']
      },
      {
        fields: ['location']
      },
      {
        fields: ['extractedAt']
      },  
      {
        fields: ['extractionStatus']
      }
    ],
    
    // Model hooks (middleware)
    hooks: {
      beforeUpdate: (profile, options) => {
        profile.lastUpdated = new Date();
      },
      
      beforeCreate: (profile, options) => {
        profile.extractedAt = new Date();
        profile.lastUpdated = new Date();
        
        // Set default extraction status if not provided
        if (!profile.extractionStatus) {
          profile.extractionStatus = 'pending';
        }
      },
      
      // Validate LinkedIn URL format
      beforeValidate: (profile, options) => {
        if (profile.url && !profile.url.startsWith('http')) {
          if (profile.url.includes('linkedin.com/in/')) {
            profile.url = 'https://' + profile.url;
          }
        }
      }
    }
  });
  
  // Instance methods (methods available on individual profile instances)
  Profile.prototype.getFullInfo = function() {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      headline: this.headline || this.bioLine,
      location: this.location,
      followerCount: this.followerCount,
      connectionCount: this.connectionCount,
      extractedAt: this.extractedAt,
      lastUpdated: this.lastUpdated,
      status: this.extractionStatus
    };
  };
  
  Profile.prototype.isDataComplete = function() {
    return !!(this.name && this.url && (this.bioLine || this.headline));
  };
  
  Profile.prototype.updateExtractionStatus = function(status, errors = null) {
    return this.update({
      extractionStatus: status,
      extractionErrors: errors,
      lastUpdated: new Date()
    });
  };
  
  // Class methods (methods available on the Profile model itself)
  Profile.findByUrl = function(url) {
    return this.findOne({ where: { url } });
  };
  
  Profile.findByName = function(name) {
    const { Op } = require('sequelize');
    return this.findAll({ 
      where: { 
        name: {
          [Op.like]: `%${name}%`
        }
      } 
    });
  };
  
  Profile.findByLocation = function(location) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        location: {
          [Op.like]: `%${location}%`
        }
      }
    });
  };
  
  Profile.getStats = async function() {
    try {
      const total = await this.count();
      const successful = await this.count({ where: { extractionStatus: 'success' } });
      const failed = await this.count({ where: { extractionStatus: 'failed' } });
      const pending = await this.count({ where: { extractionStatus: 'pending' } });
      const partial = await this.count({ where: { extractionStatus: 'partial' } });
      
      return {
        total,
        successful,
        failed,
        pending,
        partial,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%',
        completionRate: total > 0 ? (((successful + partial) / total) * 100).toFixed(2) + '%' : '0%'
      };
    } catch (error) {
      console.error('Error getting profile stats:', error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        partial: 0,
        successRate: '0%',
        completionRate: '0%',
        error: error.message
      };
    }
  };
  
  Profile.getRecentProfiles = function(limit = 10) {
    return this.findAll({
      order: [['createdAt', 'DESC']],
      limit: limit
    });
  };
  
  Profile.getProfilesByStatus = function(status) {
    return this.findAll({
      where: { extractionStatus: status },
      order: [['createdAt', 'DESC']]
    });
  };
  
  return Profile;
};