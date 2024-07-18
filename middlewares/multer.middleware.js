'use strict'
const { FILES_SIZE_MB } = require("../config");
const { v4: uuidv4 } = require('uuid');
let multer = require('multer');
let path = require('path');

let storageConfig = (targetPath, originalName = false) => {
  let storage;
  let fileName; 

  storage =  multer.diskStorage({
    destination: path.join(__dirname, targetPath),
    filename: (req, file, cb) => {
      if(!originalName){
        fileName = `${uuidv4()}${path.extname(file.originalname)}`;
      }else{
        fileName = file.originalname;
      }
      cb(null, fileName);
    }
  });

  return storage;
}

let uploadImage = (targetPath) => {
  let storage = storageConfig(targetPath);
  return multer({
    storage,
    dest: path.join(__dirname, targetPath),
    limits: {
      fileSize: FILES_SIZE_MB * 1000000
    }
  }).single('image');
}

let uploadFile = (targetPath) => {
  let storage = storageConfig(targetPath, true);
  return multer({
    storage,
    dest: path.join(__dirname, targetPath),
    limits: {
      fileSize: FILES_SIZE_MB * 1000000
    }
  }).single('file');
}

let uploadFiles = (targetPath) => {
  let storage = storageConfig(targetPath, true);
  return multer({
    storage,
    dest: path.join(__dirname, targetPath),
    limits: {
      fileSize: FILES_SIZE_MB * 1000000
    },
  }).array('files', 10);
}

module.exports = {
  uploadImage,
  uploadFile,
  uploadFiles
}
