# WINTER 808STEPS - Prototype statique

Ceci est un prototype statique d'un site e-commerce simple spécialisé dans les vêtements et accessoires.

Structure:
- `index.html` : page d'accueil avec bandeau et produits mis en avant
- `homme.html`, `femme.html`, `accessoires.html`, `chaussures.html`, `promotions.html` : pages catégories
- `product.html?id=<product-id>` : fiche produit (paramétrée par l'id en GET)
- `cart.html` : panier
- `style.css` : styles du site
 `scripts.js` : scripts pour le panier et interaction
 `images/` : images d'exemple (SVG)
 `server/` : prototype Node.js/Express backend (API, webhooks, e-mail)

Comment tester localement :
3. Parcoure les catégories, clique sur un produit, ajoute au panier puis ouvre le panier
4. Pour tester le backend flow (emails/webhooks), ouvre un terminal et lance le serveur de test :

```powershell
cd server
npm install
npm start
```
 Le panier est stocké dans `localStorage` (clef `808steps_cart`). Le prototype contient un serveur d'exemple dans `/server` qui peut traiter des commandes localement (simulateur de PSP, webhook, envoi d'e-mails via SMTP ou ethereal).
 Pour ajouter des pages ou styles, crée un nouveau fichier HTML et lie `style.css` et `scripts.js`.
 Ajouter un backend (API) pour persistances des produits, authentification des clients et commandes. Le dossier `server/` contient une implémentation d'exemple avec webhooks et envoi d'e-mails.
Notes techniques :
- Le panier est stocké dans `localStorage` (clef `808steps_cart`). Ce prototype n'envoie pas de données à un serveur.
- Pour créer d'autres produits, modifie `scripts.js` (const PRODUCTS).
- Pour ajouter des pages ou styles, créé un nouveau fichier HTML et lie `style.css` et `scripts.js`.

Améliorations possibles :
- Ajouter un build system (npm) pour packaging
- Ajouter un système réel côté serveur pour la commande et paiement
- Ajouter des images de meilleure qualité et fiches produits détaillées

---

Si tu veux que je personnalise le style, ajoute plus de produits, ou que je génère du HTML/CSS supplémentaires, dis-moi ce que tu veux.