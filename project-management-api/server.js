const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const SECRET_KEY = process.env.JWT_SECRET || 'my_secret_key';
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// In-memory database for projects
let projects = [
    { 
        id: 1, 
        name: 'E-commerce Platform', 
        city: 'São Paulo',
        description: 'Building a modern e-commerce platform',
        status: 'active',
        createdAt: new Date()
    },
    { 
        id: 2, 
        name: 'Mobile App Development', 
        city: 'Rio de Janeiro',
        description: 'Cross-platform mobile application',
        status: 'planning',
        createdAt: new Date()
    },
    { 
        id: 3, 
        name: 'Data Center Migration', 
        city: 'Belo Horizonte',
        description: 'Migrating infrastructure to cloud',
        status: 'in-progress',
        createdAt: new Date()
    }
];

// Users database
const users = [
    { id: 1, username: 'john_doe', password: 'password123', role: 'user', name: 'John Doe' },
    { id: 2, username: 'admin_user', password: 'admin123', role: 'admin', name: 'Admin User' },
    { id: 3, username: 'jane_smith', password: 'pass456', role: 'user', name: 'Jane Smith' }
];

// Helper function to generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username,
            role: user.role,
            name: user.name
        }, 
        SECRET_KEY, 
        { expiresIn: '1h' }
    );
}

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Role-based Authorization Middleware
function authorizeRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        if (req.user.role !== role) {
            return res.status(403).json({ 
                error: 'Access denied. Admin privileges required.' 
            });
        }
        
        next();
    };
}

// ============= ROUTES =============

// 1. Login Route
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const token = generateToken(user);
        res.json({ 
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name
            }
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// 2. Get all projects (authenticated users only)
app.get('/projects', authenticateToken, (req, res) => {
    res.json({ 
        projects,
        user: req.user
    });
});

// 3. Get single project by ID
app.get('/projects/:id', authenticateToken, (req, res) => {
    const projectId = parseInt(req.params.id);
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
});

// 4. Get weather for a project's city (external API integration)
app.get('/projects/:id/weather', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = projects.find(p => p.id === projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (!WEATHER_API_KEY) {
            // Simulated weather data if no API key provided
            return res.json({
                city: project.city,
                weather: {
                    temperature: Math.floor(Math.random() * 30) + 10,
                    condition: ['Sunny', 'Cloudy', 'Rainy', 'Clear'][Math.floor(Math.random() * 4)],
                    humidity: Math.floor(Math.random() * 60) + 40,
                    windSpeed: Math.floor(Math.random() * 20) + 5
                },
                note: 'Using simulated data (no API key provided)'
            });
        }
        
        // Make request to OpenWeather API
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather`,
            {
                params: {
                    q: project.city,
                    appid: WEATHER_API_KEY,
                    units: 'metric',
                    lang: 'pt_br'
                }
            }
        );
        
        const weatherData = response.data;
        
        res.json({
            project: project.name,
            city: project.city,
            weather: {
                temperature: weatherData.main.temp,
                feelsLike: weatherData.main.feels_like,
                condition: weatherData.weather[0].description,
                humidity: weatherData.main.humidity,
                pressure: weatherData.main.pressure,
                windSpeed: weatherData.wind.speed,
                icon: `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`
            },
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Weather API error:', error.message);
        
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'City not found in weather service' });
        } else if (error.response && error.response.status === 401) {
            res.status(500).json({ error: 'Invalid weather API key' });
        } else {
            res.status(500).json({ 
                error: 'Error fetching weather information',
                details: error.message 
            });
        }
    }
});

// 5. Create new project (admin only)
app.post('/projects', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { name, city, description, status } = req.body;
    
    if (!name || !city) {
        return res.status(400).json({ error: 'Name and city are required' });
    }
    
    const newProject = {
        id: projects.length + 1,
        name,
        city,
        description: description || '',
        status: status || 'planning',
        createdAt: new Date(),
        createdBy: req.user.id
    };
    
    projects.push(newProject);
    
    res.status(201).json({
        message: 'Project created successfully',
        project: newProject
    });
});

// 6. Update project (admin only)
app.put('/projects/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const projectId = parseInt(req.params.id);
    const { name, city, description, status } = req.body;
    
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    // Update project fields
    projects[projectIndex] = {
        ...projects[projectIndex],
        name: name || projects[projectIndex].name,
        city: city || projects[projectIndex].city,
        description: description !== undefined ? description : projects[projectIndex].description,
        status: status || projects[projectIndex].status,
        updatedAt: new Date(),
        updatedBy: req.user.id
    };
    
    res.json({
        message: 'Project updated successfully',
        project: projects[projectIndex],
        updatedBy: req.user
    });
});

// 7. Delete project (admin only)
app.delete('/projects/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const projectId = parseInt(req.params.id);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
        return res.status(404).json({ error: 'Project not found' });
    }
    
    const deletedProject = projects[projectIndex];
    projects = projects.filter(p => p.id !== projectId);
    
    res.json({
        message: 'Project deleted successfully',
        deletedProject: deletedProject
    });
});

// 8. Get user profile (authenticated users only)
app.get('/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
    });
});

// 9. Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Test the API at: http://localhost:${PORT}`);
});
