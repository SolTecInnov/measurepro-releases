# Prompt pour Replit — RoadScope Photo Storage Fix

Copier-coller ce qui suit dans Replit:

---

## Contexte

MeasurePRO envoie des surveys avec photos à RoadScope via un sync en 6 phases. Les photos sont uploadées séparément des POIs via des signed URLs, puis les storage URLs sont incluses dans les payloads POI.

**Le bug qu'on doit corriger ensemble:**

1. **Côté MeasurePRO (FIXÉ):** Le code qui matchait les fichiers aux POIs utilisait `photo_001.jpg` comme clé de Map. Comme tous les POIs ont une photo nommée `photo_001.jpg`, la Map écrasait les entrées et les photos étaient liées au mauvais POI. **C'est corrigé dans MeasurePRO v16.1.80** — le code utilise maintenant `{poiId}/photo_001.jpg` comme clé unique.

2. **Côté RoadScope (À CORRIGER):** L'endpoint `POST /upload-urls` et `processPhotosForStorage` stockent tous les fichiers dans `photos/general/` au lieu de `photos/{poiExternalId}/`. Le `poiExternalId` est envoyé par MeasurePRO dans chaque `FileUploadRequest` mais il n'est pas utilisé dans le path de stockage.

## Ce que MeasurePRO envoie

### Phase 3a: Demande de signed URLs
```
POST /api/measurepro/surveys/{surveyId}/upload-urls
Body: {
  files: [
    {
      filename: "photo_001.jpg",
      contentType: "image/jpeg",
      size: 150000,
      category: "photos",
      poiExternalId: "abc-123-def-456"  ← L'ID UNIQUE DU POI
    },
    {
      filename: "photo_001.jpg",
      contentType: "image/jpeg",
      size: 200000,
      category: "photos",
      poiExternalId: "ghi-789-jkl-012"  ← UN AUTRE POI, MÊME NOM DE FICHIER
    }
  ]
}
```

### Ce que RoadScope DEVRAIT retourner
```json
{
  "urls": [
    {
      "filename": "photo_001.jpg",
      "uploadUrl": "https://storage.googleapis.com/...signed-url...",
      "storagePath": "measurepro/{surveyId}/photos/abc-123-def-456/photo_001.jpg"
    },
    {
      "filename": "photo_001.jpg",
      "uploadUrl": "https://storage.googleapis.com/...signed-url...",
      "storagePath": "measurepro/{surveyId}/photos/ghi-789-jkl-012/photo_001.jpg"
    }
  ]
}
```

**CRITIQUE:** Le `storagePath` DOIT inclure le `poiExternalId` dans le path. Pas dans `general/`. Le format attendu est:
```
measurepro/{surveyId}/photos/{poiExternalId}/{filename}
```

### Phase 3c: Registration des fichiers
```
POST /api/measurepro/surveys/{surveyId}/files
Body: {
  files: [
    {
      filename: "photo_001.jpg",
      storageUrl: "measurepro/{surveyId}/photos/abc-123-def-456/photo_001.jpg",
      category: "photos",
      contentType: "image/jpeg",
      size: 150000,
      linkedPoiExternalId: "abc-123-def-456"  ← LIEN VERS LE BON POI
    }
  ]
}
```

### Phase 4: POI avec storage URLs
```
POST /api/measurepro/surveys/{surveyId}/pois
Body: {
  pois: [
    {
      externalId: "abc-123-def-456",
      type: "wire",
      photos: [
        "https://storage.googleapis.com/os-hub-db.firebasestorage.app/measurepro/{surveyId}/photos/abc-123-def-456/photo_001.jpg"
      ],
      ...
    }
  ]
}
```

## Ce que Replit doit faire

### 1. Corriger l'endpoint `upload-urls`

Dans le handler de `POST /surveys/{surveyId}/upload-urls`:
- Lire le `poiExternalId` de chaque fichier dans le body
- Générer le storagePath avec le `poiExternalId`: `measurepro/{surveyId}/photos/{poiExternalId}/{filename}`
- **NE PLUS utiliser `general/`** comme dossier par défaut

### 2. Corriger `processPhotosForStorage`

Si cette fonction existe et gère le stockage des photos:
- Utiliser `poiExternalId` (ou `linkedPoiExternalId`) pour construire le path
- Format: `measurepro/{surveyId}/{category}/{poiExternalId}/{filename}`

### 3. Affichage des photos dans les POIs

Quand RoadScope affiche un POI:
- Lire le champ `photos` du POI (array de URLs HTTPS)
- Chaque URL pointe vers Google Cloud Storage
- Afficher l'image directement depuis cette URL
- Si `photos` est vide ou undefined, le POI n'a pas de photo

### 4. Pour les surveys déjà synchés

L'utilisateur va lancer un re-sync depuis MeasurePRO (Tools > RoadScope Photo Re-Sync). Ceci va:
1. Clear le file sync state local
2. Re-uploader TOUS les fichiers avec les bons `poiExternalId`
3. Re-register les fichiers avec les bons `linkedPoiExternalId`
4. Re-envoyer les POIs avec les bonnes storage URLs

**RoadScope doit accepter cette re-registration** — si un fichier avec le même `linkedPoiExternalId` et `filename` existe déjà, il doit être remplacé (upsert, pas reject).

### 5. Vérification

Après le fix, vérifier:
- [ ] `upload-urls` retourne des `storagePath` avec `poiExternalId` (pas `general`)
- [ ] Les fichiers uploadés sont physiquement dans `photos/{poiExternalId}/` sur GCS
- [ ] `registerFiles` lie chaque fichier au bon POI via `linkedPoiExternalId`
- [ ] Les POIs affichent la bonne photo (pas celle d'un autre POI)
- [ ] Le re-sync depuis MeasurePRO fonctionne (upsert sur fichiers existants)

## Résumé du mapping POI ↔ Photo

```
MeasurePRO POI                    Storage Path                              POI Payload
─────────────                     ─────────────                             ─────────────
id: "abc-123"                     photos/abc-123/photo_001.jpg              photos: ["https://.../photos/abc-123/photo_001.jpg"]
imageUrl: "data:image/jpeg;..."   ↑ uploaded via signed URL
                                  ↑ poiExternalId = "abc-123"

id: "ghi-789"                     photos/ghi-789/photo_001.jpg              photos: ["https://.../photos/ghi-789/photo_001.jpg"]
imageUrl: "data:image/jpeg;..."   ↑ DIFFERENT file, SAME filename
                                  ↑ poiExternalId = "ghi-789"
```

Le `poiExternalId` est la CLÉ qui relie tout. Sans lui dans le path, les fichiers se mélangent.
