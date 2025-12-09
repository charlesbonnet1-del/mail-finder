/**
 * Email Verifier Multi-API
 * Cascade automatiquement entre plusieurs APIs gratuites
 */

// Configuration des APIs (ordre de priorité)
const API_PROVIDERS = [
  {
    name: 'Verifalia',
    enabled: () => !!process.env.VERIFALIA_USERNAME && !!process.env.VERIFALIA_PASSWORD,
    verify: verifyWithVerifalia,
    dailyLimit: 25,
    errorCodes: [402, 429] // Codes qui indiquent "plus de crédits"
  },
  {
    name: 'Hunter',
    enabled: () => !!process.env.HUNTER_API_KEY,
    verify: verifyWithHunter,
    monthlyLimit: 50,
    errorCodes: [402, 429]
  },
  {
    name: 'AbstractAPI',
    enabled: () => !!process.env.ABSTRACT_API_KEY,
    verify: verifyWithAbstract,
    monthlyLimit: 100,
    errorCodes: [402, 429, 422]
  },
  {
    name: 'ZeroBounce',
    enabled: () => !!process.env.ZEROBOUNCE_API_KEY,
    verify: verifyWithZeroBounce,
    monthlyLimit: 100,
    errorCodes: [402, 429]
  },
  {
    name: 'EmailListVerify',
    enabled: () => !!process.env.EMAILLISTVERIFY_API_KEY,
    verify: verifyWithEmailListVerify,
    freeCredits: 100,
    errorCodes: [402, 429]
  }
];

// Tracking des erreurs par provider (pour éviter de réessayer un provider épuisé)
const providerStatus = {};

/**
 * Réinitialise le statut des providers (appelé périodiquement)
 */
function resetProviderStatus() {
  for (const provider of API_PROVIDERS) {
    providerStatus[provider.name] = { 
      exhausted: false, 
      lastError: null,
      errorCount: 0 
    };
  }
}
resetProviderStatus();

// Reset quotidien à minuit
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    console.log('🔄 Reset quotidien des statuts providers');
    resetProviderStatus();
  }
}, 60000);

/**
 * Vérifie un email en cascadant entre les APIs
 */
async function verifyEmail(email) {
  // Validation basique du format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      email,
      valid: false,
      status: 'invalid_format',
      confidence: 'high',
      details: "Format d'email invalide",
      provider: 'local'
    };
  }

  // Essayer chaque provider dans l'ordre
  const enabledProviders = API_PROVIDERS.filter(p => p.enabled());
  
  if (enabledProviders.length === 0) {
    return {
      email,
      valid: false,
      status: 'no_api_configured',
      confidence: 'low',
      details: 'Aucune API configurée. Ajoutez au moins une clé API.',
      provider: 'none'
    };
  }

  for (const provider of enabledProviders) {
    // Skip si le provider est marqué comme épuisé
    if (providerStatus[provider.name]?.exhausted) {
      console.log(`⏭️ Skip ${provider.name} (épuisé)`);
      continue;
    }

    try {
      console.log(`🔍 Trying ${provider.name} for ${email}`);
      const result = await provider.verify(email);
      
      // Succès !
      console.log(`✅ ${provider.name} responded: ${result.status}`);
      return {
        ...result,
        provider: provider.name
      };

    } catch (error) {
      console.error(`❌ ${provider.name} error:`, error.message);
      
      // Vérifier si c'est une erreur de quota
      if (provider.errorCodes.includes(error.statusCode) || 
          error.message.includes('limit') || 
          error.message.includes('quota') ||
          error.message.includes('credit')) {
        
        console.log(`💳 ${provider.name} semble épuisé, passage au suivant...`);
        providerStatus[provider.name] = { 
          exhausted: true, 
          lastError: error.message,
          errorCount: (providerStatus[provider.name]?.errorCount || 0) + 1
        };
        continue; // Essayer le provider suivant
      }
      
      // Autre erreur, on continue quand même avec le provider suivant
      providerStatus[provider.name] = {
        ...providerStatus[provider.name],
        lastError: error.message,
        errorCount: (providerStatus[provider.name]?.errorCount || 0) + 1
      };
    }
  }

  // Tous les providers ont échoué
  return {
    email,
    valid: false,
    status: 'all_apis_exhausted',
    confidence: 'low',
    details: 'Tous les crédits API sont épuisés. Réessayez demain ou ajoutez plus de clés API.',
    provider: 'none'
  };
}

