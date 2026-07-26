# Tillfällig kartdiagnostik

Den interna routen `/mapdiagnostik` används endast för att isolera problem mellan MapLibre-rendering, Geoapify-resurser och Matrundans `PlaceMap`-livscykel. Den visar aldrig API-nyckeln och ska tas bort när rotorsaken är verifierad.
