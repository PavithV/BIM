# BIMCoach Studio

Dies ist eine mit Firebase Studio erstellte Next.js-Anwendung zur Analyse von BIM-Modellen (IFC-Dateien). Die App nutzt Firebase für die Authentifizierung und Datenbank sowie Genkit für KI-gestützte Analysen.

## Erste Schritte

Um die Anwendung lokal auszuführen, werfen Sie einen Blick auf `src/app/page.tsx` und die umliegenden Komponenten.

---

## Veröffentlichung und Hosting

### Wie stelle ich die App online?

Ihre Anwendung ist für **Firebase App Hosting** vorkonfiguriert. Der Veröffentlichungsprozess ist dadurch stark vereinfacht und automatisiert. In einer Entwicklungsumgebung wie Firebase Studio wird ein "Publish"- oder "Deploy"-Button den Veröffentlichungsprozess für Sie anstoßen. Wenn Sie mit einem Git-Repository arbeiten, löst ein `git push` in den Haupt-Branch in der Regel automatisch eine neue Bereitstellung aus.

Sie müssen sich nicht um manuelle Build-Schritte oder das Hochladen von Dateien kümmern.

### Kann ich einen externen Hoster (z. B. Host Europe) verwenden?

**Das wird nicht empfohlen.** Obwohl es technisch möglich ist, eine Next.js-Anwendung auf anderen Servern zu betreiben, ist dies mit erheblichem Aufwand und technischen Hürden verbunden:

*   **Komplexe Server-Anforderungen:** Ihre App ist keine simple, statische Webseite. Sie benötigt eine Node.js-Umgebung, die auf Standard-Webhosting-Paketen oft nicht verfügbar oder stark eingeschränkt ist. Man müsste einen teuren virtuellen oder dedizierten Server manuell konfigurieren.
*   **Verlust der Integration:** Die Anwendung ist tief in das Firebase-Ökosystem integriert (Authentifizierung, Datenbank, AI-Funktionen). Eine Migration zu einem externen Hoster würde eine komplexe manuelle Konfiguration von Umgebungsvariablen und Build-Prozessen erfordern und die Vorteile der nahtlosen Integration zunichtemachen.

**Fazit:** Bleiben Sie bei Firebase App Hosting. Es ist einfacher, stabiler und speziell für Anwendungen wie Ihre konzipiert.

### Wie kann ich meine eigene Domain (z. B. von Host Europe) verwenden?

**Ja, das ist der empfohlene Weg!** Sie können Ihre App auf Firebase hosten und Ihre bei einem externen Anbieter wie Host Europe registrierte Domain damit verknüpfen.

Der Prozess ist einfach:

1.  **App auf Firebase veröffentlichen:** Nutzen Sie den "Publish"-Button. Ihre App ist dann sofort unter einer technischen Firebase-Adresse verfügbar.
2.  **Benutzerdefinierte Domain in Firebase hinzufügen:** Gehen Sie in die Firebase Console zu "App Hosting" > "Benutzerdefinierte Domain hinzufügen".
3.  **Domain verbinden:** Firebase leitet Sie durch einen Prozess, bei dem Sie in der Regel zwei A-Einträge in den DNS-Einstellungen Ihres Domain-Anbieters (z. B. im Kunden-Menü von Host Europe) auf die von Firebase bereitgestellten IP-Adressen ändern.

Nachdem die DNS-Änderungen weltweit verbreitet sind (dauert oft nur wenige Minuten bis Stunden), ist Ihre Anwendung unter Ihrer eigenen, professionellen Domain erreichbar.

### Firebase-Kosten & Abrechnungskonto

Eine der häufigsten Fragen betrifft die Kosten.

*   **Kostenloser "Spark Plan":** Firebase bietet ein sehr großzügiges, kostenloses Kontingent. Für die meisten Start-ups und kleineren Projekte sind die Limits für Datenbankoperationen, Speicher, Benutzerauthentifizierung und Hosting völlig ausreichend, um die Anwendung kostenlos zu betreiben.
*   **"Blaze Plan" (Pay-as-you-go):** Nur wenn Ihre Anwendung die kostenlosen Limits überschreitet, fallen Kosten an. Sie zahlen dann nur für die tatsächliche Nutzung.
*   **Warum ist ein "Billing Account" (Abrechnungskonto) erforderlich?** Bestimmte Google Cloud-Dienste, insbesondere die hier genutzten KI-Funktionen (Genkit), erfordern die Verknüpfung eines Abrechnungskontos. **Dies bedeutet nicht, dass sofort Kosten anfallen.** Es ist eine Sicherheitsmaßnahme und eine Voraussetzung von Google, um diese Dienste zu aktivieren. Die Nutzung selbst fällt oft ebenfalls unter kostenlose Kontingente, aber die Verknüpfung ist obligatorisch.

**Zusammenfassend:** Sie können mit hoher Wahrscheinlichkeit kostenlos starten. Die Verknüpfung eines Abrechnungskontos ist für die Nutzung fortgeschrittener Funktionen wie der KI notwendig, führt aber erst dann zu Kosten, wenn Ihre App die großzügigen kostenlosen Nutzungsgrenzen überschreitet.
