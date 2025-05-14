/**
 * Book Management REST API
 * 
 * A simple RESTful API for managing books built with Node.js
 * Features:
 * - CRUD operations for books
 * - Bulk import from CSV
 * - Basic logging and error handling
 */

const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

let books = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

function validateBook(book) {
  const errors = [];

  if (!book.title || typeof book.title !== 'string') {
    errors.push('Title is required and must be a string');
  }
  
  if (!book.author || typeof book.author !== 'string') {
    errors.push('Author is required and must be a string');
  }
  
  const currentYear = new Date().getFullYear();
  const publishedYear = parseInt(book.publishedYear, 10);
  
  if (isNaN(publishedYear) || publishedYear <= 0 || publishedYear > currentYear) {
    errors.push(`Published year must be a valid year between 1 and ${currentYear}`);
  }

  return errors;
}


function parseCSV(csvString) {
  const rows = csvString.split('\n');
  const result = [];
  
  const headerRow = rows[0].toLowerCase();
  const startIndex = headerRow.includes('title') && headerRow.includes('author') ? 1 : 0;
  
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i].trim();
    if (!row) continue;
    
    const columns = row.split(',').map(col => col.trim());
    
    if (columns.length >= 3) {
      result.push({
        title: columns[0],
        author: columns[1],
        publishedYear: parseInt(columns[2], 10)
      });
    }
  }
  
  return result;
}

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.stack}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
}


app.get('/books', (req, res) => {
  res.json(books);
});

app.get('/books/:id', (req, res) => {
  const book = books.find(b => b.id === req.params.id);
  
  if (!book) {
    return res.status(404).json({ message: 'Book not found' });
  }
  
  res.json(book);
});

app.post('/books', (req, res, next) => {
  try {
    const bookInput = {
      title: req.body.title,
      author: req.body.author,
      publishedYear: parseInt(req.body.publishedYear, 10)
    };
    
    const validationErrors = validateBook(bookInput);
    if (validationErrors.length > 0) {
      const error = new Error(`Validation failed: ${validationErrors.join(', ')}`);
      error.status = 400;
      throw error;
    }
    
    const newBook = {
      id: uuidv4(),
      ...bookInput
    };
    
    books.push(newBook);
    res.status(201).json(newBook);
  } catch (error) {
    next(error);
  }
});

app.put('/books/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const index = books.findIndex(b => b.id === id);
    
    if (index === -1) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const bookInput = {
      title: req.body.title,
      author: req.body.author,
      publishedYear: parseInt(req.body.publishedYear, 10)
    };
    
    const validationErrors = validateBook(bookInput);
    if (validationErrors.length > 0) {
      const error = new Error(`Validation failed: ${validationErrors.join(', ')}`);
      error.status = 400;
      throw error;
    }
    
    const updatedBook = {
      id,
      ...bookInput
    };
    
    books[index] = updatedBook;
    res.json(updatedBook);
  } catch (error) {
    next(error);
  }
});

app.delete('/books/:id', (req, res) => {
  const id = req.params.id;
  const index = books.findIndex(b => b.id === id);
  
  if (index === -1) {
    return res.status(404).json({ message: 'Book not found' });
  }
  
  books.splice(index, 1);
  res.status(204).send();
});

app.post('/books/import', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const csvContent = req.file.buffer.toString('utf8');
    const booksToImport = parseCSV(csvContent);
    
    const result = {
      added: 0,
      errors: []
    };
    
    booksToImport.forEach((bookInput, index) => {
      try {
        const validationErrors = validateBook(bookInput);
        if (validationErrors.length > 0) {
          throw new Error(validationErrors.join(', '));
        }
        
        const newBook = {
          id: uuidv4(),
          ...bookInput
        };
        
        books.push(newBook);
        result.added++;
      } catch (error) {
        result.errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });
    
    res.status(200).json({
      message: 'Import completed',
      booksAdded: result.added,
      errors: result.errors
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.url} not found`
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

books.push({
  id: uuidv4(),
  title: 'To Kill a Mockingbird',
  author: 'Harper Lee',
  publishedYear: 1960
});

books.push({
  id: uuidv4(),
  title: '1984',
  author: 'George Orwell',
  publishedYear: 1949
});

module.exports = app; 