# 🎯 Email Finder - Vérification SMTP Réelle

Application Node.js/Express qui vérifie réellement les adresses email via SMTP.

## ✅ Fonctionnalités

- **Vérification MX** : Vérifie si le domaine a un serveur mail
- **Test SMTP** : Vérifie si l'adresse existe sur le serveur
- **Détection Catch-all** : Identifie les serveurs qui acceptent tout
- **7 patterns d'emails** testés automatiquement

## 🚀 Déploiement sur Render

### Étape 1 : Push sur GitHub

```bash
git init
git add .
git commit -m "Email Finder avec vérification SMTP"
git remote add origin https://github.com/VOTRE-USERNAME/email-finder.git
git branch -M main
git push -u origin main
```

### Étape 2 : Créer un compte Render

1. Allez sur [render.com](https://render.com)
2. Cliquez sur **"Get Started for Free"**
3. Connectez-vous avec GitHub

### Étape 3 : Déployer

1. Dashboard → **"New +"** → **"Web Service"**
2. Connectez votre repo GitHub
3. Configuration :
   - **Name** : email-finder
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
4. Cliquez **"Create Web Service"**

✅ Votre app sera disponible sur `https://email-finder-xxxx.onrender.com`

## 📊 Interprétation des Résultats

| Status | Signification |
|--------|---------------|
| ✅ **VALIDE** | L'adresse email existe |
| ⚠️ **CATCH-ALL** | Le serveur accepte tout (impossible de confirmer) |
| ❌ **INVALIDE** | L'adresse n'existe pas |
| ❌ **NO_MX** | Pas de serveur mail pour ce domaine |

## 🔧 Développement Local

```bash
npm install
npm start
# Ouvrir http://localhost:3000
```

## ⚠️ Limitations

- Certains serveurs mail bloquent les vérifications SMTP
- Les serveurs catch-all acceptent toutes les adresses
- Délai de ~2-5 secondes par email vérifié
