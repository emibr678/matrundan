# Renderad GUI-granskning

Detta kompletterar repots rot-`AGENTS.md` för ändringar under `src/`.

Om en ändring påverkar renderat GUI ska `docs/visual-review.md` läsas och minst **nivå 1 – visuell smoke check** genomföras innan kandidaten rapporteras som färdig. Kör endast relevanta routes/states under normal iteration; GitHub-artifacts ska inte skapas bara för att en liten UI-ändring behöver granskas.

Interaktionsändringar använder minst nivå 2. Större huvudflöden använder nivå 3 med persona-/UX-review och full renderad granskning. Lovable-konsultation, Lovable-implementation, Lovable-synk och Lovable-preview används endast när användaren uttryckligen har bett om Lovable; nivå 3 i sig är inte ett skäl att använda Lovable. Redovisa vad som faktiskt renderades och vad som inte kunde verifieras.
