# PPV Website - Configuration Vercel

## Problèmes résolus pour le déploiement Vercel

### 1. URL Backend
- **Problème** : L'URL du backend était hardcoded en `http://localhost:4000/api`
- **Solution** : Modifié pour utiliser une URL relative `/api` en production et localhost en développement

### 2. Service IA (Ollama → OpenAI)
- **Problème** : Ollama est un service local qui ne fonctionne pas sur Vercel
- **Solution** : Remplacé par OpenAI API qui fonctionne en cloud

### 3. Base de données PostgreSQL
- **Problème** : PostgreSQL local via Docker ne fonctionne pas sur Vercel
- **Solution** : Nécessite une base de données cloud (voir configuration ci-dessous)

## Configuration requise pour Vercel

### Variables d'environnement à configurer dans Vercel

Allez dans votre dashboard Vercel → Settings → Environment Variables et ajoutez :

```
DATABASE_URL=votre_database_url_de_prisma_postgres
OPENAI_API_KEY=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
```

**Pour obtenir DATABASE_URL :**
1. Allez dans votre dashboard Vercel → Storage → prisma-postgres-claret-pillow
2. Cliquez sur ".env.local" dans la section Quickstart
3. Copiez la valeur de `DATABASE_URL` (cliquez sur "Show secret" puis "Copy Snippet")

### Options de base de données cloud

Choisissez l'une de ces options pour PostgreSQL :

1. **Vercel Postgres** (recommandé pour Vercel)
   - Allez dans Vercel Dashboard → Storage → Create Database
   - Sélectionnez Postgres
   - Copiez les variables d'environnement fournies

2. **Supabase**
   - Créez un compte sur https://supabase.com
   - Créez un nouveau projet
   - Récupérez les credentials dans Settings → Database

3. **Neon**
   - Créez un compte sur https://neon.tech
   - Créez un nouveau projet
   - Récupérez la connection string

### Clé API OpenAI

1. Allez sur https://platform.openai.com/api-keys
2. Créez une nouvelle clé API
3. Ajoutez-la comme variable d'environnement `OPENAI_API_KEY` dans Vercel

## Initialisation de la base de données

Après avoir configuré votre base de données cloud, exécutez le script d'initialisation :

```bash
# Connectez-vous à votre base de données cloud et exécutez le fichier db/init.sql
# Ou utilisez l'interface web de votre provider pour exécuter le SQL
```

Le fichier `db/init.sql` contient la structure de la table users nécessaire.

## Déploiement

1. Poussez vos changements sur Git
2. Connectez votre repository à Vercel
3. Vercel détectera automatiquement la configuration via `vercel.json`
4. Configurez les variables d'environnement
5. Déployez

## Vérification

Après déploiement, vérifiez :
- L'endpoint `/api/health` devrait retourner `{ status: 'ok' }`
- L'inscription/connexion devrait fonctionner
- L'assistant IA devrait répondre aux questions
