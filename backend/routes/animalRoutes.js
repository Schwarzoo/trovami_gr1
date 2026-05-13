const express = require('express');
const router = express.Router();
const { createAnimal } = require('../controllers/animalController');

router.post('/', createAnimal);

module.exports = router;