/**
 * Retourne le statut de tous les providers
 */
function getProvidersStatus() {
  return API_PROVIDERS.map(p => ({
    name: p.name,
    configured: p.enabled(),
    status: providerStatus[p.name] || { exhausted: false, errorCount: 0 },
    limit: p.dailyLimit || p.monthlyLimit || p.freeCredits || 'unknown'
  }));
}

// ============================================
// IMPLEMENTATIONS DES PROVIDERS
// ============================================

/**
 * Verifalia - 25 crédits/jour gratuits
 */
async function verifyWithVerifalia(email) {
  const username = process.env.VERIFALIA_USERNAME;
  const password = process.env.VERIFALIA_PASSWORD;
  
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  // Créer un job de vérification
  const createResponse = await fetch('https://api.verifalia.com/v2.5/email-validations', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entries: [{ inputData: email }],
      quality: 'Standard'
    })
  });

  if (!createResponse.ok) {
    const error = new Error(`Verifalia error: ${createResponse.status}`);
    error.statusCode = createResponse.status;
    throw error;
  }

  const job = await createResponse.json();
  
  // Si le job est déjà complété
  if (job.overview.status === 'Completed') {
    return mapVerifaliaResult(email, job.entries[0]);
  }

  // Sinon, attendre le résultat (polling)
  const jobId = job.overview.id;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    await sleep(1000);
    
    const statusResponse = await fetch(`https://api.verifalia.com/v2.5/email-validations/${jobId}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    
    if (!statusResponse.ok) {
      const error = new Error(`Verifalia polling error: ${statusResponse.status}`);
      error.statusCode = statusResponse.status;
      throw error;
    }
    
    const statusData = await statusResponse.json();
    
    if (statusData.overview.status === 'Completed') {
      return mapVerifaliaResult(email, statusData.entries[0]);
    }
    
    attempts++;
  }
  
  throw new Error('Verifalia timeout');
}

function mapVerifaliaResult(email, entry) {
  const classification = entry.classification;
  
  let valid = false;
  let status = 'unknown';
  let confidence = 'low';
  let details = '';

  switch (classification) {
    case 'Deliverable':
      valid = true;
      status = 'valid';
      confidence = 'high';
      details = 'Email vérifié et livrable';
      break;
    case 'Undeliverable':
      valid = false;
      status = 'invalid';
      confidence = 'high';
      details = "L'adresse email n'existe pas";
      break;
    case 'Risky':
      valid = true;
      status = 'risky';
      confidence = 'medium';
      details = 'Email risqué (catch-all ou temporaire)';
      break;
    case 'Unknown':
      valid = false;
      status = 'unknown';
      confidence = 'low';
      details = 'Impossible de vérifier avec certitude';
      break;
    default:
      details = `Classification: ${classification}`;
  }

  return { email, valid, status, confidence, details };
}

/**
 * Hunter.io - 50 vérifications/mois gratuites
 */
async function verifyWithHunter(email) {
  const apiKey = process.env.HUNTER_API_KEY;
  
  const response = await fetch(
    `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`
  );

  if (!response.ok) {
    const error = new Error(`Hunter error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  
  if (data.errors) {
    const error = new Error(data.errors[0]?.details || 'Hunter API error');
    error.statusCode = 402;
    throw error;
  }

  const result = data.data;
  return mapHunterResult(email, result);
}

function mapHunterResult(email, result) {
  const status = result.status;
  
  let valid = false;
  let confidence = 'low';
  let details = '';

  switch (status) {
    case 'valid':
      valid = true;
      confidence = 'high';
      details = 'Email vérifié et existant';
      break;
    case 'invalid':
      valid = false;
      confidence = 'high';
      details = "L'adresse email n'existe pas";
      break;
    case 'accept_all':
      valid = true;
      confidence = 'medium';
      details = 'Serveur catch-all (accepte toutes les adresses)';
      break;
    case 'webmail':
      valid = result.score >= 50;
      confidence = 'low';
      details = 'Adresse webmail - vérification limitée';
      break;
    case 'disposable':
      valid = false;
      confidence = 'high';
      details = 'Email temporaire/jetable';
      break;
    default:
      valid = result.score >= 70;
      confidence = 'low';
      details = `Statut: ${status}`;
  }

  if (result.score) {
    details += ` (Score: ${result.score}/100)`;
  }

  return { email, valid, status, confidence, details, score: result.score };
}

/**
 * AbstractAPI - 100 crédits/mois gratuits
 */
