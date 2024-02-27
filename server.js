// Import necessary modules
const express = require('express');
const multer = require('multer');
const path = require('path');
const docxToPdf = require('docx-pdf');
const imageToPdf = require('image-to-pdf');
const fs = require('fs');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const config = require('config');
const appController = require('./controllers/appController');
const isAuth = require('./middleware/is-auth');
const connectDB = require('./config/db');
const Conversion = require('./models/conversion');
const PDFDocument = require('pdfkit');

// Create express app
const app = express();
connectDB();

// Configure session store
const mongoURI = config.get('mongoURI');
const store = new MongoDBStore({
    uri: mongoURI,
    collection: 'mySessions',
});

// Set up multer for file uploads
const storageConfig = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploaded');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({
    storage: storageConfig,
    limits: {
        fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
    },
    fileFilter: (req, file, cb) => {
        const extname = path.extname(file.originalname).toLowerCase();
        if (req.route.path === '/imagetopdf' && !['.jpg', '.jpeg', '.png'].includes(extname)) {
            const err = new Error('Only .jpg, .jpeg, and .png files are allowed');
            err.code = 'FILE_TYPE_ERROR';
            return cb(err);
        }
        if (req.route.path === '/docxtopdf' && extname !== '.docx') {
            const err = new Error('Only .docx files are allowed');
            err.code = 'FILE_TYPE_ERROR';
            return cb(err);
        }
        cb(null, true);
    },
});

// Middleware for password checking
const passwordChecker = (req, res, next) => {
    const { password } = req.body;
    if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        return res.status(400).send('Password must be at least 8 characters long and contain both uppercase and lowercase letters.');
    }
    next();
};

// Middleware for email checking
const emailChecker = (req, res, next) => {
    const { email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).send('Invalid email address.');
    }
    next();
};

// Configure session
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(
    session({
        secret: 'secret',
        resave: false,
        saveUninitialized: false,
        store: store,
    })
);

// Serve static files
app.use(express.static('uploaded'));

// Routes

// Landing Page
app.get('/', appController.landing_page);

// Login Page
app.get('/login', appController.login_get);
app.post('/login', appController.login_post);

// Register Page
app.get('/register', appController.register_get);
app.post('/register', emailChecker, passwordChecker, appController.register_post);

// Dashboard Page
app.get('/dashboard', isAuth, appController.dashboard_get);

// Logout
app.post('/logout', appController.logout_post);

// File Upload and Conversion Routes

// Route for converting DOCX to PDF
app.post('/docxtopdf', upload.array('files', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const convertedFiles = [];

    const processFile = async (index) => {
        if (index >= req.files.length) {
            res.status(200).send(convertedFiles);
            return;
        }

        const file = req.files[index];
        const outputFilepath = path.join("converted", Date.now() + "_" + file.originalname.replace(/\.docx$/, ".pdf"));

        await docxToPdf(file.path, outputFilepath, async (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('Conversion failed.');
                return;
            }

            console.log(`File ${file.originalname} converted to PDF`);

            // Save conversion details to the database
            const conversion = new Conversion({
                originalFilename: file.originalname,
                convertedFilename: outputFilepath
            });
            await conversion.save();

            convertedFiles.push(outputFilepath);
            await processFile(index + 1);
        });
    };

    await processFile(0);
});

// Route for converting images to PDF
// Route for converting images to PDF
app.post('/imagetopdf', upload.array('images', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const outputFilepath = path.join("converted", Date.now() + "_merged.pdf");

    try {
        // Create a new PDF document
        const pdfDoc = new PDFDocument();

        for (const file of req.files) {
            const imageBuffer = fs.readFileSync(file.path);
            // Add the image to the PDF document
            pdfDoc.addPage().image(imageBuffer, 0, 0, { width: 612 });
        }

        // Save the PDF document
        pdfDoc.pipe(fs.createWriteStream(outputFilepath));
        pdfDoc.end();

        console.log('Images merged into PDF:', outputFilepath);

        // Save conversion details to the database
        const conversion = new Conversion({
            originalFilename: req.files.map(file => file.originalname).join(', '), // Store original filenames
            convertedFilename: outputFilepath
        });
        await conversion.save();

        const downloadLinks = [outputFilepath]; // Change this to array if you want to send multiple download links
        res.status(200).json(downloadLinks); // Send download links as JSON array
    } catch (err) {
        console.error(err);
        return res.status(500).send('Conversion failed.');
    }
});

// Conversion History Page Route
app.get('/history', async (req, res) => {
    try {
        const conversions = await Conversion.find().sort({ timestamp: -1 });
        res.render('history', { conversions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
app.get('/docxtopdf', async (req, res) => {
    try {
        const conversions = await Conversion.find().sort({ timestamp: -1 });
        res.render('docxtopdf', { conversions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});
app.get('/imagetopdf', async (req, res) => {
    try {
        const conversions = await Conversion.find().sort({ timestamp: -1 });
        res.render('imagetopdf', { conversions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Serve downloaded files
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, filename);
    res.download(filePath);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App Running on http://localhost:${PORT}`));