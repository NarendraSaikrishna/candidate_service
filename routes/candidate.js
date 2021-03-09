const express = require('express');
const router =  express.Router();
const upload = require('../middlewares/upload');
const candidateUploadController = require('../controllers/candidateUpload.controller')


router.post('', upload.single('data'), candidateUploadController.processFile, candidateUploadController.validateData, candidateUploadController.uploadData);

module.exports = router;
