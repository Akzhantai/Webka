const request = require('supertest');
const app = require('./server.js'); // Adjust the path as necessary
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Setup in-memory MongoDB instance
let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    // Ensure no existing connections are open
    await mongoose.disconnect();
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Test Express App', () => {
    // Test the landing page
    it('GET / should return the landing page', async () => {
        const response = await request(app).get('/');
        expect(response.statusCode).toBe(200);
        expect(response.text).toContain('Welcome'); // Assuming your landing page includes 'Welcome'
    });

    // Test the login route
    it('POST /login should handle login', async () => {
        const response = await request(app)
            .post('/login')
            .send({ username: 'akzhantaaai@gmail.com', password: 'Aa123456' }); // Adjust according to your login logic
        expect(response.statusCode).toBe(302);
        // Further checks depending on login logic
    });

    // Test the logout route
    it('POST /logout should log the user out', async () => {
        const response = await request(app).post('/logout');
        // Assuming logout redirects to the login page or sends a specific message
        expect(response.statusCode).toBe(302); // Assuming redirect
        expect(response.headers.location).toBe('/login'); // Check for redirection to login
    });

    // Test file upload for DOCX to PDF conversion
    it('POST /docxtopdf should convert DOCX to PDF', async () => {
        const response = await request(app)
            .post('/docxtopdf')
            .attach('files', 'C:\\Users\\Akzhan\\Downloads\\онлайн_2.docx') // Specify the path to a test DOCX file
            .expect(200);

        // Check for a successful conversion response
        expect(response.text).toContain('converted'); // Adjust based on actual success message
    });

    // Test image to PDF conversion route
    it('POST /imagetopdf should convert images to PDF', async () => {
        const response = await request(app)
            .post('/imagetopdf')
            .attach('images', 'C:\\Users\\Akzhan\\Pictures\\Screenshots\\photo_2024-01-16_14-59-18 — копия.jpg') // Specify the path to a test image file
            .expect(200);

        // Check for a successful conversion response
        const isConverted = response.body.some(filePath => filePath.includes('converted'));
        expect(isConverted).toBeTruthy();
    });

    it('GET /history should display conversion history', async () => {
        // Assuming the route requires authentication, you might need to simulate a login or set a session cookie
        const response = await request(app)
            .get('/history')
            .set('Cookie', ['06OyDY7bLHQfOkoIfhamPnHCzFIOL3Q4']); // Adjust according to your session cookie

        expect(response.statusCode).toBe(200);
        expect(response.text).toContain('History'); // Assuming your history page includes 'History'
    });
});

