const mongoose = require('mongoose');

const BannerHeroSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },
    public_id: {
        type: String,
        required: false
    },
    subtitle: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    buttonText: {
        type: String,
        required: true
    },
    href: {
        type: String,
        required: true
    },
    visible: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});
// Middleware to check visibility based on date range
BannerHeroSchema.pre('save', function(next) {
    const currentDate = new Date();
    if (this.startDate > currentDate || this.endDate < currentDate) {
        this.visible = false;
    } else {
        this.visible = true;
    }
    next();
});

module.exports = mongoose.model('BannerHero', BannerHeroSchema);