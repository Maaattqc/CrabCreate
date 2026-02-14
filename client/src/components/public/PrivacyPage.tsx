import { useLanguage } from '../../hooks/useLanguage';

export default function PrivacyPage() {
  const { t, lang } = useLanguage();

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <h1 className="text-3xl font-extrabold text-tx-primary font-display mb-10">{t.privacyTitle}</h1>

        <div className="prose prose-sm text-tx-secondary space-y-6 leading-relaxed">
          {lang === 'fr' ? (
            <>
              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">1. Donnes Collectes</h2>
                <p>CrabCreate collecte les donnes suivantes : adresse email (pour l'authentification), donnes d'utilisation du service (tickets crs, logs de pipeline).</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">2. Utilisation des Donnes</h2>
                <p>Vos donnes sont utilises uniquement pour fournir le service CrabCreate. Elles ne sont jamais vendues  des tiers.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">3. Stockage</h2>
                <p>Les donnes sont stockes de manire scurise sur des serveurs situs en France (OVH). Les mots de passe ne sont pas stocks — l'authentification se fait par code  usage unique.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">4. Cookies</h2>
                <p>CrabCreate utilise un cookie de session (crab_token) strictement ncessaire au fonctionnement du service. Aucun cookie de tracking n'est utilis.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">5. Vos Droits</h2>
                <p>Conformment au RGPD, vous disposez d'un droit d'accs, de rectification et de suppression de vos donnes. Contactez-nous  contact@crabcreate.com.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">6. Contact DPO</h2>
                <p>Pour toute question relative  la protection de vos donnes : contact@crabcreate.com</p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">1. Data Collected</h2>
                <p>CrabCreate collects the following data: email address (for authentication), service usage data (tickets created, pipeline logs).</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">2. Data Usage</h2>
                <p>Your data is used solely to provide the CrabCreate service. It is never sold to third parties.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">3. Storage</h2>
                <p>Data is stored securely on servers located in France (OVH). Passwords are not stored — authentication uses one-time codes.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">4. Cookies</h2>
                <p>CrabCreate uses a session cookie (crab_token) strictly necessary for the service to function. No tracking cookies are used.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">5. Your Rights</h2>
                <p>Under GDPR, you have the right to access, rectify, and delete your data. Contact us at contact@crabcreate.com.</p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-tx-primary mb-3">6. DPO Contact</h2>
                <p>For any data protection questions: contact@crabcreate.com</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
