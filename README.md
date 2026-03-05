<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="OtoReport Logo" width="100" />

  # OtoReport

  **Professional otoscopy reporting software for healthcare centers**

  [![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/nicovlkk/otoreport/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-lightgrey)](#download)
  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
</div>

---

OtoReport is a desktop and mobile application designed for nurses, audiologists, and general practitioners who perform ear examinations. It lets you create complete otoscopy and ear wash reports, manage patients, capture and annotate images, and export professional PDF documents — all from a single, offline-first tool.

---

## What it does

### Patient management
- Register patients with their full clinical profile (name, date of birth, phone, email, and notes)
- Search and retrieve any patient instantly to start a new examination session
- View the complete session history per patient

### Otoscopy reports
- Document findings for both ears (right and left) using structured clinical checklists
- Record tympanic membrane findings: normal, retraction, perforation, effusion, inflammation
- Record external auditory canal findings: normal, cerumen, edema, otorrhea, exostosis
- Add free-text observations per ear and a global clinical conclusion
- Supports two report types: **Otoscopy** and **Ear Wash** (pre/post ear comparison)

### Image capture and annotation
- Capture images directly from a connected otoscope or camera
- Crop and zoom images before attaching them to the report
- Draw annotations directly on images to highlight areas of interest
- Attach multiple images per ear

### PDF export
- Generate a clean, professional PDF with your center's branding (logo, name, address)
- Fully configurable sections: choose which sections appear in the report and reorder them via drag-and-drop
- Control image size and images per row
- PDF includes patient data, exam info, findings, annotated images, observations, and conclusion

### Findings library
- Browse a curated visual library of otoscopy findings with reference images
- Filter by category (tympanic membrane or external canal)
- Works offline with local image cache; syncs with the online library when connected
- Contribute your own anonymized images to the shared library

### Multi-profile support
- Create multiple examiner profiles, each with its own settings, branding, and findings configuration
- Switch profiles in one click — useful for shared workstations or multi-examiner clinics

### Customization
- Light, dark, and system themes
- Accent color per profile
- Customizable findings categories and checks (add, remove, rename)
- Configurable PDF section order and visibility

---

## Screenshots

> _Coming soon_

---

## Download

Installers for Windows, macOS, Linux, and Android are available on the [Releases](https://github.com/nicovlkk/otoreport/releases) page.

| Platform | Format |
|---|---|
| Windows | `.msi` installer |
| macOS | `.dmg` |
| Linux | `.AppImage` / `.deb` |
| Android | `.apk` |

---

## Data & privacy

OtoReport stores all data locally on your device. No patient information is ever sent to external servers. The optional findings library sync only downloads reference images from a public repository — it never uploads any clinical data.

---

## License

MIT — see [LICENSE](LICENSE) for details.
