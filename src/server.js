const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyEmail, getProvidersStatus, resetProviderStatus } = require('./emailVerifier');

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
      details: 'Erreur lors de la vérification',
      provider: 'none'
    });
  }
});

// API pour voir le statut des providers
app.get('/api/providers-status', (req, res) => {
  res.json(getProvidersStatus());
});

// API pour reset les providers (admin)
app.post('/api/reset-providers', (req, res) => {
  resetProviderStatus();
  res.json({ success: true, message: 'Providers reset' });
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', (req, res) => {
  const providers = getProvidersStatus();
  const configuredCount = providers.filter(p => p.configured).length;
  res.json({ 
    status: 'ok', 
    configuredProviders: configuredCount,
    providers: providers.map(p => ({ name: p.name, configured: p.configured }))
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Email Finder Multi-API running on port ${PORT}`);
  console.log('');
  console.log('📊 Configured API providers:');
  
  const providers = getProvidersStatus();
  providers.forEach(p => {
    const status = p.configured ? '✅' : '❌';
    console.log(`   ${status} ${p.name} (limit: ${p.limit}/period)`);
  });
  
  const configuredCount = providers.filter(p => p.configured).length;
  if (configuredCount === 0) {
    console.log('');
    console.log('⚠️  Aucune API configurée ! Ajoutez des variables d\'environnement.');
  }
  console.log('');
});
