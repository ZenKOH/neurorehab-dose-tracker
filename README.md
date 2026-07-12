# NeuroRehab Dose Tracker

A browser-based clinical workflow prototype for neurorehabilitation dose tracking, programme review, functional carryover, and therapist documentation support.

This is no longer just a session diary. The upgraded app is designed as a lightweight **rehabilitation continuity and evidence tool** for therapists, pilot sites, and clinical innovation teams.

## What it does

- Create therapy programmes around a case label, diagnosis/pathway, rehabilitation phase, primary functional goal, secondary goals, precautions, clinician, review date, and weekly targets.
- Track multidimensional rehabilitation dose:
  - scheduled minutes
  - active practice minutes
  - repetitions
  - movement quality
  - fatigue
  - pain/discomfort
  - assistance level
  - challenge level
  - task specificity
  - rest breaks
  - home adherence
  - functional carryover
- Track configurable outcome measures such as 10MWT, 6MWT, TUG, ARAT, Goal Attainment Scaling, or patient-specific goals.
- Maintain an equipment library and attach one or more devices to each therapy session:
  - HandVivante™
  - GaitVivante™
  - ElevoVivante™
  - RevitaVivante™
  - custom clinic or research equipment
- Review equipment utilisation by session count, active minutes, repetitions and last-use date.
- Generate explainable AI-style review prompts with:
  - trigger
  - interpretation
  - clinician review consideration
  - severity label
- Show a therapist dashboard across multiple cases.
- Switch the complete workflow between:
  - English
  - Simplified Chinese (简体中文)
  - Spanish (Español)
  - French (Français)
  - German (Deutsch)
  - Malay (Bahasa Melayu)
- Export:
  - CSV session dataset
  - clinician-readable progress note
  - FHIR-shaped JSON prototype export
  - full JSON backup / restore file

## Why this exists

Therapy dose is clinically meaningful only when it is connected to quality, fatigue, tolerance, functional carryover, goals, outcomes, and documentation.

The product direction follows three adoption realities:

1. Rehabilitation needs better functioning data and stronger integration into health systems.
2. Digital health tools need evidence-generation workflows, not just attractive dashboards.
3. Therapist adoption depends on reducing documentation friction and improving clinical visibility between sessions.

## Use the app

Open the GitHub Pages version:

```text
https://zenkoh.github.io/neurorehab-dose-tracker/
```

Or run locally:

```bash
git clone https://github.com/ZenKOH/neurorehab-dose-tracker.git
cd neurorehab-dose-tracker
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Recommended workflow

1. Create a programme.
2. Define the primary functional goal and weekly targets.
3. Record therapy sessions using active practice minutes, repetitions, quality, fatigue, pain, challenge, task specificity, assistance and carryover.
4. Add outcome measures at baseline and review points.
5. Review the therapist dashboard and AI-Generated Review prompts.
6. Export a progress note or CSV for documentation and service-review purposes.
7. Backup data as JSON if you want to preserve local records.

## Privacy

This static prototype stores data in the browser's local storage. It does not upload data to a backend.

Do not enter directly identifiable patient information in the public GitHub Pages version. Use pseudonymous case labels such as `Case A` or initials only if permitted by your local policy.

## FHIR-shaped export

The app exports a prototype FHIR-shaped JSON bundle using concepts such as:

- Patient
- CarePlan
- Goal
- Observation

This is intended for interoperability planning and technical discussion only. It is not a validated EHR integration.

## Clinical and regulatory scope

This tool is for tracking, education, workflow exploration, documentation support and pilot evidence generation only.

It is not:

- medical advice
- a diagnostic system
- an autonomous treatment recommender
- a safety certification system
- a regulated medical device
- a replacement for licensed clinical judgement

The AI-Generated Review section is rule-based and explainable. It is intended to support clinician review, not to make or automate treatment decisions.

## Multilingual design

The language control in the header changes navigation, forms, clinical review prompts, charts, status messages, programme terminology and progress-note exports without reloading the page.

- The selected language is stored locally and works offline.
- The document `lang` attribute and locale-aware dates update with the selection for assistive technology.
- Select controls retain stable English data values underneath translated labels, so dose and carryover rules remain deterministic.
- FHIR-shaped exports include a BCP 47 `language` value on the bundle and resources.
- FHIR-shaped exports represent equipment as `Device` resources and therapy sessions as `Procedure` resources with `usedReference` links.
- User-entered clinical text is preserved exactly; the app does not machine-translate clinical notes or goals.

Translations are product-localisation drafts and should receive native-speaking clinical review before deployment in care settings.

## Evidence-informed product decisions

- Targets remain clinician-configurable and needs-based. NICE recommends needs-based multidisciplinary rehabilitation after stroke and explicitly preserves individual clinical judgement; the prototype therefore does not impose a single target across diagnoses or phases.
- Scheduled time, active practice, repetitions, tolerance and functional carryover remain distinct measures rather than being collapsed into one dose score.
- The active page language is declared in the HTML document in line with W3C accessibility guidance.
- Navigation destinations use native links with stable URL fragments, while downloads, form submissions and destructive operations remain action buttons.
- The FHIR-shaped export uses the standard resource `language` element described by HL7 FHIR.
- Equipment is modelled using the core fields of HL7 FHIR R4 `Device`; session use is linked through `Procedure.usedReference`.

Primary references:

- [NICE NG236: Stroke rehabilitation in adults](https://www.nice.org.uk/guidance/ng236/chapter/Recommendations)
- [WHO: Rehabilitation fact sheet](https://www.who.int/news-room/fact-sheets/detail/rehabilitation)
- [W3C: Understanding language of page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html)
- [W3C WAI: Link pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
- [WHO: Assistive technology](https://www.who.int/news-room/fact-sheets/detail/assistive-technology)
- [HL7 FHIR: Languages](https://fhir.hl7.org/fhir/languages.html)
- [HL7 FHIR R4: Device](https://hl7.org/fhir/R4/device.html)
- [HL7 FHIR R4: Procedure](https://hl7.org/fhir/R4/procedure.html)

## Validation

```bash
npm test
```

The test suite checks all supported language codes, representative clinical translations, dynamic numeric messages and language persistence.

## Roadmap

### Phase 1: Therapist-grade static app

- [x] Programme layer
- [x] Expanded clinical dose model
- [x] Outcome tracker
- [x] Equipment library and session-device linkage
- [x] Equipment utilisation analytics
- [x] Therapist dashboard
- [x] Explainable review prompts
- [x] Progress note export
- [x] CSV export
- [x] FHIR-shaped JSON export
- [x] JSON backup and restore

### Phase 2: Clinical workflow version

- [ ] Encrypted storage
- [ ] Therapist and patient/caregiver roles
- [ ] Audit log
- [ ] Clinic-level dashboard
- [ ] Consent and privacy settings
- [ ] PDF reports
- [ ] Configurable protocols

### Phase 3: Pilot evidence layer

- [ ] Therapist documentation-time tracking
- [ ] Adherence and carryover analytics
- [ ] Outcome-change dashboards
- [ ] Safety-review register
- [ ] Evidence-readiness report aligned to digital health evaluation frameworks

### Phase 4: Institution-ready product

- [ ] FHIR server integration
- [ ] EHR export workflow
- [ ] Governance dashboard
- [ ] Deployment guide
- [ ] Clinical validation study pack
- [ ] Security and privacy documentation

## License

MIT
