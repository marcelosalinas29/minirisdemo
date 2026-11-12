# Architecture
- Reuse PreviousStudiesSection for patient-history and quick-upload entry points so manual uploads follow one implementation.
- Use savePreviousStudyFile for previous-study storage and registration; only remove objects uploaded by the failed attempt, never reused objects.
- Agenda history combines appointment history and previous-study identities via getPatientHistoryKey; propagate successful previous-study mutations through optional onChanged callbacks to refresh the agenda without per-row queries.