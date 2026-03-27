const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');

// Import your app (you may need to export app from server.js)
// For testing, let's create a test app instance
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Add your routes here (or import from server.js)
  // For this example, we'll create simplified test routes
  
  const SECRET_KEY = 'test_secret_key';
  const users = [
    { id: 1, username: 'test_user', password: 'test123', role: 'user', name: 'Test User' },
    { id: 2, username: 'test_admin', password: 'admin123', role: 'admin', name: 'Test Admin' }
  ];
  
  let projects = [
    { id: 1, name: 'Test Project', city: 'São Paulo', status: 'active' }
  ];
  
  const generateToken = (user) => {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
  };
  
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access token required' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token' });
      req.user = user;
      next();
    });
  };
  
  const authorizeRole = (role) => {
    return (req, res, next) => {
      if (req.user.role !== role) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    };
  };
  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
  
  app.get('/projects', authenticateToken, (req, res) => {
    res.json({ projects });
  });
  
  app.post('/projects', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { name, city } = req.body;
    const newProject = { id: projects.length + 1, name, city, status: 'planning' };
    projects.push(newProject);
    res.status(201).json({ project: newProject });
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
  });
  
  return app;
};

describe('Project Management API Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  describe('Health Check', () => {
    it('should return OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('OK');
    });
  });
  
  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'test_user', password: 'test123' })
        .expect(200);
      
      expect(response.body.token).toBeDefined();
      expect(response.body.user.role).toBe('user');
    });
    
    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'test_user', password: 'wrongpassword' })
        .expect(401);
      
      expect(response.body.error).toBe('Invalid credentials');
    });
    
    it('should require username and password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'test_user' })
        .expect(400);
      
      expect(response.body.error).toBe('Username and password required');
    });
  });
  
  describe('Protected Routes', () => {
    let userToken;
    let adminToken;
    
    beforeAll(async () => {
      const userLogin = await request(app)
        .post('/login')
        .send({ username: 'test_user', password: 'test123' });
      userToken = userLogin.body.token;
      
      const adminLogin = await request(app)
        .post('/login')
        .send({ username: 'test_admin', password: 'admin123' });
      adminToken = adminLogin.body.token;
    });
    
    it('should access projects with valid token', async () => {
      const response = await request(app)
        .get('/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(response.body.projects).toBeDefined();
      expect(Array.isArray(response.body.projects)).toBe(true);
    });
    
    it('should reject access without token', async () => {
      await request(app)
        .get('/projects')
        .expect(401);
    });
    
    it('should reject access with invalid token', async () => {
      await request(app)
        .get('/projects')
        .set('Authorization', 'Bearer invalid_token')
        .expect(403);
    });
    
    it('should allow admin to create project', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Project', city: 'Rio de Janeiro' })
        .expect(201);
      
      expect(response.body.project.name).toBe('New Project');
      expect(response.body.project.city).toBe('Rio de Janeiro');
    });
    
    it('should reject regular user creating project', async () => {
      await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked Project', city: 'Hacker City' })
        .expect(403);
    });
    
    it('should validate required fields when creating project', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Incomplete Project' })
        .expect(400);
      
      expect(response.body.error).toBe('Name and city are required');
    });
  });
});