async function verifyWithAbstract(email) {
  const apiKey = process.env.ABSTRACT_API_KEY;
  
  const response = await fetch(
    `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    const error = new Error(`AbstractAPI error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  
  if (data.error) {
    const error = new Error(data.error.message || 'AbstractAPI error');
    error.statusCode = 402;
    throw error;
  }

  return mapAbstractResult(email, data);
}

function mapAbstractResult(email, data) {
  const deliverability = data.deliverability;
  
  let valid = deliverability === 'DELIVERABLE';
  let status = deliverability.toLowerCase();
  let confidence = data.is_smtp_valid?.value ? 'high' : 'medium';
  
  let details = '';
  if (valid) {
    details = 'Email vérifié et livrable';
  } else if (deliverability === 'UNDELIVERABLE') {
    details = "L'adresse email n'existe pas";
  } else {
    details = 'Statut incertain';
  }

  if (data.is_disposable_email?.value) {
    valid = false;
    status = 'disposable';
    details = 'Email temporaire/jetable';
  }

  if (data.is_catchall_email?.value) {
    status = 'accept_all';
    confidence = 'medium';
    details = 'Serveur catch-all';
  }

  return { email, valid, status, confidence, details };
}

/**
 * ZeroBounce - 100 crédits gratuits (one-time)
 */
async function verifyWithZeroBounce(email) {
  const apiKey = process.env.ZEROBOUNCE_API_KEY;
  
  const response = await fetch(
    `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    const error = new Error(`ZeroBounce error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  
  if (data.error) {
    const error = new Error(data.error || 'ZeroBounce error');
    error.statusCode = 402;
    throw error;
  }

  return mapZeroBounceResult(email, data);
}

function mapZeroBounceResult(email, data) {
  const zbStatus = data.status;
  
  let valid = zbStatus === 'valid';
  let status = zbStatus;
  let confidence = 'medium';
  let details = data.sub_status || '';

  switch (zbStatus) {
    case 'valid':
      valid = true;
      confidence = 'high';
      details = 'Email vérifié et valide';
      break;
    case 'invalid':
      valid = false;
      confidence = 'high';
      details = data.sub_status || "L'adresse n'existe pas";
      break;
    case 'catch-all':
      valid = true;
      status = 'accept_all';
      confidence = 'medium';
      details = 'Serveur catch-all';
      break;
    case 'spamtrap':
      valid = false;
      confidence = 'high';
      details = 'Adresse piège à spam';
      break;
    case 'abuse':
      valid = false;
      confidence = 'high';
      details = 'Adresse connue pour signaler des abus';
      break;
    case 'do_not_mail':
      valid = false;
      confidence = 'high';
      details = 'Ne pas envoyer de mail';
      break;
    default:
      details = `Statut: ${zbStatus}`;
  }

  return { email, valid, status, confidence, details };
}

/**
 * EmailListVerify - 100 crédits gratuits (one-time)
 */
async function verifyWithEmailListVerify(email) {
  const apiKey = process.env.EMAILLISTVERIFY_API_KEY;
  
  const response = await fetch(
    `https://apps.emaillistverify.com/api/verifyEmail?secret=${apiKey}&email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    const error = new Error(`EmailListVerify error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const text = await response.text();
  
  // EmailListVerify retourne du texte simple
  return mapEmailListVerifyResult(email, text.trim());
}

function mapEmailListVerifyResult(email, result) {
  let valid = false;
  let status = result.toLowerCase();
  let confidence = 'medium';
  let details = '';

  switch (result.toLowerCase()) {
    case 'ok':
      valid = true;
      status = 'valid';
      confidence = 'high';
      details = 'Email vérifié et valide';
      break;
    case 'fail':
    case 'invalid':
      valid = false;
      status = 'invalid';
      confidence = 'high';
      details = "L'adresse n'existe pas";
      break;
    case 'unknown':
      valid = false;
      status = 'unknown';
      confidence = 'low';
      details = 'Impossible de vérifier';
      break;
    case 'catch_all':
      valid = true;
      status = 'accept_all';
      confidence = 'medium';
      details = 'Serveur catch-all';
      break;
    case 'disposable':
      valid = false;
      status = 'disposable';
      confidence = 'high';
      details = 'Email temporaire';
      break;
    default:
      details = `Résultat: ${result}`;
  }

  return { email, valid, status, confidence, details };
}

// Utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { 
  verifyEmail, 
  getProvidersStatus,
  resetProviderStatus 
};
