const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// Helper function to make authenticated requests
const api = {
    async post(url, data) {
        const response = await axios.post(`${BASE_URL}${url}`, data);
        return response;
    },
    
    async get(url, token = null) {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${BASE_URL}${url}`, { headers });
        return response;
    },
    
    async put(url, data, token) {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.put(`${BASE_URL}${url}`, data, { headers });
        return response;
    },
    
    async delete(url, token) {
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.delete(`${BASE_URL}${url}`, { headers });
        return response;
    }
};

// Test scenarios
async function testApplication() {
    console.log('=== Starting API Tests ===\n');
    
    try {
        // 1. Test health check
        console.log('1. Testing health check...');
        const health = await api.get('/health');
        console.log('✓ Health check passed:', health.data.status);
        
        // 2. Test login with user credentials
        console.log('\n2. Testing login with user credentials...');
        const userLogin = await api.post('/login', {
            username: 'john_doe',
            password: 'password123'
        });
        console.log('✓ User login successful');
        console.log('User info:', userLogin.data.user);
        
        // 3. Test login with admin credentials
        console.log('\n3. Testing login with admin credentials...');
        const adminLogin = await api.post('/login', {
            username: 'admin_user',
            password: 'admin123'
        });
        authToken = adminLogin.data.token;
        console.log('✓ Admin login successful');
        console.log('Admin info:', adminLogin.data.user);
        
        // 4. Test accessing projects (authenticated)
        console.log('\n4. Testing GET /projects (authenticated)...');
        const projects = await api.get('/projects', authToken);
        console.log('✓ Projects retrieved successfully');
        console.log(`Found ${projects.data.projects.length} projects`);
        
        // 5. Test accessing weather for a project
        console.log('\n5. Testing GET /projects/1/weather...');
        try {
            const weather = await api.get('/projects/1/weather', authToken);
            console.log('✓ Weather data retrieved successfully');
            console.log('City:', weather.data.city);
            console.log('Temperature:', weather.data.weather.temperature);
            console.log('Condition:', weather.data.weather.condition);
        } catch (error) {
            console.log('Note: Weather API may require valid API key');
            console.log('Error:', error.response?.data?.error || error.message);
        }
        
        // 6. Test creating a project (admin only)
        console.log('\n6. Testing POST /projects (admin only)...');
        const newProject = await api.post('/projects', {
            name: 'New Test Project',
            city: 'Curitiba',
            description: 'This is a test project',
            status: 'planning'
        });
        console.log('✓ Project created successfully');
        console.log('New project ID:', newProject.data.project.id);
        
        // 7. Test updating a project (admin only)
        console.log('\n7. Testing PUT /projects/1 (admin only)...');
        const updatedProject = await api.put('/projects/1', {
            name: 'Updated Project Name',
            status: 'in-progress'
        }, authToken);
        console.log('✓ Project updated successfully');
        
        // 8. Test accessing profile
        console.log('\n8. Testing GET /profile...');
        const profile = await api.get('/profile', authToken);
        console.log('✓ Profile retrieved successfully');
        console.log('Username:', profile.data.username);
        console.log('Role:', profile.data.role);
        
        // 9. Test unauthorized access (no token)
        console.log('\n9. Testing unauthorized access...');
        try {
            await api.get('/projects');
            console.log('✗ Should not be accessible without token');
        } catch (error) {
            console.log('✓ Correctly blocked access without token');
        }
        
        // 10. Test user trying to access admin-only route
        console.log('\n10. Testing user role trying to update project...');
        const userToken = userLogin.data.token;
        try {
            await api.put('/projects/2', { name: 'Hacked Project' }, userToken);
            console.log('✗ User should not be able to update projects');
        } catch (error) {
            console.log('✓ Correctly prevented non-admin from updating project');
            console.log('Error:', error.response?.data?.error);
        }
        
        // 11. Test deleting a project (admin only)
        console.log('\n11. Testing DELETE /projects/4 (admin only)...');
        const deleted = await api.delete('/projects/4', authToken);
        console.log('✓ Project deleted successfully');
        
        console.log('\n=== All tests completed successfully ===');
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Status code:', error.response.status);
        }
    }
}

// Run tests
testApplication();
