# BIMCoach Studio

Dies ist eine mit Firebase Studio erstellte Next.js-Anwendung zur Analyse von BIM-Modellen (IFC-Dateien). Die App nutzt Firebase für die Authentifizierung und Datenbank sowie Genkit für KI-gestützte Analysen.

## Erste Schritte

Um die Anwendung lokal auszuführen, werfen Sie einen Blick auf `src/app/page.tsx` und die umliegenden Komponenten.

---

## Veröffentlichung Ihrer Anwendung (Deployment)

### Wie stelle ich die App online?

Ihre Anwendung ist für **Firebase App Hosting** vorkonfiguriert. Der Veröffentlichungsprozess ist dadurch stark vereinfacht und automatisiert. In einer Entwicklungsumgebung wie Firebase Studio wird ein "Publish"- oder "Deploy"-Button den Veröffentlichungsprozess für Sie anstoßen. Wenn Sie mit einem Git-Repository arbeiten, löst ein `git push` in den Haupt-Branch in der Regel automatisch eine neue Bereitstellung aus.

Sie müssen sich nicht um manuelle Build-Schritte oder das Hochladen von Dateien kümmern.

### Kann ich einen externen Hoster verwenden?

Obwohl es technisch möglich ist, die Anwendung auf Plattformen wie Vercel oder Netlify zu hosten, **wird dies nicht empfohlen**. Die Anwendung ist tief in das Firebase-Ökosystem integriert (Authentifizierung, Datenbank, AI-Funktionen). Eine Migration zu einem externen Hoster würde eine komplexe manuelle Konfiguration von Umgebungsvariablen und Build-Prozessen erfordern und die Vorteile der nahtlosen Integration zunichtemachen.

### Firebase-Kosten & Abrechnungskonto

Eine der häufigsten Fragen betrifft die Kosten.

*   **Kostenloser "Spark Plan":** Firebase bietet ein sehr großzügiges, kostenloses Kontingent. Für die meisten Start-ups und kleineren Projekte sind die Limits für Datenbankoperationen, Speicher, Benutzerauthentifizierung und Hosting völlig ausreichend, um die Anwendung kostenlos zu betreiben.
*   **"Blaze Plan" (Pay-as-you-go):** Nur wenn Ihre Anwendung die kostenlosen Limits überschreitet, fallen Kosten an. Sie zahlen dann nur für die tatsächliche Nutzung.
*   **Warum ist ein "Billing Account" (Abrechnungskonto) erforderlich?** Bestimmte Google Cloud-Dienste, insbesondere die hier genutzten KI-Funktionen (Genkit), erfordern die Verknüpfung eines Abrechnungskontos. **Dies bedeutet nicht, dass sofort Kosten anfallen.** Es ist eine Sicherheitsmaßnahme und eine Voraussetzung von Google, um diese Dienste zu aktivieren. Die Nutzung selbst fällt oft ebenfalls unter kostenlose Kontingente, aber die Verknüpfung ist obligatorisch.

**Zusammenfassend:** Sie können mit hoher Wahrscheinlichkeit kostenlos starten. Die Verknüpfung eines Abrechnungskontos ist für die Nutzung fortgeschrittener Funktionen wie der KI notwendig, führt aber erst dann zu Kosten, wenn Ihre App die großzügigen kostenlosen Nutzungsgrenzen überschreitet.
