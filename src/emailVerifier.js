const dns = require('dns').promises;
const net = require('net');

/**
 * Vérifie un email via MX records + SMTP
 */
async function verifyEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      email,
      valid: false,
      status: 'invalid_format',
      confidence: 'high',
      details: "Format d'email invalide"
    };
  }

  const [localPart, domain] = email.split('@');

  // Étape 1: Vérifier les MX records
  let mxRecords;
  try {
    mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        email,
        valid: false,
        status: 'no_mx',
        confidence: 'high',
        details: 'Aucun serveur mail configuré pour ce domaine'
      };
    }
  } catch (error) {
    return {
      email,
      valid: false,
      status: 'domain_error',
      confidence: 'high',
      details: 'Domaine invalide ou inexistant'
    };
  }

  // Trier par priorité (plus petit = priorité haute)
  mxRecords.sort((a, b) => a.priority - b.priority);
  const mxHost = mxRecords[0].exchange;

  // Étape 2: Vérification SMTP
  try {
    const smtpResult = await checkSMTP(mxHost, email, domain);
    return smtpResult;
  } catch (error) {
    console.error('SMTP Error:', error.message);
    return {
      email,
      valid: false,
      status: 'smtp_error',
      confidence: 'low',
      details: `Impossible de vérifier via SMTP: ${error.message}`
    };
  }
}

/**
 * Connexion SMTP pour vérifier si l'adresse existe
 */
function checkSMTP(mxHost, email, domain) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let step = 0;
    let response = '';
    let catchAll = false;
    
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Timeout de connexion'));
    }, 10000); // 10 secondes max

    socket.connect(25, mxHost, () => {
      // Connexion établie, on attend le banner
    });

    socket.on('data', (data) => {
      response = data.toString();
      const code = parseInt(response.substring(0, 3));

      switch (step) {
        case 0: // Banner reçu
          if (code === 220) {
            socket.write(`EHLO emailfinder.local\r\n`);
            step = 1;
          } else {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('Serveur non disponible'));
          }
          break;

        case 1: // Réponse EHLO
          if (code === 250) {
            socket.write(`MAIL FROM:<verify@emailfinder.local>\r\n`);
            step = 2;
          } else {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('EHLO refusé'));
          }
          break;

        case 2: // Réponse MAIL FROM
          if (code === 250) {
            // D'abord tester avec une adresse random pour détecter catch-all
            const randomEmail = `test${Date.now()}${Math.random().toString(36).substring(7)}@${domain}`;
            socket.write(`RCPT TO:<${randomEmail}>\r\n`);
            step = 3;
          } else {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('MAIL FROM refusé'));
          }
          break;

        case 3: // Réponse RCPT TO (test catch-all)
          if (code === 250) {
            // Le serveur accepte n'importe quelle adresse = catch-all
            catchAll = true;
          }
          // Maintenant tester la vraie adresse
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 4;
          break;

        case 4: // Réponse RCPT TO (vraie adresse)
          clearTimeout(timeout);
          socket.write(`QUIT\r\n`);
          socket.destroy();

          if (code === 250) {
            if (catchAll) {
              resolve({
                email,
                valid: true,
                status: 'catch_all',
                confidence: 'medium',
                details: 'Serveur catch-all: accepte toutes les adresses (impossible de confirmer)'
              });
            } else {
              resolve({
                email,
                valid: true,
                status: 'valid',
                confidence: 'high',
                details: 'Adresse email vérifiée et existante'
              });
            }
          } else if (code === 550 || code === 551 || code === 552 || code === 553) {
            resolve({
              email,
              valid: false,
              status: 'invalid',
              confidence: 'high',
              details: "L'adresse email n'existe pas sur ce serveur"
            });
          } else if (code === 450 || code === 451 || code === 452) {
            resolve({
              email,
              valid: false,
              status: 'temporary_error',
              confidence: 'low',
              details: 'Erreur temporaire du serveur, réessayez plus tard'
            });
          } else {
            resolve({
              email,
              valid: false,
              status: 'unknown',
              confidence: 'low',
              details: `Réponse inattendue du serveur: ${code}`
            });
          }
          break;
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      socket.destroy();
      reject(new Error(`Erreur connexion: ${err.message}`));
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

module.exports = { verifyEmail };
