// conversion.js

const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
    originalFilename: String,
    convertedFilename: String,
    timestamp: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Add this line
});

const Conversion = mongoose.model('Conversion', conversionSchema);

module.exports = Conversion;
