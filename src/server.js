const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyEmail } = require('./emailVerifier');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API de vérification d'email
app.post('/api/verify-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      email: '',
      valid: false,
      status: 'missing_email',
      confidence: 'low',
      details: 'Email parameter required'
    });
  }

  try {
    const result = await verifyEmail(email);
    res.json(result);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      email,
      valid: false,
      status: 'error',
      confidence: 'low',
      details: 'Erreur lors de la vérification'
    });
  }
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Email Finder running on port ${PORT}`);
});
