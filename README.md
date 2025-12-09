# 🎯 Email Finder Multi-API v3

Application qui **cascade automatiquement entre plusieurs APIs gratuites** pour maximiser les vérifications d'emails sans frais.

## 🔄 Comment ça marche

L'app essaie les APIs dans cet ordre :
1. **Verifalia** (25/jour) → Si épuisé...
2. **Hunter.io** (50/mois) → Si épuisé...
3. **AbstractAPI** (100/mois) → Si épuisé...
4. **ZeroBounce** (100 one-time) → Si épuisé...
5. **EmailListVerify** (100 one-time)

**Total potentiel : ~750+ vérifications/mois GRATUITES !**

---

## 🚀 Déploiement

### Étape 1 : Créer les comptes gratuits

Crée un compte sur chaque service (tous gratuits, sans carte bancaire) :

| Service | Lien inscription | Crédits gratuits |
|---------|------------------|------------------|
| Verifalia | [verifalia.com/sign-up](https://verifalia.com/sign-up) | 25/jour |
| Hunter.io | [hunter.io/users/sign_up](https://hunter.io/users/sign_up) | 50/mois |
| AbstractAPI | [abstractapi.com](https://www.abstractapi.com/api/email-verification-validation-api) | 100/mois |
| ZeroBounce | [zerobounce.net/members/signin](https://www.zerobounce.net/members/signin) | 100 |
| EmailListVerify | [emaillistverify.com](https://www.emaillistverify.com/) | 100 |

### Étape 2 : Récupérer les clés API

Après inscription, récupère tes clés API :

- **Verifalia** : Dashboard → API Keys → Username + Password
- **Hunter** : Dashboard → API → Copier la clé
- **AbstractAPI** : Dashboard → Email Validation → API Key
- **ZeroBounce** : Dashboard → API → API Key
- **EmailListVerify** : Dashboard → API → Secret Key

### Étape 3 : Push sur GitHub

```bash
git init
git add .
git commit -m "Email Finder Multi-API"
git remote add origin https://github.com/TON-USERNAME/email-finder.git
git push -u origin main
```

### Étape 4 : Déployer sur Render

1. Va sur [render.com](https://render.com)
2. New → Web Service → Connect ton repo
3. Configure :
   - **Name** : email-finder
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`

### Étape 5 : Ajouter les variables d'environnement

Dans Render → Environment → Add les variables :

```
VERIFALIA_USERNAME=ton_username_verifalia
VERIFALIA_PASSWORD=ton_password_verifalia
HUNTER_API_KEY=ta_cle_hunter
ABSTRACT_API_KEY=ta_cle_abstract
ZEROBOUNCE_API_KEY=ta_cle_zerobounce
EMAILLISTVERIFY_API_KEY=ta_cle_emaillistverify
```

⚠️ **Tu n'es pas obligé de configurer TOUTES les APIs.** L'app fonctionne avec une seule, mais plus tu en configures, plus tu as de crédits !

---

## 📊 Fonctionnement

### Interface

L'interface affiche en temps réel :
- ✅ Providers configurés et actifs
- ❌ Providers non configurés
- 🔴 Providers épuisés

### Résultats

Chaque résultat indique :
- L'email testé
- Le statut (valid, invalid, catch-all, etc.)
- Le provider qui a répondu
- Le score de confiance

---

## 🔧 Développement local

```bash
# Créer un fichier .env
cat > .env << EOF
VERIFALIA_USERNAME=xxx
VERIFALIA_PASSWORD=xxx
HUNTER_API_KEY=xxx
ABSTRACT_API_KEY=xxx
ZEROBOUNCE_API_KEY=xxx
EMAILLISTVERIFY_API_KEY=xxx
EOF

# Installer et lancer
npm install
npm start

# Ouvrir http://localhost:3000
```

---

## 📁 Structure

```
email-finder/
├── src/
│   ├── server.js           # Serveur Express
│   └── emailVerifier.js    # Logique multi-API
├── public/
│   └── index.html          # Interface
├── package.json
└── README.md
```

---

## ⚠️ Limites et conseils

- Les crédits Verifalia se renouvellent chaque jour à minuit UTC
- Les crédits Hunter/Abstract se renouvellent chaque mois
- ZeroBounce et EmailListVerify sont one-time (ne se renouvellent pas)
- Configure au moins Verifalia + Hunter pour avoir des crédits qui se renouvellent

---

## 🆘 Troubleshooting

**"Tous les crédits API sont épuisés"**
→ Attends minuit pour Verifalia ou ajoute plus de clés API

**"Aucune API configurée"**
→ Vérifie que tes variables d'environnement sont bien ajoutées dans Render

**Un provider affiche "exhausted" alors qu'il ne devrait pas**
→ Appelle `/api/reset-providers` (POST) pour reset le statut
