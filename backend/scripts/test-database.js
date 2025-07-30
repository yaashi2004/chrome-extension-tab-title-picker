const db = require('../models');

async function testDatabase() {
    try {
        console.log('🧪 Starting database tests...');
        
        // Test 1: Connection
        console.log('\n1️⃣ Testing database connection...');
        await db.sequelize.authenticate();
        console.log('✅ Database connection successful');
        
        // Test 2: Model creation
        console.log('\n2️⃣ Testing profile creation...');
        const testProfile1 = await db.Profile.create({
            name: 'John Doe',
            url: 'https://linkedin.com/in/johndoe',
            bio: 'Software Engineer at Tech Company',
            location: 'San Francisco, CA',
            followerCount: 1500,
            connectionCount: 800,
            bioLine: 'Passionate about technology and innovation',
            headline: 'Senior Software Engineer',
            industry: 'Technology',
            extractionStatus: 'success'
        });
        console.log('✅ Profile created:', testProfile1.name);
        
        // Test 3: Model validation
        console.log('\n3️⃣ Testing validation...');
        try {
            await db.Profile.create({
                name: '', // Empty name should fail
                url: 'invalid-url' // Invalid URL should fail
            });
        } catch (error) {
            console.log('✅ Validation working:', error.errors[0].message);
        }
        
        // Test 4: Find operations
        console.log('\n4️⃣ Testing find operations...');
        const foundProfile = await db.Profile.findByUrl(testProfile1.url);
        console.log('✅ Found profile by URL:', foundProfile.name);
        
        const allProfiles = await db.Profile.findAll();
        console.log('✅ Total profiles in database:', allProfiles.length);
        
        // Test 5: Update operations
        console.log('\n5️⃣ Testing update operations...');
        await testProfile1.update({
            followerCount: 1600,
            bioLine: 'Updated bio line'
        });
        console.log('✅ Profile updated successfully');
        
        // Test 6: Statistics
        console.log('\n6️⃣ Testing statistics...');
        const stats = await db.Profile.getStats();
        console.log('✅ Database stats:', stats);
        
        // Test 7: Custom methods
        console.log('\n7️⃣ Testing custom methods...');
        const fullInfo = testProfile1.getFullInfo();
        console.log('✅ Full profile info:', fullInfo.name);
        
        const isComplete = testProfile1.isDataComplete();
        console.log('✅ Profile complete:', isComplete);
        
        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await testProfile1.destroy();
        console.log('✅ Test profile deleted');
        
        console.log('\n🎉 All database tests passed! Phase 3 is working correctly.');
        
    } catch (error) {
        console.error('❌ Database tests failed:', error.message);
        console.error(error);
    } finally {
        await db.sequelize.close();
        console.log('🔒 Database connection closed');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testDatabase();
}

module.exports = testDatabase;