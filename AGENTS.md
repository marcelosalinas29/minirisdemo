# Architecture
- Reuse PreviousStudiesSection for patient-history and quick-upload entry points so manual uploads follow one implementation.
- Use savePreviousStudyFile for previous-study storage and registration; only remove objects uploaded by the failed attempt, never reused objects.