const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
    originalFilename: String,
    convertedFilename: String,
    timestamp: { type: Date, default: Date.now }
});

const Conversion = mongoose.model('Conversion', conversionSchema);

module.exports = Conversion;
