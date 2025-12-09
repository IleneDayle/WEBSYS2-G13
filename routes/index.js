// routes/index.js
const express = require('express');
const router = express.Router();

// Home Route
router.get('/', (req, res) => {
    res.render('index', { title: "Home Page", message: "Hello, MongoDB is connected!" });
})

// About Route
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Me',
        name: 'Ilene Dayle Aquino; Eloisa Segundo',
        description: 'We are web systems students building projects with Node.js, Express, and EJS.'
    });
})

// Contact Route
router.get('/contact', (req, res) => {
    res.render('contact', { title: "Contact Us" });
})

module.exports = router;