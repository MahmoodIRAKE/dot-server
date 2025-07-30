const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables at the very top
dotenv.config();

// Import Firebase Admin (already configured in config/firebase.js)
require('./config/firebase'); // ensures Firebase is initialized
const SCRIPT = require('./scripts/seedAdmin');

const app = express();

// Static files
app.use('/views', express.static(path.join(__dirname, 'views')));

// Middleware
app.use(express.json());
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    createParentPath: true,
    useTempFiles: true,
    tempFileDir: './tempUploads/'
}));
app.use(cors({ credentials: true, origin: true, maxAge: 86400 }));

// MongoDB Connection
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('🟢 Connected to MongoDB'))
    .catch((err) => {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    });

// Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const startServer = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('🟢 Connected to MongoDB');

        // Optionally run seed script ONCE (comment out later in production)
        // await SCRIPT.seedAdmin();
        // await SCRIPT.deleteDB()

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Server startup failed:', err.message);
        process.exit(1);
    }
};

module.exports = app; // Export for testing
startServer();
